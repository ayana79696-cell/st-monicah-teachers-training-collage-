'use client';

import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import {createClient} from '@/lib/supabase/client';

type Profile={id:string;full_name:string;role:string;active:boolean};
type Student={id:string;first_name:string;middle_name?:string|null;last_name:string;admission_number:string;programme_id?:string|null;status:string};
type Programme={id:string;title:string;code:string};
type AttendanceRecord={id:string;student_id:string;session_date:string;status:string;notes?:string|null;scanned_at?:string|null;entry_method?:string|null;created_at?:string|null};
type ScanReceipt={attendance_id?:string;student_id?:string;student_name?:string;admission_number?:string;passport_number?:string;programme_title?:string|null;session_date?:string;status?:string;entry_method?:string;scanned_at?:string;already_marked?:boolean;error?:string;message?:string};

const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const allowedRoles=['super_admin','principal','registrar','hod','lecturer','practice_supervisor'];
const scannerLibraryUrl='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';

function nairobiDate(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return values.year+'-'+values.month+'-'+values.day;
}
function parseQrToken(raw:string){
 const input=raw.trim();if(!input)return '';
 try{const url=new URL(input);const token=url.searchParams.get('token');if(token)return token.trim();}catch{}
 const match=input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
 return match?.[0]||'';
}
function formatTime(value?:string|null){
 if(!value)return '—';const date=new Date(value);if(Number.isNaN(date.getTime()))return '—';
 return date.toLocaleTimeString('en-KE',{timeZone:'Africa/Nairobi',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
}
function csvEscape(value:unknown){return '"'+String(value??'').replace(/"/g,'""')+'"';}
function readAttendanceDraft(date:string):Record<string,string>{if(typeof window==='undefined')return {};try{const value=window.localStorage.getItem('stmonicah-attendance-drafts-v1-'+date);const parsed=value?JSON.parse(value):{};return parsed&&typeof parsed==='object'?parsed:{}}catch{return {}}}

export default function AttendancePage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [students,setStudents]=useState<Student[]>([]);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [records,setRecords]=useState<AttendanceRecord[]>([]);
 const [registerDate,setRegisterDate]=useState(nairobiDate());
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [cameraActive,setCameraActive]=useState(false);
 const [scannerLibraryLoaded,setScannerLibraryLoaded]=useState(false);
 const [cameraMessage,setCameraMessage]=useState('Start the camera on this phone to scan a student passport QR code.');
 const [manualQr,setManualQr]=useState('');
 const [scanBusy,setScanBusy]=useState(false);
 const [lastScan,setLastScan]=useState<ScanReceipt|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [reportPrinting,setReportPrinting]=useState(false);
 const [offlineMode,setOfflineMode]=useState(false);
 const [offlineMarks,setOfflineMarks]=useState<Record<string,string>>(()=>readAttendanceDraft(nairobiDate()));
 const profileRef=useRef<Profile|null>(null);
 const scannerRef=useRef<any>(null);
 const processingRef=useRef(false);
 const lastScannedRef=useRef({token:'',at:0});
 const lastDecodeNoticeRef=useRef(0);

 const loadRegister=useCallback(async(date=registerDate,initial=false)=>{
  if(initial)setLoading(true);else setRefreshing(true);
  setError('');
  try{
   const db=createClient();const {data:{session}}=await db.auth.getSession();
   if(!session){router.replace('/login');return;}
   const {data:p,error:pe}=await db.from('college_profiles').select('id,full_name,role,active').eq('id',session.user.id).maybeSingle();
   if(pe)throw pe;if(!p?.active){router.replace('/login');return;}
   if(!allowedRoles.includes(p.role)){setError('Your college role does not have permission to use student attendance.');setProfile({full_name:p.full_name||'',role:p.role,active:p.active});return;}
   profileRef.current=p as Profile;setProfile(p as Profile);
   const [studentRes,programmeRes,attendanceRes]=await Promise.all([
    db.from('college_students').select('id,first_name,middle_name,last_name,admission_number,programme_id,status').eq('status','active').order('last_name').limit(2000),
    db.from('college_programmes').select('id,title,code').order('title').limit(500),
    db.from('college_attendance').select('id,student_id,session_date,status,notes,scanned_at,entry_method,created_at').eq('session_date',date).is('unit_id',null).order('scanned_at',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(3000)
   ]);
   if(studentRes.error)throw studentRes.error;if(programmeRes.error)throw programmeRes.error;if(attendanceRes.error)throw attendanceRes.error;
   const freshStudents=(studentRes.data||[]) as Student[];const freshProgrammes=(programmeRes.data||[]) as Programme[];const freshRecords=(attendanceRes.data||[]) as AttendanceRecord[];
   setStudents(freshStudents);setProgrammes(freshProgrammes);setRecords(freshRecords);setOfflineMode(false);
   try{window.localStorage.setItem('stmonicah-attendance-roster-cache-v1',JSON.stringify({students:freshStudents,programmes:freshProgrammes,savedAt:new Date().toISOString()}));window.localStorage.setItem('stmonicah-attendance-records-v1-'+date,JSON.stringify(freshRecords));}catch{}
  }catch(e:any){
   const cachedProfile=profileRef.current;
   if(cachedProfile?.active&&allowedRoles.includes(cachedProfile.role)){
    try{const raw=window.localStorage.getItem('stmonicah-attendance-roster-cache-v1');const cache=raw?JSON.parse(raw):null;const cachedRecords=window.localStorage.getItem('stmonicah-attendance-records-v1-'+date);if(cache&&Array.isArray(cache.students)&&Array.isArray(cache.programmes)){setStudents(cache.students as Student[]);setProgrammes(cache.programmes as Programme[]);setRecords(cachedRecords?JSON.parse(cachedRecords) as AttendanceRecord[]:[]);setOfflineMode(true);setError('');setNotice('Offline draft mode: showing the last roster saved on this device. QR verification and synchronization require a working internet connection. Keep this page open and sync drafts when reconnected.');}else{setError(e?.message||'Unable to load the daily attendance register.');}}catch{setError(e?.message||'Unable to load the daily attendance register.');}
   }else{setError(e?.message||'Unable to load the daily attendance register. Offline cached data is unavailable until an authorized session has loaded the register online.');}
  }
  finally{setLoading(false);setRefreshing(false);}
 },[router,registerDate]);

 useEffect(()=>{void loadRegister(registerDate,true);},[loadRegister,registerDate]);
 useEffect(()=>{try{window.localStorage.setItem('stmonicah-attendance-drafts-v1-'+registerDate,JSON.stringify(offlineMarks));}catch{}},[offlineMarks,registerDate]);

 useEffect(()=>{
  const existing=(window as any).Html5Qrcode;if(existing){setScannerLibraryLoaded(true);return;}
  const id='stmonicah-html5-qrcode';let script=document.getElementById(id) as HTMLScriptElement|null;
  const onLoad=()=>setScannerLibraryLoaded(Boolean((window as any).Html5Qrcode));
  const onError=()=>setCameraMessage('The camera scanner library could not load. Use the QR text fallback below and check your internet connection.');
  if(!script){script=document.createElement('script');script.id=id;script.src=scannerLibraryUrl;script.async=true;script.onload=onLoad;script.onerror=onError;document.head.appendChild(script);}
  else{script.addEventListener('load',onLoad);script.addEventListener('error',onError);if((window as any).Html5Qrcode)onLoad();}
  return()=>{script?.removeEventListener('load',onLoad);script?.removeEventListener('error',onError);};
 },[]);

 const attendanceByStudent=useMemo(()=>{
  const map=new Map<string,AttendanceRecord>();records.forEach(record=>{if(!map.has(record.student_id))map.set(record.student_id,record);});return map;
 },[records]);
 const roster=useMemo(()=>{
  const programmeMap=new Map(programmes.map(item=>[item.id,item]));
  return students.filter(student=>[student.first_name,student.middle_name,student.last_name,student.admission_number,programmeMap.get(student.programme_id||'')?.title].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))
   .map(student=>({student,programme:programmeMap.get(student.programme_id||''),record:attendanceByStudent.get(student.id)||null}));
 },[students,programmes,search,attendanceByStudent]);
 const markedCount=students.filter(student=>attendanceByStudent.get(student.id)?.status==='present').length;
 const lateCount=students.filter(student=>attendanceByStudent.get(student.id)?.status==='late').length;
 const notScannedCount=students.filter(student=>!attendanceByStudent.has(student.id)).length;
 const isToday=registerDate===nairobiDate();

 const recordQrAttendance=useCallback(async(raw:string)=>{
  const token=parseQrToken(raw);
  if(!token){setLastScan({error:'This QR code does not contain a valid college passport token. Scan the QR printed on the student passport.'});setError('Unrecognized QR code. Scan the QR printed on a St. Monicah student passport.');return;}
  const now=Date.now();if(lastScannedRef.current.token===token&&now-lastScannedRef.current.at<2200)return;if(processingRef.current)return;
  processingRef.current=true;lastScannedRef.current={token,at:now};setScanBusy(true);setError('');setNotice('');setCameraMessage('QR code detected. Validating the student passport and saving attendance…');
  try{
   const {data,error:e}=await createClient().rpc('record_college_qr_attendance',{p_token:token});if(e)throw e;
   const result=(Array.isArray(data)?data[0]:data) as ScanReceipt|null;if(!result)throw new Error('The attendance service returned no result. Please scan again.');
   setLastScan(result);setCameraMessage(result.already_marked?'Passport QR read successfully. This trainee was already marked present today.':'Passport QR read successfully. Attendance has been saved.');setNotice(result.already_marked?'This trainee is already marked present today. The original arrival time has been kept.':(result.student_name||'Student')+' marked present successfully.');
   await loadRegister(registerDate,false);
  }catch(e:any){const message=e?.message||'The QR scan could not be recorded. Please try again.';setCameraMessage('The QR was read by the camera, but attendance could not be saved. Check the error message and try again.');setLastScan({error:message});setError(message);}
  finally{setScanBusy(false);window.setTimeout(()=>{processingRef.current=false;},700);}
 },[loadRegister,registerDate]);

 useEffect(()=>{
  if(!cameraActive||!scannerLibraryLoaded)return;let cancelled=false;let scanner:any=null;
  async function start(){
   const Html5Qrcode=(window as any).Html5Qrcode;
   if(!Html5Qrcode){setCameraMessage('QR scanner library is not available. Use the manual fallback below.');setCameraActive(false);return;}
   try{
    const supportedQr=(window as any).Html5QrcodeSupportedFormats?.QR_CODE;
    scanner=new Html5Qrcode('attendance-qr-reader',{
      verbose:false,
      useBarCodeDetectorIfSupported:true,
      ...(supportedQr!==undefined?{formatsToSupport:[supportedQr]}:{})
    });scannerRef.current=scanner;
    setCameraMessage('Requesting the rear camera. Allow camera access if your phone asks.');
    await scanner.start(
      {facingMode:{ideal:'environment'}},
      {
        fps:15,
        qrbox:(w:number,h:number)=>{const size=Math.max(140,Math.min(320,Math.floor(Math.min(w,h)*0.88)));return {width:size,height:size};},
        aspectRatio:1.0,
        disableFlip:false,
        videoConstraints:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}
      },
      (decodedText:string)=>{void recordQrAttendance(decodedText);},
      (_decodeError:string)=>{
        const now=Date.now();
        if(now-lastDecodeNoticeRef.current>4500){
          lastDecodeNoticeRef.current=now;
          setCameraMessage('Camera is running but has not read a QR yet. Center the full square code, move the phone closer, avoid glare, and hold still for a moment.');
        }
      }
    );
    if(cancelled){try{await scanner.stop();}catch{}try{scanner.clear();}catch{}return;}
    lastDecodeNoticeRef.current=Date.now();
    setCameraMessage('Camera is on and searching. Hold the full student passport QR close, flat, and centered in the viewfinder.');
   }catch(e:any){
    setCameraMessage(e?.message||'Camera could not start. Allow camera permission and open this page over HTTPS.');setCameraActive(false);
    if(scanner){try{if(scanner.isScanning)await scanner.stop();}catch{}try{scanner.clear();}catch{}}
   }
  }
  void start();
  return()=>{cancelled=true;if(scanner){const stop=async()=>{try{if(scanner.isScanning)await scanner.stop();}catch{}try{scanner.clear();}catch{}};void stop();}if(scannerRef.current===scanner)scannerRef.current=null;};
 },[cameraActive,scannerLibraryLoaded,recordQrAttendance]);

 async function stopCamera(){
  const scanner=scannerRef.current;setCameraActive(false);
  if(scanner){try{if(scanner.isScanning)await scanner.stop();}catch{}try{scanner.clear();}catch{}}
  scannerRef.current=null;setCameraMessage('Camera stopped. Select Start camera when ready to scan the next passport.');
 }
 async function submitManualQr(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!manualQr.trim())return;await recordQrAttendance(manualQr);setManualQr('');}
 async function syncOfflineMarks(){const entries=Object.entries(offlineMarks);if(!entries.length){setNotice('There are no offline roll-call marks to sync.');return;}if(typeof navigator!=='undefined'&&!navigator.onLine){setError('This device is still offline. The draft has been saved on this device.');return;}if(!profile?.id||!profile.active||!allowedRoles.includes(profile.role)){setError('An authorized attendance session is required before syncing. Sign in and reload the register online.');return;}if(!isToday){setError('Only today’s register can be synchronized from the offline roll-call.');return;}setRefreshing(true);setError('');setNotice('');let synced=0,skipped=0;const remaining={...offlineMarks};try{const db=createClient();for(const [studentId,status] of entries){if(!['present','late','absent','excused'].includes(status)){delete (remaining as any)[studentId];continue;}const {data:existing,error:checkError}=await db.from('college_attendance').select('id').eq('student_id',studentId).eq('session_date',registerDate).is('unit_id',null).limit(1).maybeSingle();if(checkError)throw checkError;if(existing){skipped++;delete (remaining as any)[studentId];continue;}const {error:insertError}=await db.from('college_attendance').insert({student_id:studentId,session_date:registerDate,status,recorded_by:profile.id,entry_method:'manual',notes:'Saved offline on device; synchronized by authorized attendance user.'});if(insertError)throw insertError;synced++;delete (remaining as any)[studentId];}setOfflineMarks(remaining);setNotice('Offline sync complete: '+synced+' records saved; '+skipped+' existing records were left unchanged. Any unsynced drafts remain on this device.');await loadRegister(registerDate,false);}catch(e:any){setOfflineMarks(remaining);setError((e?.message||'Could not sync all offline marks.')+' Uncompleted drafts remain saved on this device.');}finally{setRefreshing(false);}}
 function printDailyReport(){setReportPrinting(true);window.setTimeout(()=>window.print(),180);}
 useEffect(()=>{const done=()=>setReportPrinting(false);window.addEventListener('afterprint',done);return()=>window.removeEventListener('afterprint',done)},[]);
 function exportRegister(){
  const lines=[['Date','Admission number','Student name','Programme','Attendance status','Method','Time scanned'],
   ...roster.map(({student,programme,record})=>[registerDate,student.admission_number,[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(' '),programme?.title||'',record?.status||'not_scanned',record?.entry_method||'—',formatTime(record?.scanned_at||record?.created_at)])];
  const csv=lines.map(row=>row.map(csvEscape).join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='st-monicah-attendance-'+registerDate+'.csv';a.click();URL.revokeObjectURL(url);
 }

 return <main className="shell attendance-shell">
  <section className="workspace-topbar no-print"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="attendance"/><div className="topbar-user"><span>{profile?.full_name||'College user'}<small>{profile?.role||''}</small></span><button className="quiet-button" onClick={async()=>{await createClient().auth.signOut();router.replace('/login')}}>Sign out</button></div></section>
  <section className="content attendance-content">
   <header className="workspace-record-header no-print"><div><p className="eyebrow">STUDENT SERVICES / DAILY REGISTER</p><h1>QR Attendance</h1><p className="muted">Scan each trainee’s official passport QR at the gate. Attendance is saved to the college register for the day.</p></div><div className="status"><i/>Daily register</div></header>
   <section className="module-hero attendance-hero no-print"><div className="module-hero-copy"><span className="module-hero-eyebrow">GATE CHECK-IN • PASSPORT QR</span><h2>One scan. Present for today.</h2><p>Use one authorized phone at the entrance. The first valid scan marks the trainee present and records their arrival time.</p><span className="module-hero-tags">Camera scan • Duplicate-safe • Searchable register</span></div><div className="module-hero-orb"><span>▦</span></div></section>
   {error&&<p className="error-message no-print" role="alert">{error}</p>}{notice&&<p className="success-message no-print" role="status">{notice}</p>}
   <div className="attendance-stat-grid no-print"><article className="attendance-stat"><span>Active trainees</span><strong>{students.length}</strong><small>Active student records</small></article><article className="attendance-stat"><span>Present</span><strong>{markedCount}</strong><small>Marked present on selected date</small></article><article className="attendance-stat"><span>Late</span><strong>{lateCount}</strong><small>Existing late records</small></article><article className="attendance-stat"><span>Not marked</span><strong>{notScannedCount}</strong><small>Still not checked in</small></article></div>
   <div className="attendance-main-grid no-print">
    <section className="attendance-panel attendance-scanner-panel">
     <div className="attendance-panel-title"><div><p className="eyebrow">LIVE CAMERA</p><h2>Scan student passport</h2></div><span className={'attendance-live-indicator '+(cameraActive?'on':'')}>{cameraActive?'CAMERA ON':'CAMERA OFF'}</span></div>
     <p className="attendance-help">Open this page on the scanning phone using the college HTTPS website, then allow camera access. Use the phone’s rear camera for the fastest scan.</p>
     <div className={'attendance-scanner-frame '+(cameraActive?'active':'')}><div id="attendance-qr-reader"/>{!cameraActive&&<div className="attendance-camera-placeholder"><span className="attendance-qr-icon">▦</span><strong>Passport QR scanner</strong><small>Camera preview will appear here.</small></div>}</div>
     <p className="attendance-camera-message">{cameraMessage}</p><div className="attendance-scanner-actions">{cameraActive?<button type="button" className="secondary-button" onClick={()=>void stopCamera()}>Stop camera</button>:<button type="button" className="primary-button" disabled={!isToday||scanBusy||!profile||!allowedRoles.includes(profile.role)} onClick={()=>{setError('');setCameraActive(true);}}>{scannerLibraryLoaded?'Start camera scan':'Start camera scan'}</button>}</div>
     {!isToday&&<p className="attendance-warning">You are viewing a past date. Change the date to today to record new gate scans.</p>}
     <div className="attendance-manual-fallback"><strong>Camera unavailable?</strong><p>Paste the full QR verification link or its UUID token here. The system still validates it against an active college passport.</p><form onSubmit={submitManualQr}><input value={manualQr} onChange={e=>setManualQr(e.target.value)} placeholder="Paste passport QR URL or token…" autoComplete="off"/><button className="secondary-button" type="submit" disabled={scanBusy||!manualQr.trim()||!isToday}>Mark present</button></form></div>
     {lastScan&&<div className={'attendance-scan-result '+(lastScan.error?'bad':lastScan.already_marked?'repeat':'good')}><div className="attendance-result-icon">{lastScan.error?'!':'✓'}</div><div><strong>{lastScan.error?'Scan not accepted':lastScan.already_marked?'Already present':'Attendance confirmed'}</strong>{lastScan.error?<p>{lastScan.error}</p>:<><p>{lastScan.student_name} · {lastScan.admission_number}</p><small>{lastScan.programme_title||'Programme not assigned'} · {lastScan.passport_number||'College passport'} · {formatTime(lastScan.scanned_at)}</small></>}</div></div>}
    </section>
    <section className="attendance-panel attendance-register-panel">
     <div className="attendance-panel-title"><div><p className="eyebrow">REGISTER</p><h2>Daily attendance</h2>{offlineMode&&<span className="attendance-warning">OFFLINE DRAFT MODE</span>}</div><div className="attendance-report-actions"><button type="button" className="secondary-button" onClick={exportRegister} disabled={loading||!students.length}>Export CSV</button><button type="button" className="primary-button" onClick={printDailyReport} disabled={loading||!students.length}>Download daily PDF</button><button type="button" className="secondary-button" onClick={()=>void syncOfflineMarks()} disabled={refreshing||!Object.keys(offlineMarks).length||offlineMode||!isToday}>Sync roll-call ({Object.keys(offlineMarks).length})</button></div></div>
     <div className="attendance-register-toolbar"><label>Register date<input type="date" value={registerDate} max={nairobiDate()} onChange={e=>{setCameraActive(false);setOfflineMarks(readAttendanceDraft(e.target.value));setRegisterDate(e.target.value);}}/></label><label className="attendance-search">Search trainee<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or admission no."/></label><button type="button" className="secondary-button attendance-refresh" onClick={()=>void loadRegister(registerDate,false)} disabled={refreshing}>{refreshing?'Refreshing…':'Refresh'}</button></div>
     <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Trainee</th><th>Status</th><th>Arrival</th><th>Offline roll-call</th></tr></thead><tbody>{roster.map(({student,programme,record})=><tr key={student.id}><td><strong>{[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(' ')}</strong><small>{student.admission_number}{programme?.title?' · '+programme.title:''}</small></td><td><span className={'attendance-status-tag '+(record?.status||'not-marked')}>{record?.status==='present'?'Present':record?.status==='late'?'Late':record?.status==='absent'?'Absent':record?.status==='excused'?'Excused':'Not marked'}</span></td><td><span>{formatTime(record?.scanned_at||record?.created_at)}</span><small>{record?.entry_method==='qr'?'QR scan':record?'Manual record':'Awaiting scan'}</small></td><td><select aria-label={'Offline roll-call for '+student.admission_number} value={offlineMarks[student.id]||''} disabled={!isToday||!!record} onChange={e=>setOfflineMarks(prev=>({...prev,[student.id]:e.target.value}))}><option value="">Not drafted</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option><option value="excused">Excused</option></select></td></tr>)}{!loading&&roster.length===0&&<tr><td colSpan={4} className="attendance-empty-cell">No active trainees match this search.</td></tr>}{loading&&<tr><td colSpan={4} className="attendance-empty-cell">Loading daily register…</td></tr>}</tbody></table></div>
     <div className="attendance-register-footer"><span>Showing {roster.length} active trainee{roster.length===1?'':'s'}</span><span>{registerDate} · East Africa Time</span></div>{Object.keys(offlineMarks).length>0&&<p className="attendance-warning">{Object.keys(offlineMarks).length} manual roll-call draft(s) saved on this device. Existing attendance records cannot be overwritten by these drafts.</p>}
    </section>
   </div>
   {reportPrinting&&<article className="attendance-print-report"><header className="attendance-print-brand"><img src={crest} alt="College crest"/><div><h1>St. Monicah Teachers Training College</h1><h2>Daily Student Attendance Report</h2><p>Attendance date: {registerDate} · East Africa Time</p></div></header><div className="attendance-print-summary"><span>Active trainees: <strong>{students.length}</strong></span><span>Present: <strong>{markedCount}</strong></span><span>Late: <strong>{lateCount}</strong></span><span>Not marked: <strong>{notScannedCount}</strong></span></div><table><thead><tr><th>#</th><th>Admission number</th><th>Student name</th><th>Programme</th><th>Status</th><th>Arrival time</th><th>Method</th></tr></thead><tbody>{roster.map(({student,programme,record},index)=><tr key={student.id}><td>{index+1}</td><td>{student.admission_number}</td><td>{[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(' ')}</td><td>{programme?.title||'—'}</td><td>{record?.status||'Not marked'}</td><td>{formatTime(record?.scanned_at||record?.created_at)}</td><td>{record?.entry_method==='qr'?'QR scan':record?'Manual':'—'}</td></tr>)}</tbody></table><footer>Generated from the St. Monicah College ERP · Authorized daily attendance record</footer></article>}
   <footer className="attendance-footer no-print">St. Monicah Teachers Training College <span>Attendance is stored securely in the college database. Repeated QR scans do not create duplicate daily records.</span></footer>
  </section>
 </main>;
}
