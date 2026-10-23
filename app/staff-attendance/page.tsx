'use client';

import {useCallback,useEffect,useMemo,useState,type CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import {createClient} from '@/lib/supabase/client';

type Profile={full_name:string|null;role:string;active:boolean};
type Staff={id:string;staff_number:string;full_name:string;department:string|null;position:string|null;employment_status:string;profile_id:string|null};
type StaffAttendance={id:string;staff_id:string;attendance_date:string;check_in_at:string|null;check_out_at:string|null;check_in_method:string;check_out_method:string|null;check_in_latitude:number|null;check_in_longitude:number|null;check_in_accuracy_m:number|null;check_out_latitude:number|null;check_out_longitude:number|null;check_out_accuracy_m:number|null;status:string;notes:string|null;created_at:string;updated_at:string};
type GeoEvidence={latitude:number;longitude:number;accuracy:number}|null;
type AttendanceSettings={id:string;campus_name:string;campus_latitude:number|null;campus_longitude:number|null;geofence_radius_m:number;geofence_enforced:boolean;late_grace_minutes:number;standard_shift_minutes:number;shifts_enabled:boolean;qr_attendance_enabled:boolean;updated_at:string};
type Shift={id:string;staff_id:string;shift_date:string;starts_at:string;ends_at:string;break_minutes:number;status:string;notes:string|null};
type OfflineEvent={id:string;staffId:string;action:'check_in'|'check_out';queuedAt:string;latitude:number|null;longitude:number|null;accuracy:number|null;note:string};

const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const managerRoles=['super_admin','principal','hr'];
const pageRoles=['super_admin','principal','hr','registrar','hod','lecturer','practice_supervisor'];

function nairobiDate(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return values.year+'-'+values.month+'-'+values.day;
}
function timeLabel(value?:string|null){
 if(!value)return '—';
 const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';
 return d.toLocaleTimeString('en-KE',{timeZone:'Africa/Nairobi',hour:'2-digit',minute:'2-digit',hour12:true});
}
function durationLabel(start?:string|null,end?:string|null){
 if(!start||!end)return 'In progress';
 const mins=Math.max(0,Math.round((new Date(end).getTime()-new Date(start).getTime())/60000));
 return Math.floor(mins/60)+'h '+String(mins%60).padStart(2,'0')+'m';
}
function csvCell(value:unknown){return '"'+String(value??'').replace(/"/g,'""')+'"';}

export default function StaffAttendancePage(){
 const router=useRouter();
 const db=useMemo(()=>createClient(),[]);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [userId,setUserId]=useState('');
 const [staff,setStaff]=useState<Staff[]>([]);
 const [records,setRecords]=useState<StaffAttendance[]>([]);
 const [selectedDate,setSelectedDate]=useState(nairobiDate());
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [settings,setSettings]=useState<AttendanceSettings|null>(null);
 const [campusName,setCampusName]=useState('St. Monicah Teachers Training College');
 const [campusLat,setCampusLat]=useState('');
 const [campusLng,setCampusLng]=useState('');
 const [radius,setRadius]=useState('100');
 const [enforceFence,setEnforceFence]=useState(false);
 const [graceMinutes,setGraceMinutes]=useState('10');
 const [shiftMinutes,setShiftMinutes]=useState('480');
 const [shifts,setShifts]=useState<Shift[]>([]);
 const [shiftStaffId,setShiftStaffId]=useState('');
 const [shiftDate,setShiftDate]=useState(nairobiDate());
 const [shiftStart,setShiftStart]=useState('08:00');
 const [shiftEnd,setShiftEnd]=useState('17:00');
 const [shiftBreak,setShiftBreak]=useState('60');
 const [shiftNote,setShiftNote]=useState('');
 const [offlineQueue,setOfflineQueue]=useState<OfflineEvent[]>([]);
 const [qrStaffId,setQrStaffId]=useState('');
 const [issuedBadge,setIssuedBadge]=useState<{staffName:string;staffNo:string;token:string;expiresAt:string}|null>(null);
 const [reviewAlerts,setReviewAlerts]=useState(true);

 const loadRegister=useCallback(async(date=selectedDate)=>{
  setLoading(true);setError('');
  try{
   const {data:{session},error:sessionError}=await db.auth.getSession();
   if(sessionError)throw sessionError;
   if(!session){router.replace('/login');return;}
   setUserId(session.user.id);
   const {data:p,error:profileError}=await db.from('college_profiles').select('full_name,role,active').eq('id',session.user.id).maybeSingle();
   if(profileError)throw profileError;
   if(!p?.active){router.replace('/login');return;}
   setProfile(p as Profile);
   if(!pageRoles.includes(p.role)){setStaff([]);setRecords([]);setError('Your account does not have permission to access staff attendance.');return;}
   const [staffRes,attendanceRes]=await Promise.all([
    db.from('college_staff').select('id,staff_number,full_name,department,position,employment_status,profile_id').eq('employment_status','active').order('full_name').limit(2000),
    db.from('college_staff_attendance').select('*').eq('attendance_date',date).order('check_in_at',{ascending:false,nullsFirst:false}).limit(2000)
   ]);
   if(staffRes.error)throw staffRes.error;
   if(attendanceRes.error)throw attendanceRes.error;
   setStaff((staffRes.data||[]) as Staff[]);
   setRecords((attendanceRes.data||[]) as StaffAttendance[]);
   const [settingsRes,shiftsRes]=await Promise.all([
    db.from('college_attendance_settings').select('*').order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('college_staff_shifts').select('*').eq('shift_date',date).neq('status','cancelled').limit(2000)
   ]);
   if(settingsRes.error)throw settingsRes.error;
   if(shiftsRes.error)throw shiftsRes.error;
   if(settingsRes.data){
    const s=settingsRes.data as AttendanceSettings;setSettings(s);setCampusName(s.campus_name);setCampusLat(s.campus_latitude==null?'':String(s.campus_latitude));setCampusLng(s.campus_longitude==null?'':String(s.campus_longitude));setRadius(String(s.geofence_radius_m));setEnforceFence(s.geofence_enforced);setGraceMinutes(String(s.late_grace_minutes));setShiftMinutes(String(s.standard_shift_minutes));
   }
   setShifts((shiftsRes.data||[]) as Shift[]);
   try{const raw=window.localStorage.getItem('stmonicah_staff_attendance_offline_queue');setOfflineQueue(raw?JSON.parse(raw):[]);}catch{setOfflineQueue([]);}

  }catch(e:any){setError(e?.message||'Could not load the staff attendance register.');}
  finally{setLoading(false);}
 },[db,router,selectedDate]);

 useEffect(()=>{void loadRegister(selectedDate);},[loadRegister,selectedDate]);
 const canManage=!!profile&&managerRoles.includes(profile.role);
 const isToday=selectedDate===nairobiDate();
 const myStaff=staff.find(s=>s.profile_id===userId)||null;
 const myRecord=records.find(r=>r.staff_id===myStaff?.id)||null;
 const register=useMemo(()=>staff.filter(s=>[s.full_name,s.staff_number,s.department,s.position].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())).map(member=>({member,record:records.find(r=>r.staff_id===member.id)||null})),[staff,records,search]);
 const checkedIn=records.filter(r=>!!r.check_in_at).length;
 const checkedOut=records.filter(r=>!!r.check_out_at).length;
 const notArrived=Math.max(0,staff.length-checkedIn);

 async function requestLocation():Promise<GeoEvidence>{
  if(!('geolocation' in navigator))return null;
  return new Promise(resolve=>{
   navigator.geolocation.getCurrentPosition(
    position=>resolve({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy}),
    ()=>resolve(null),
    {enableHighAccuracy:true,timeout:6000,maximumAge:0}
   );
  });
 }

 async function recordAction(member:Staff,action:'check_in'|'check_out'){
  setError('');setNotice('');
  if(!isToday){setError('Attendance actions are only available for today. Select today’s date to check staff in or out.');return;}
  const isOwn=member.profile_id===userId;
  if(!canManage&&!isOwn){setError('You can only record attendance for your own linked staff account.');return;}
  setBusy(member.id+':'+action);
  try{
   const geo:GeoEvidence=!canManage?await requestLocation():null;
   const method=canManage?'manual':'self_service';
   const {data,error:rpcError}=await db.rpc('college_record_staff_attendance',{
    p_staff_id:member.id,p_action:action,p_method:method,
    p_latitude:geo?.latitude??null,p_longitude:geo?.longitude??null,p_accuracy_m:geo?.accuracy??null,p_note:null
   });
   if(rpcError)throw rpcError;
   const saved=(Array.isArray(data)?data[0]:data) as StaffAttendance;
   const time=action==='check_in'?saved.check_in_at:saved.check_out_at;
   setNotice(member.full_name+' '+(action==='check_in'?'checked in':'checked out')+' at '+timeLabel(time)+'.'+(!canManage&&!geo?' Location was not captured; attendance was still recorded.':geo?' One-time GPS evidence saved.':''));
   await loadRegister(selectedDate);
  }catch(e:any){setError(e?.message||'Could not save staff attendance.');}
  finally{setBusy('');}
 }

 async function saveAttendanceSettings(){
  setError('');setNotice('');setBusy('settings');
  try{
   const {data,error:rpcError}=await db.rpc('college_save_attendance_settings',{p_campus_name:campusName,p_latitude:campusLat.trim()?Number(campusLat):null,p_longitude:campusLng.trim()?Number(campusLng):null,p_radius_m:Number(radius),p_enforce:enforceFence,p_grace_minutes:Number(graceMinutes),p_shift_minutes:Number(shiftMinutes)});
   if(rpcError)throw rpcError;
   setSettings(data as AttendanceSettings);setNotice('Attendance security and shift settings saved.');
   await loadRegister(selectedDate);
  }catch(e:any){setError(e?.message||'Could not save attendance settings.');}
  finally{setBusy('');}
 }
 async function saveShift(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setNotice('');setBusy('shift');
  try{
   const {data,error:rpcError}=await db.rpc('college_create_staff_shift',{p_staff_id:shiftStaffId,p_shift_date:shiftDate,p_starts_at:shiftStart,p_ends_at:shiftEnd,p_break_minutes:Number(shiftBreak),p_notes:shiftNote||null});
   if(rpcError)throw rpcError;
   setNotice('Shift saved. Late status will use this scheduled start and the grace period.');
   setShiftNote('');await loadRegister(selectedDate);
  }catch(e:any){setError(e?.message||'Could not save shift.');}
  finally{setBusy('');}
 }
 function queueOffline(member:Staff,action:'check_in'|'check_out',geo:GeoEvidence){
  const event:OfflineEvent={id:crypto.randomUUID(),staffId:member.id,action,queuedAt:new Date().toISOString(),latitude:geo?.latitude??null,longitude:geo?.longitude??null,accuracy:geo?.accuracy??null,note:'Queued while offline'};
  const next=[...offlineQueue,event];setOfflineQueue(next);window.localStorage.setItem('stmonicah_staff_attendance_offline_queue',JSON.stringify(next));
  setNotice('Attendance action queued on this device. It has not yet been saved to the college database.');
 }
 async function syncOfflineQueue(){
  if(!navigator.onLine){setError('Reconnect to the internet before syncing the offline queue.');return;}
  setBusy('offline-sync');setError('');setNotice('');
  const remaining:OfflineEvent[]=[];let synced=0;
  for(const item of offlineQueue){
   try{
    const {error:rpcError}=await db.rpc('college_record_staff_attendance',{p_staff_id:item.staffId,p_action:item.action,p_method:'offline_sync',p_latitude:item.latitude,p_longitude:item.longitude,p_accuracy_m:item.accuracy,p_note:'Offline action queued at '+item.queuedAt});
    if(rpcError)throw rpcError;synced++;
   }catch{remaining.push(item);}
  }
  setOfflineQueue(remaining);window.localStorage.setItem('stmonicah_staff_attendance_offline_queue',JSON.stringify(remaining));
  setNotice(synced+' queued action(s) synchronized. '+remaining.length+' remain pending. Database time is the sync time; original queued time is preserved in the note.');
  await loadRegister(selectedDate);setBusy('');
 }
 async function issueStaffBadge(){
  setError('');setNotice('');setIssuedBadge(null);
  const member=staff.find(s=>s.id===qrStaffId);if(!member){setError('Select a staff member first.');return;}
  setBusy('badge');
  try{
   const token=crypto.randomUUID()+'-'+crypto.randomUUID();
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
   const tokenHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
   const expiresAt=new Date(Date.now()+365*24*60*60*1000).toISOString();
   const {error:saveError}=await db.from('college_staff_attendance_qr').insert({staff_id:member.id,token_hash:tokenHash,expires_at:expiresAt,created_by:userId});
   if(saveError)throw saveError;
   setIssuedBadge({staffName:member.full_name,staffNo:member.staff_number,token,expiresAt});
   setNotice('A unique staff attendance credential has been issued. The raw token is shown once; keep it private.');
  }catch(e:any){setError(e?.message||'Could not issue staff credential.');}
  finally{setBusy('');}
 }
 function printBadge(){
  if(!issuedBadge)return;
  const win=window.open('','_blank','width=500,height=650');if(!win){setError('Allow pop-ups to print the staff badge.');return;}
  win.document.write('<!doctype html><html><head><title>Staff Attendance Badge</title><style>body{font-family:Arial;padding:24px;color:#641c35}.card{border:2px solid #641c35;border-radius:18px;padding:24px;text-align:center}small{color:#806b74}code{display:block;word-break:break-all;color:#222;font-size:11px;margin:18px 0}</style></head><body><div class="card"><h2>ST. MONICAH</h2><p>TEACHERS TRAINING COLLEGE</p><hr/><h3>'+issuedBadge.staffName.replace(/[&<>"]/g,'')+'</h3><p>'+issuedBadge.staffNo.replace(/[&<>"]/g,'')+'</p><small>Staff attendance credential — private</small><code>'+issuedBadge.token+'</code><small>Expires '+new Date(issuedBadge.expiresAt).toLocaleDateString()+'</small></div><script>window.print()<\\/script></body></html>');win.document.close();
 }
 function exportCsv(){
  const rows=[['Date','Staff number','Staff name','Department','Position','Check-in','Check-in method','Check-out','Check-out method','Hours','Status','Location evidence'],
   ...register.map(({member,record})=>[selectedDate,member.staff_number,member.full_name,member.department||'',member.position||'',record?timeLabel(record.check_in_at):'',record?.check_in_method||'',record?timeLabel(record.check_out_at):'',record?.check_out_method||'',durationLabel(record?.check_in_at,record?.check_out_at),record?(record.check_out_at?'Shift completed':record.check_in_at?'On campus':record.status):'Not checked in',record?.check_in_latitude!=null?'GPS captured':''])];
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='st-monicah-staff-attendance-'+selectedDate+'.csv';a.click();URL.revokeObjectURL(url);
 }

 const statCard:CSSProperties={border:'1px solid #eadde1',borderRadius:18,padding:'18px 20px',background:'#fff',minWidth:0};
 const buttonStyle:CSSProperties={border:0,borderRadius:10,background:'#641c35',color:'#fff',padding:'10px 13px',fontWeight:750,cursor:'pointer'};
 const secondaryStyle:CSSProperties={border:'1px solid #d9c4cb',borderRadius:10,background:'#fff',color:'#641c35',padding:'9px 12px',fontWeight:700,cursor:'pointer'};

 return <main className="staff-attendance-page">
  <section className="staff-topbar">
   <a className="staff-brand" href="/"><img src={crest} alt="College crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
   <ErpNavigation active="people"/>
   <div className="staff-user"><span>{profile?.full_name||'College user'}<small>{profile?.role||''}</small></span><button style={secondaryStyle} onClick={async()=>{await db.auth.signOut();router.replace('/login');}}>Sign out</button></div>
  </section>
  <section className="staff-content">
   <header className="staff-page-heading"><div><p className="staff-eyebrow">HUMAN RESOURCES / TIME & ATTENDANCE</p><h1>Staff Attendance</h1><p className="staff-muted">A separate staff register for daily check-in, check-out, hours worked and attendance evidence. Student attendance stays separate.</p></div><div className="staff-live-pill"><span/> STAFF REGISTER</div></header>

   {error&&<div className="staff-alert bad" role="alert">{error}</div>}
   {notice&&<div className="staff-alert good" role="status">{notice}</div>}

   {myStaff&&<section className="staff-self-card">
    <div className="staff-self-copy"><span className="staff-eyebrow">YOUR ATTENDANCE</span><h2>Hello, {myStaff.full_name}</h2><p>{myStaff.staff_number} · {myStaff.department||myStaff.position||'College staff'}</p><small>Location permission is requested only when you tap a check-in or check-out button. If unavailable, attendance can still be recorded.</small></div>
    <div className="staff-self-state"><span className={'staff-state-dot '+(myRecord?.check_in_at&&!myRecord?.check_out_at?'on':'')}/><strong>{!myRecord?'Not checked in':myRecord.check_out_at?'Shift completed':'Currently checked in'}</strong><small>{myRecord?.check_in_at?'In '+timeLabel(myRecord.check_in_at):'No check-in recorded today'}</small></div>
    <div className="staff-self-actions">
     <button style={buttonStyle} disabled={!isToday||!!busy||!!myRecord} onClick={()=>void recordAction(myStaff,'check_in')}>{busy===myStaff.id+':check_in'?'Saving…':'Check in'}</button>
     <button style={secondaryStyle} disabled={!isToday||!!busy||!myRecord?.check_in_at||!!myRecord.check_out_at} onClick={()=>void recordAction(myStaff,'check_out')}>{busy===myStaff.id+':check_out'?'Saving…':'Check out'}</button>
    </div>
   </section>}

   {!canManage&&!myStaff&&!error&&<div className="staff-alert warn">Your login is not yet linked to a staff record. Ask HR or the super admin to link your account in Staff Records before using self-service attendance.</div>}

   <div className="staff-stat-grid">
    <article style={statCard}><span>Active staff</span><strong>{staff.length}</strong><small>Active staff records visible to your account</small></article>
    <article style={statCard}><span>Checked in</span><strong>{checkedIn}</strong><small>Attendance started today / selected date</small></article>
    <article style={statCard}><span>Shift completed</span><strong>{checkedOut}</strong><small>Staff with a recorded check-out</small></article>
    <article style={statCard}><span>Not checked in</span><strong>{notArrived}</strong><small>No check-in on the selected date</small></article>
   </div>

   <section className="staff-register-panel">
    <div className="staff-register-title"><div><p className="staff-eyebrow">LIVE REGISTER</p><h2>Daily staff register</h2><p className="staff-muted">Use the staff member’s own login for self-service, or mark attendance here if you are HR, principal or super admin.</p></div><div className="staff-report-buttons"><button style={secondaryStyle} onClick={()=>void loadRegister(selectedDate)} disabled={loading}>Refresh</button><button style={buttonStyle} onClick={exportCsv} disabled={loading||!staff.length}>Export CSV</button></div></div>
    <div className="staff-register-tools"><label>Date<input type="date" value={selectedDate} max={nairobiDate()} onChange={e=>setSelectedDate(e.target.value)}/></label><label className="staff-search">Search staff<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, staff number or department"/></label><span className="staff-date-hint">{isToday?'Today · East Africa Time':'Historical view · actions disabled'}</span></div>
    <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Staff member</th><th>Status</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Location evidence</th>{canManage&&<th>Action</th>}</tr></thead><tbody>
     {register.map(({member,record})=>{
      const own=member.profile_id===userId;const canAct=canManage||own;const status=!record?'Not checked in':record.check_out_at?'Shift completed':'On campus';
      return <tr key={member.id}>
       <td><strong>{member.full_name}</strong><small>{member.staff_number} · {[member.position,member.department].filter(Boolean).join(' · ')||'College staff'}</small></td>
       <td><span className={'staff-status '+(!record?'empty':record.check_out_at?'complete':'present')}>{status}</span></td>
       <td><strong>{timeLabel(record?.check_in_at)}</strong><small>{record?.check_in_method?.replace('_',' ')||'—'}</small></td>
       <td><strong>{timeLabel(record?.check_out_at)}</strong><small>{record?.check_out_method?.replace('_',' ')||'—'}</small></td>
       <td>{durationLabel(record?.check_in_at,record?.check_out_at)}</td>
       <td>{record?.check_in_latitude!=null?<span className="staff-gps">GPS captured{record.check_in_accuracy_m!=null?' · ±'+Math.round(record.check_in_accuracy_m)+'m':''}</span>:<span className="staff-muted">Not captured</span>}</td>
       {canManage&&<td><div className="staff-row-actions"><button style={secondaryStyle} disabled={!isToday||!!busy||!canAct||!!record} onClick={()=>void recordAction(member,'check_in')}>{busy===member.id+':check_in'?'Saving…':'Check in'}</button><button style={secondaryStyle} disabled={!isToday||!!busy||!canAct||!record?.check_in_at||!!record.check_out_at} onClick={()=>void recordAction(member,'check_out')}>{busy===member.id+':check_out'?'Saving…':'Check out'}</button></div></td>}
      </tr>;
     })}
     {!loading&&register.length===0&&<tr><td colSpan={canManage?7:6} className="staff-empty">No active staff match the current search.</td></tr>}
     {loading&&<tr><td colSpan={canManage?7:6} className="staff-empty">Loading staff register…</td></tr>}
    </tbody></table></div>
    <footer className="staff-register-footer"><span>{register.length} staff records shown</span><span>Attendance date: {selectedDate} · Kenya time</span></footer>
   </section>

   <section className="staff-modern-strip"><div className="staff-modern-icon">⌖</div><div><strong>One-time location evidence</strong><p>Self-service check-in/out can store GPS coordinates and accuracy when the staff member grants browser permission. This version records the location evidence but does not enforce a campus radius yet; that requires the college’s exact campus coordinates and approved radius.</p></div><div className="staff-modern-tag">PRIVACY-AWARE</div></section>
   <footer className="staff-page-footer">St. Monicah Teachers Training College · Staff attendance register · Student attendance data is not used on this page.</footer>
  </section>
  <style jsx global>{`
   .staff-attendance-page{min-height:100vh;background:#f7f3f4;color:#28212a;font-family:Arial,Helvetica,sans-serif}
   .staff-topbar{background:#fff;border-bottom:1px solid #e9dfe2;padding:13px clamp(14px,3vw,38px);display:flex;align-items:center;gap:24px;flex-wrap:wrap}
   .staff-brand{display:flex;align-items:center;gap:10px;color:#641c35;text-decoration:none;flex-shrink:0}
   .staff-brand img{width:44px;height:44px;object-fit:contain}.staff-brand span{display:flex;flex-direction:column;gap:3px}.staff-brand strong{font-size:14px;letter-spacing:.06em}.staff-brand small{font-size:9px;color:#876c77;letter-spacing:.12em}
   .staff-topbar .erp-navigation{flex:1;min-width:240px}.staff-user{display:flex;align-items:center;gap:12px;margin-left:auto}.staff-user span{display:flex;flex-direction:column;font-size:12px;font-weight:700}.staff-user small{margin-top:3px;color:#8b7480;font-size:10px;font-weight:500}
   .staff-content{max-width:1540px;margin:auto;padding:clamp(16px,3vw,34px)}
   .staff-page-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:6px 0 24px}.staff-page-heading h1{margin:5px 0;font-size:clamp(28px,3vw,38px);color:#641c35;letter-spacing:-.035em}.staff-page-heading p{max-width:760px;line-height:1.55}
   .staff-eyebrow{font-size:10px;font-weight:800;color:#9a7750;letter-spacing:.16em;margin:0 0 7px}.staff-muted{color:#816f78;font-size:13px;line-height:1.5}
   .staff-live-pill{border:1px solid #dbc5cc;background:#fff8fa;color:#641c35;border-radius:99px;padding:9px 12px;white-space:nowrap;font-weight:800;font-size:10px;letter-spacing:.09em;display:flex;align-items:center;gap:8px}.staff-live-pill span{width:7px;height:7px;border-radius:50%;background:#2d8c5a}
   .staff-alert{padding:12px 15px;border-radius:12px;margin:0 0 18px;font-size:13px;line-height:1.5}.staff-alert.bad{background:#fff0f1;color:#9b263d;border:1px solid #f2c6cd}.staff-alert.good{background:#eef9f1;color:#24613b;border:1px solid #c9e9d1}.staff-alert.warn{background:#fff8e9;color:#77551a;border:1px solid #ead9ad}
   .staff-self-card{background:linear-gradient(115deg,#641c35,#3d1426);color:white;border-radius:20px;padding:22px 24px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(170px,.7fr) auto;gap:22px;align-items:center;margin:0 0 20px;box-shadow:0 12px 30px #641c3514}
   .staff-self-copy .staff-eyebrow{color:#e2c17b}.staff-self-copy h2{font-size:22px;margin:0 0 6px}.staff-self-copy p{font-size:12px;color:#f0dfe5;margin:0 0 12px}.staff-self-copy small{font-size:11px;line-height:1.45;color:#decbd2;display:block;max-width:510px}
   .staff-self-state{border-left:1px solid #a77a89;padding-left:20px;display:grid;gap:6px}.staff-self-state strong{font-size:13px}.staff-self-state small{color:#e1cbd3;font-size:11px}.staff-state-dot{width:9px;height:9px;border-radius:50%;background:#d9ad67}.staff-state-dot.on{background:#68d59a}
   .staff-self-actions{display:flex;gap:9px;flex-wrap:wrap}.staff-self-actions button:last-child{background:#fff!important}
   .staff-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}.staff-stat-grid article{box-shadow:0 7px 18px #311b2406}.staff-stat-grid span{display:block;color:#806a75;font-size:12px;font-weight:700}.staff-stat-grid strong{display:block;color:#641c35;font-size:29px;margin:7px 0 4px;line-height:1}.staff-stat-grid small{font-size:10px;color:#a08b95;line-height:1.4}
   .staff-register-panel{background:#fff;border:1px solid #eadde1;border-radius:18px;padding:clamp(14px,2vw,22px);box-shadow:0 9px 25px #311b2406}.staff-register-title{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.staff-register-title h2{font-size:22px;color:#641c35;margin:0 0 5px}.staff-register-title p{margin:0}.staff-report-buttons{display:flex;gap:8px;flex-wrap:wrap}
   .staff-register-tools{display:flex;gap:12px;align-items:end;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid #f0e7ea}.staff-register-tools label{font-size:11px;font-weight:800;color:#806a75;display:grid;gap:6px}.staff-register-tools input{border:1px solid #e1d2d8;background:#fff;border-radius:9px;padding:10px 11px;color:#342630;min-height:39px}.staff-register-tools .staff-search{flex:1;min-width:220px}.staff-date-hint{font-size:11px;color:#9a7b87;padding-bottom:11px}
   .staff-table-wrap{overflow:auto}.staff-table{width:100%;border-collapse:collapse;min-width:860px}.staff-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#967984;background:#fbf7f8;padding:12px 10px;white-space:nowrap}.staff-table td{padding:13px 10px;border-bottom:1px solid #f1e8eb;font-size:12px;vertical-align:middle}.staff-table td strong{display:block;color:#3a2932}.staff-table td small{display:block;margin-top:5px;color:#9a858e;font-size:10px;line-height:1.35}.staff-status{display:inline-flex;border-radius:50px;padding:6px 8px;white-space:nowrap;font-size:10px;font-weight:800}.staff-status.empty{background:#f3eff1;color:#7e6a73}.staff-status.present{background:#eaf8ef;color:#25673f}.staff-status.complete{background:#eaf3fb;color:#245b86}.staff-gps{color:#287044;font-weight:700;font-size:11px;white-space:nowrap}.staff-row-actions{display:flex;gap:6px;min-width:190px}.staff-row-actions button{font-size:10px!important;padding:7px 9px!important}.staff-row-actions button:disabled{opacity:.35;cursor:not-allowed}.staff-empty{text-align:center;padding:34px!important;color:#a08b95}.staff-register-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:13px;color:#9a858e;font-size:10px}
   .staff-modern-strip{display:flex;align-items:center;gap:16px;border:1px solid #e6d6b9;background:#fffaf0;border-radius:15px;padding:16px 20px;margin-top:18px}.staff-modern-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#f0e2bf;color:#7e5b14;font-size:22px;flex-shrink:0}.staff-modern-strip strong{color:#614416;font-size:12px}.staff-modern-strip p{margin:5px 0 0;font-size:11px;line-height:1.5;color:#806d4d}.staff-modern-tag{margin-left:auto;border:1px solid #e3d0a7;color:#806022;padding:6px 9px;border-radius:99px;font-size:9px;font-weight:800;letter-spacing:.08em;white-space:nowrap}
   .staff-page-footer{text-align:center;padding:22px 0;color:#a28d96;font-size:10px}.staff-attendance-page button:disabled{opacity:.5;cursor:not-allowed}
   @media(max-width:1000px){.staff-topbar{gap:12px}.staff-topbar .erp-navigation{order:3;flex-basis:100%}.staff-self-card{grid-template-columns:1fr 1fr}.staff-self-actions{grid-column:1/-1}.staff-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:620px){.staff-topbar{padding:12px}.staff-user{margin-left:auto}.staff-user span{display:none}.staff-page-heading{flex-direction:column}.staff-self-card{grid-template-columns:1fr;padding:18px}.staff-self-state{border-left:0;border-top:1px solid #a77a89;padding:14px 0 0}.staff-self-actions button{flex:1}.staff-stat-grid{gap:9px}.staff-stat-grid article{padding:13px!important}.staff-register-title{flex-direction:column}.staff-register-tools label,.staff-register-tools input{width:100%}.staff-date-hint{padding:0}.staff-modern-strip{align-items:flex-start;flex-wrap:wrap}.staff-modern-tag{margin-left:56px}.staff-content{padding:14px}.staff-register-panel{padding:13px}}
   @media print{.staff-topbar,.staff-page-heading,.staff-self-card,.staff-stat-grid,.staff-register-tools,.staff-report-buttons,.staff-modern-strip,.staff-page-footer,.staff-alert,.staff-row-actions{display:none!important}.staff-attendance-page{background:white}.staff-content{padding:0}.staff-register-panel{border:0;box-shadow:none;padding:0}.staff-table{min-width:0}.staff-table th,.staff-table td{font-size:9px;padding:6px}}
  `}</style>
 </main>;
}
