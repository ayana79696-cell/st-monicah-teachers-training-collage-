'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
import OfficialStudentPassport from '@/components/OfficialStudentPassport';

type Student={id:string;admission_number:string;first_name:string;middle_name?:string|null;last_name:string;programme_id?:string|null;intake?:string|null;intake_year?:number|null;status:string;email?:string|null;phone?:string|null;date_of_birth?:string|null;gender?:string|null;home_address?:string|null;national_id_number?:string|null};
type Programme={id:string;title:string;code:string};
type Passport={id:string;student_id:string;passport_number:string;verification_token:string;status:string;issued_at:string;expires_at?:string|null;photo_url?:string|null;authorized_signature_data_url?:string|null};
type AdmissionApp={id:string;email:string|null;first_name:string;last_name:string;status:string;documents:any[]|null};
const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
function formatAdmission(value:string){const match=value.match(/^(?:PASS\s*)?(\d+)$/i);return match?String(Number(match[1])).padStart(3,'0'):value;}

export default function PassportStudio(){
 const router=useRouter();
 const [students,setStudents]=useState<Student[]>([]);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [passports,setPassports]=useState<Passport[]>([]);
 const [admissionApps,setAdmissionApps]=useState<AdmissionApp[]>([]);
 const [applicantSignature,setApplicantSignature]=useState('');
 const [profile,setProfile]=useState<any>(null);
 const [selected,setSelected]=useState('');const [editStudent,setEditStudent]=useState({first_name:'',middle_name:'',last_name:'',admission_number:'',email:'',phone:'',date_of_birth:'',gender:'',home_address:'',national_id_number:'',programme_id:'',intake:'',intake_year:''});
 const [search,setSearch]=useState('');
 const [expiry,setExpiry]=useState('');
 const [photo,setPhoto]=useState('');
 const [photoPreview,setPhotoPreview]=useState('');
 const [photoUploading,setPhotoUploading]=useState(false);
 const [busy,setBusy]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=useCallback(async()=>{
   setBusy(true);setError('');
   try{
     const db=createClient();const {data:{session}}=await db.auth.getSession();
     if(!session){router.replace('/login');return;}
     const {data:p,error:pe}=await db.from('college_profiles').select('full_name,role,active').eq('id',session.user.id).maybeSingle();
     if(pe)throw pe;if(!p?.active){router.replace('/');return;}setProfile(p);
     const [{data:ss,error:se},{data:pp,error:pge},{data:ps,error:pse},{data:apps,error:ae}]=await Promise.all([
       db.from('college_students').select('*').order('last_name').limit(1000),
       db.from('college_programmes').select('id,title,code').order('title').limit(500),
       db.from('college_student_passports').select('id,student_id,passport_number,verification_token,status,issued_at,expires_at,photo_url,authorized_signature_data_url').limit(1000),
       db.from('college_admissions_applications').select('id,email,first_name,last_name,status,documents').eq('status','converted').limit(1000)
     ]);
     if(se)throw se;if(pge)throw pge;if(pse)throw pse;if(ae)throw ae;
     setStudents(ss||[]);setProgrammes(pp||[]);setPassports(ps||[]);setAdmissionApps((apps||[]) as AdmissionApp[]);
   }catch(e:any){setError(e?.message||'Unable to load passport records.');}finally{setBusy(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 const [signaturePreview,setSignaturePreview]=useState('');
 const [signaturePadOpen,setSignaturePadOpen]=useState(false);
 const signatureCanvasRef = useState<HTMLCanvasElement|null>(null);
 const [signatureCanvas,setSignatureCanvas]=useState<HTMLCanvasElement|null>(null);
 useEffect(()=>{try{const saved=window.localStorage.getItem('stmonicah-passport-signature');if(saved)setSignaturePreview(saved);}catch{}},[]);
 function saveDrawnSignature(){
   if(!signatureCanvas){setError('Signature pad is not ready yet.');return;}
   const ctx=signatureCanvas.getContext('2d');
   if(!ctx)return;
   const pixels=ctx.getImageData(0,0,signatureCanvas.width,signatureCanvas.height).data;
   let ink=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]>0){ink=true;break;}}
   if(!ink){setError('Please sign in the box first.');return;}
   const value=signatureCanvas.toDataURL('image/png');
   setSignaturePreview(value);
   try{window.localStorage.setItem('stmonicah-passport-signature',value);setNotice('Handwritten signature saved in this browser and added to the passport preview.');setSignaturePadOpen(false);}
   catch{setError('Could not save the signature in this browser.');}
 }
 function clearSignaturePad(){
   if(signatureCanvas){const ctx=signatureCanvas.getContext('2d');ctx?.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);}
 }
 function removeSignature(){
   setSignaturePreview('');
   try{window.localStorage.removeItem('stmonicah-passport-signature');}catch{}
 }

 useEffect(()=>{
   if(!photo){setPhotoPreview('');return;}
   if(/^https?:\/\//i.test(photo)){setPhotoPreview(photo);return;}
   let cancelled=false;
   const db=createClient();
   void db.storage.from('student-passport-photos').createSignedUrl(photo,3600).then(({data,error})=>{
     if(!cancelled)setPhotoPreview(error?'':data?.signedUrl||'');
   });
   return ()=>{cancelled=true;};
 },[photo]);
 const filtered=useMemo(()=>students.filter(s=>[s.first_name,s.middle_name,s.last_name,s.admission_number].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())),[students,search]);
 const student=students.find(s=>s.id===selected);
 const passport=passports.find(p=>p.student_id===selected);
 const programme=programmes.find(p=>p.id===student?.programme_id);
 const matchingApplication=student?admissionApps.find(a=>(a.email&&student.email&&a.email.toLowerCase()===student.email.toLowerCase())||(a.first_name?.toLowerCase()===student.first_name?.toLowerCase()&&a.last_name?.toLowerCase()===student.last_name?.toLowerCase())):undefined;
 useEffect(()=>{let active=true;setApplicantSignature('');const doc=matchingApplication?.documents?.find((d:any)=>String(d?.name||'').toLowerCase().includes('applicant-signature')&&d?.path);if(doc?.path){void createClient().storage.from('admissions-documents').createSignedUrl(doc.path,3600).then(({data,error})=>{if(active&&!error)setApplicantSignature(data?.signedUrl||'')});}return()=>{active=false}},[matchingApplication?.id]);
 useEffect(()=>{if(!passport?.id||!signaturePreview||passport.authorized_signature_data_url===signaturePreview)return;let active=true;void createClient().from('college_student_passports').update({authorized_signature_data_url:signaturePreview}).eq('id',passport.id).then(({error})=>{if(!active)return;if(error){setError('Could not sync the authorized signature to the official passport. '+error.message);return;}setPassports(list=>list.map(row=>row.id===passport.id?{...row,authorized_signature_data_url:signaturePreview}:row));});return()=>{active=false}},[passport?.id,passport?.authorized_signature_data_url,signaturePreview]);
 const fullName=student?[student.first_name,student.middle_name,student.last_name].filter(Boolean).join(' '):'';
 const verifyUrl=passport&&typeof window!=='undefined'?window.location.origin+'/verify-passport?token='+encodeURIComponent(passport.verification_token):'';
 const qrUrl=verifyUrl?'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data='+encodeURIComponent(verifyUrl):'';
 async function uploadPhoto(file?:File){
   if(!file)return;
   if(!student){setError('Choose a student before adding a photo.');return;}
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPG, PNG or WebP image.');return;}
   if(file.size>8*1024*1024){setError('Choose an image smaller than 8 MB.');return;}
   setPhotoUploading(true);setError('');setNotice('');
   try{
     const bitmap=await createImageBitmap(file);
     const scale=Math.min(1,600/bitmap.width,800/bitmap.height);
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(bitmap.width*scale));
     canvas.height=Math.max(1,Math.round(bitmap.height*scale));
     const context=canvas.getContext('2d');
     if(!context)throw new Error('This browser could not prepare the photo.');
     context.drawImage(bitmap,0,0,canvas.width,canvas.height);
     bitmap.close();
     const blob:Blob=await new Promise((resolve,reject)=>canvas.toBlob(
       result=>result?resolve(result):reject(new Error('Could not process the selected photo.')),
       'image/jpeg',0.84
     ));
     if(blob.size>2*1024*1024)throw new Error('The compressed photo is still too large. Choose another image.');
     const db=createClient();
     const path=student.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.jpg';
     const {error:uploadError}=await db.storage.from('student-passport-photos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
     if(uploadError)throw uploadError;
     setPhoto(path);
     setNotice('Photo uploaded securely. Generate or reissue the passport to save it to the ID.');
   }catch(e:any){setError(e?.message||'Photo upload failed.');}
   finally{setPhotoUploading(false);}
 }
 async function saveStudentDetails(){
 if(!student){setError('Choose a student first.');return;}
 if(!editStudent.first_name.trim()||!editStudent.last_name.trim()||!editStudent.admission_number.trim()){setError('First name, last name and admission number are required.');return;}
 setSaving(true);setError('');setNotice('');
 try{
  const db=createClient();
  const payload={...editStudent,admission_number:editStudent.admission_number.trim(),intake_year:editStudent.intake_year?Number(editStudent.intake_year):null};
  const {error:e}=await db.from('college_students').update(payload).eq('id',student.id);
  if(e)throw e;
  setNotice('Student details updated successfully.');
  await load();
 }catch(e:any){setError(e?.message||'Could not update student details. Check the required fields and permissions.');}
 finally{setSaving(false);}
}
async function issue(){
   if(!student){setError('Choose a student first.');return;}
   setSaving(true);setError('');setNotice('');
   try{
     const db=createClient();const existing=passports.find(p=>p.student_id===student.id);
     const payload={status:'active',issued_at:new Date().toISOString().slice(0,10),expires_at:expiry||null,photo_url:photo.trim()||existing?.photo_url||student.passport_photo_url||null,authorized_signature_data_url:signaturePreview||existing?.authorized_signature_data_url||null,revoked_at:null,revoked_by:null,issued_by:(await db.auth.getUser()).data.user?.id};
     const result=existing
       ?await db.from('college_student_passports').update(payload).eq('id',existing.id).select().single()
       :await db.from('college_student_passports').insert({student_id:student.id,...payload}).select().single();
     if(result.error)throw result.error;
     setNotice(existing?'Passport reissued and reactivated.':'Passport generated successfully.');
     await load();
   }catch(e:any){setError(e?.message||'Could not issue passport. Check your role and student record.');}finally{setSaving(false);}
 }
 async function revoke(){
   if(!passport)return;
   if(!confirm('Revoke this student passport? Its QR verification will show it as revoked.'))return;
   setSaving(true);setError('');setNotice('');
   try{const db=createClient();const user=(await db.auth.getUser()).data.user;const {error:e}=await db.from('college_student_passports').update({status:'revoked',revoked_at:new Date().toISOString(),revoked_by:user?.id}).eq('id',passport.id);if(e)throw e;setNotice('Passport revoked.');await load();}
   catch(e:any){setError(e?.message||'Unable to revoke passport.');}finally{setSaving(false);}
 }
 return <main className="shell"><section className="workspace-topbar"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICA'S</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
<nav className="workspace-topnav" aria-label="Main navigation"><a className="topnav-link" href="/">Overview</a><a className="topnav-link active" href="/passports">Passport Studio</a><a className="topnav-link" href="/communications">Communications</a><a className="topnav-link" href="/finance/receipts">Bank payments</a>
<details className="topnav-dropdown"><summary>Finance <span>⌄</span></summary><div className="topnav-menu">{[['Fees & Payments','college_fee_charges'],['Payments register','college_payments'],['Courses','college_programmes'],['Fee heads','college_fee_heads'],['Fee structures','college_fee_structures'],['Student fee charges','college_fee_charges'],['Bank & Payment Methods','college_bank_accounts']].map(([label,key],i)=><a key={label+i} href={'/workspace?module='+key}>{label}</a>)}</div></details>
<details className="topnav-dropdown"><summary>Academics <span>⌄</span></summary><div className="topnav-menu">{[['Students','college_students'],['Programmes','college_programmes'],['Academic periods','college_academic_periods'],['Timetables','college_timetable_sessions'],['Attendance','college_attendance'],['Assessments','college_assessments'],['Teaching practice','college_practice_placements']].map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details>
<details className="topnav-dropdown"><summary>College modules <span>⌄</span></summary><div className="topnav-menu">{[['Staff & HR','college_staff'],['Library','college_library_items'],['Accommodation','college_hostel_rooms'],['Procurement','college_procurement_requests'],['Teaching practice partners','college_practice_partners'],['Communications','college_messages'],['Reports & Audit','college_audit_log'],['Settings & Access','college_profiles']].map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details></nav>
<details className="workspace-mobile-menu"><summary><span aria-hidden="true">☰</span> Menu</summary><div className="workspace-mobile-panel"><a href="/">Overview</a><a href="/passports" className="active">Passport Studio</a><a href="/communications">Communications centre</a><a href="/finance/receipts">Bank payments & thermal receipts</a><p>FINANCE</p>{[['Fees & Payments','college_fee_charges'],['Payments register','college_payments'],['Courses','college_programmes'],['Fee heads','college_fee_heads'],['Fee structures','college_fee_structures'],['Student fee charges','college_fee_charges'],['Bank & Payment Methods','college_bank_accounts']].map(([label,key],i)=><a key={label+i} href={'/workspace?module='+key}>{label}</a>)}<p>ACADEMICS</p>{[['Students','college_students'],['Programmes','college_programmes'],['Academic periods','college_academic_periods'],['Timetables','college_timetable_sessions'],['Attendance','college_attendance'],['Assessments','college_assessments'],['Teaching practice','college_practice_placements']].map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}<p>COLLEGE MODULES</p>{[['Staff & HR','college_staff'],['Library','college_library_items'],['Accommodation','college_hostel_rooms'],['Procurement','college_procurement_requests'],['Teaching practice partners','college_practice_partners'],['Communications','college_messages'],['Reports & Audit','college_audit_log'],['Settings & Access','college_profiles']].map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}<button type="button" onClick={async()=>{await createClient().auth.signOut();router.replace('/login')}}>Sign out</button></div></details>
<div className="topbar-user"><span>{profile?.full_name||'College user'}<small>{profile?.role||''}</small></span><button className="quiet-button" onClick={async()=>{await createClient().auth.signOut();router.replace('/login')}}>Sign out</button></div></section><section className="content"><header><div><p className="eyebrow">STUDENT IDENTITY / SECURE VERIFICATION</p><h1>Student Passport Studio</h1><p className="muted">Issue, preview, print and revoke official college student passports.</p></div><div className="status"><i/>Connected</div></header>
 {error&&<p className="error-message">{error}</p>}{notice&&<p className="success-message">{notice}</p>}
 <div className="passport-layout"><section className="passport-controls"><h2>Choose a trainee</h2><input className="search-input" placeholder="Search name or admission number…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="passport-student-list">{filtered.map(s=><button type="button" key={s.id} className={'passport-student '+(selected===s.id?'chosen':'')} onClick={()=>{setSelected(s.id);setPhoto(passports.find(p=>p.student_id===s.id)?.photo_url||'');setExpiry(passports.find(p=>p.student_id===s.id)?.expires_at||'');setEditStudent({first_name:s.first_name||'',middle_name:s.middle_name||'',last_name:s.last_name||'',admission_number:formatAdmission(s.admission_number),email:s.email||'',phone:s.phone||'',date_of_birth:s.date_of_birth||'',gender:s.gender||'',home_address:s.home_address||'',national_id_number:s.national_id_number||'',programme_id:s.programme_id||'',intake:s.intake||'',intake_year:String(s.intake_year||'')});setError('');setNotice('')}}><strong>{s.first_name} {s.middle_name||''} {s.last_name}</strong><span>{s.admission_number} · {s.status.replaceAll('_',' ')}</span><small>{programmes.find(p=>p.id===s.programme_id)?.title||'Programme not assigned'}</small></button>)}{!busy&&!filtered.length&&<p className="muted">No matching students.</p>}</div><div className="passport-edit-details"><h3>Edit student information</h3><p className="muted">Changes are saved to the student record and will update the passport preview.</p><div className="passport-edit-grid">{[['first_name','First name'],['middle_name','Middle name'],['last_name','Last name'],['admission_number','Admission number'],['email','Email'],['phone','Phone']].map(([key,label])=><label key={key}>{label}<input value={(editStudent as any)[key]||''} onChange={e=>setEditStudent(v=>({...v,[key]:e.target.value}))}/></label>)}<label>Date of birth<input type="date" value={editStudent.date_of_birth} onChange={e=>setEditStudent(v=>({...v,date_of_birth:e.target.value}))}/></label><label>Gender<select value={editStudent.gender} onChange={e=>setEditStudent(v=>({...v,gender:e.target.value}))}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label><label>Programme<select value={editStudent.programme_id} onChange={e=>setEditStudent(v=>({...v,programme_id:e.target.value}))}><option value="">Select programme</option>{programmes.map(p=><option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label><label>Intake<input value={editStudent.intake} onChange={e=>setEditStudent(v=>({...v,intake:e.target.value}))}/></label><label>Intake year<input type="number" value={editStudent.intake_year} onChange={e=>setEditStudent(v=>({...v,intake_year:e.target.value}))}/></label><label className="wide">Home address<input value={editStudent.home_address} onChange={e=>setEditStudent(v=>({...v,home_address:e.target.value}))}/></label><label className="wide">National ID number<input value={editStudent.national_id_number} onChange={e=>setEditStudent(v=>({...v,national_id_number:e.target.value}))}/></label></div><button type="button" className="secondary-button" disabled={saving} onClick={()=>void saveStudentDetails()}>{saving?'Saving details…':'Save student details'}</button></div><label>Passport expiry (optional)<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label><label className="passport-photo-field">Add student photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!student||photoUploading||saving||!['super_admin','principal','registrar'].includes(profile?.role)} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void uploadPhoto(file)}}/><small>{photoUploading?'Uploading and resizing photo…':'Choose a JPG, PNG or WebP photo; it is resized automatically.'}</small></label><label>Or use a photo URL<input type="url" placeholder="https://…" value={/^https?:\/\//i.test(photo)?photo:''} onChange={e=>setPhoto(e.target.value)}/></label><div className="signature-pad-controls"><strong>Authorized officer signature</strong><p className="muted">Sign below using your mouse, touch screen or stylus.</p><button type="button" className="secondary-button" onClick={()=>setSignaturePadOpen(v=>!v)}>{signaturePadOpen?'Close signature pad':'Open signature pad'}</button>{signaturePadOpen&&<div className="signature-pad-wrap"><canvas ref={node=>{if(node&&node!==signatureCanvas){setSignatureCanvas(node);const ctx=node.getContext('2d');if(ctx){ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#321526';}}}} width={600} height={150} className="signature-pad" onPointerDown={e=>{const canvas=e.currentTarget;canvas.setPointerCapture(e.pointerId);const ctx=canvas.getContext('2d');if(!ctx)return;const rect=canvas.getBoundingClientRect();ctx.beginPath();ctx.moveTo((e.clientX-rect.left)*canvas.width/rect.width,(e.clientY-rect.top)*canvas.height/rect.height);canvas.dataset.drawing='true';}} onPointerMove={e=>{const canvas=e.currentTarget;if(canvas.dataset.drawing!=='true')return;const ctx=canvas.getContext('2d');if(!ctx)return;const rect=canvas.getBoundingClientRect();ctx.lineTo((e.clientX-rect.left)*canvas.width/rect.width,(e.clientY-rect.top)*canvas.height/rect.height);ctx.stroke();}} onPointerUp={e=>{e.currentTarget.dataset.drawing='false';}} onPointerCancel={e=>{e.currentTarget.dataset.drawing='false';}}/><div className="signature-pad-actions"><button type="button" className="secondary-button" onClick={clearSignaturePad}>Clear</button><button type="button" className="primary-button" onClick={saveDrawnSignature}>Save signature</button></div></div>}{signaturePreview&&<div className="signature-saved"><img src={signaturePreview} alt="Saved handwritten signature"/><button type="button" className="secondary-button" onClick={removeSignature}>Remove signature</button></div>}</div><p className="muted passport-note">Use a clear, front-facing photo. Uploaded photos are stored privately and only authorized passport staff can access them.</p><button className="primary-button" disabled={!student||saving||!['super_admin','principal','registrar'].includes(profile?.role)} onClick={()=>void issue()}>{saving?'Saving…':passport?'Reissue / update passport':'Generate passport'}</button>{passport&&<button className="secondary-button" disabled={saving} onClick={()=>void revoke()}>Revoke passport</button>}{!['super_admin','principal','registrar'].includes(profile?.role)&&<p className="muted">Only super admin, principal or registrar can issue or revoke passports.</p>}</section>
 <section className="passport-preview"><div className="preview-heading"><div><p className="eyebrow">PRINT PREVIEW</p><h2>{passport?'Official student passport':'Your passport appears here'}</h2></div>{passport&&<span className={'passport-status '+passport.status}>{passport.status.toUpperCase()}</span>}</div>
 {student&&passport?<><OfficialStudentPassport student={student} passport={passport} programmeTitle={programme?.title||null} applicantSignatureUrl={applicantSignature} photoUrl={photoPreview||student.passport_photo_url||(/^https?:\\/\\//i.test(passport.photo_url||'')?passport.photo_url:'')} /><div className="passport-actions"><button className="primary-button" onClick={()=>window.print()}>Print / Save as PDF</button><button className="secondary-button" onClick={()=>navigator.clipboard.writeText(verifyUrl)}>Copy verification link</button></div><p className="muted passport-note">QR verification reveals only the passport number, student name, admission number, programme, issue/expiry dates and validity status. QR rendering currently uses a hosted QR image service; the token is random and the QR contains only the verification URL.</p></>:<div className="passport-empty"><img src={crest} alt="St. Monicah crest"/><h3>Identity with purpose.</h3><p>Select a student to issue or preview their official college passport.</p></div>}
 </section></div><footer>St. Monicah Teachers Training College <span>Passport access is role-controlled and revocation is recorded.</span></footer></section>
 <style jsx global>{`
.passport-layout{display:grid;grid-template-columns:minmax(270px,340px) minmax(0,1fr);gap:22px;margin-top:24px;align-items:start}
.passport-controls,.passport-preview{background:#fffdf9;border:1px solid #e8dfd5;border-radius:20px;padding:22px;min-width:0}
.passport-controls h2,.passport-preview h2{font-size:20px;margin:0 0 14px;color:#401426}
.passport-controls label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:650;color:#4b2937;margin-top:15px}
.passport-edit-details{margin-top:18px;padding-top:14px;border-top:1px solid #e8dfe2}.passport-edit-details h3{margin:0 0 6px;color:#4a142b}.passport-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.passport-edit-grid label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600}.passport-edit-grid label.wide{grid-column:1/-1}.passport-edit-grid input,.passport-edit-grid select{width:100%;min-width:0;border:1px solid #d8cbd0;border-radius:8px;padding:8px;background:white}.passport-controls label input{border:1px solid #d8cbd0;border-radius:10px;padding:11px;background:white;color:#2c2025;width:100%;min-width:0}
.passport-student-list{display:flex;flex-direction:column;gap:7px;max-height:330px;overflow:auto;margin:12px 0}
.passport-student{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid #e8dfe2;border-radius:11px;background:#fff;padding:11px;color:#321d26;cursor:pointer}
.passport-student span,.passport-student small{font-size:12px;color:#77636b}
.passport-student.chosen{border-color:#a67a35;background:#fbf2df;box-shadow:inset 3px 0 #b78c45}
.passport-note{font-size:12px;line-height:1.55;margin:12px 0}
.success-message{padding:12px 14px;border-radius:10px;background:#edf8ef;color:#245b32}
.preview-heading{display:flex;justify-content:space-between;gap:10px;align-items:start;margin-bottom:16px}
.passport-status{font-size:11px;font-weight:800;letter-spacing:.08em;padding:6px 9px;border-radius:20px;background:#e8f5eb;color:#226333}
.passport-status.revoked{background:#fbe8e7;color:#9d2c27}.passport-status.expired{background:#fff0d8;color:#83550b}
.passport-card{background:#fffdf8;border:1px solid #d7bd83;border-radius:12px;overflow:hidden;box-shadow:0 14px 35px #4b203013;color:#2d1721;width:min(100%,560px);aspect-ratio:1.586;margin:0 auto;display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0}
.passport-card *{box-sizing:border-box;min-width:0}
.passport-card-top{display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(110deg,#4a142b,#6c203d);color:#fff;min-height:0}
.passport-card-top img{width:28px;height:28px;object-fit:contain;background:#fff;border-radius:50%;padding:2px;flex:0 0 auto}
.passport-card-top div:nth-child(2){display:flex;flex-direction:column;gap:2px;min-width:0}
.passport-card-top strong{font-size:11px;letter-spacing:.03em;line-height:1.05}
.passport-card-top span{font-size:5.5px;letter-spacing:.05em;line-height:1.1}
.passport-card-top small{font-size:5.5px;color:#e4c37e;letter-spacing:.07em;margin-top:1px}
.passport-card-body{display:grid;grid-template-columns:minmax(42px,19%) minmax(0,1fr) minmax(28px,14%);grid-template-rows:minmax(0,1fr);gap:5px;padding:5px 7px;align-items:center;min-height:0;overflow:hidden}
.passport-photo{width:100%;height:auto;aspect-ratio:4/5;max-height:100%;border:1px solid #e4d8c3;background:#f4eee4;border-radius:5px;overflow:hidden;display:grid;place-items:center;align-self:center}
.passport-photo img{width:100%;height:100%;object-fit:cover}
.photo-placeholder{font-size:7px;letter-spacing:.08em;color:#a28b7b}
.passport-details{display:flex;flex-direction:column;justify-content:center;gap:1px;height:100%;min-height:0;overflow:hidden;overflow-wrap:anywhere}
.passport-label{font-size:5.5px;letter-spacing:.04em;color:#8e6a43;margin-top:1px;line-height:1}
.passport-details h3,.passport-details strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;overflow-wrap:anywhere;word-break:break-word}
.passport-details h3{font-size:clamp(8px,2.2vw,11px);line-height:1.05;margin:0}
.passport-details strong{font-size:clamp(6px,1.7vw,8px);line-height:1.05;font-weight:700}
.passport-qr{width:100%;align-self:center;overflow:hidden}
.passport-qr img{width:100%;height:auto;aspect-ratio:1;object-fit:contain;display:block}
.passport-qr small{display:block;text-align:center;font-size:4px;line-height:1;margin-top:2px;color:#775e4a;white-space:normal;overflow-wrap:anywhere}
.passport-card-footer{border-top:1px solid #e4d4b4;background:#f8f0df;display:flex;justify-content:space-between;align-items:center;gap:5px;padding:4px 7px;font-size:5px;line-height:1.05;overflow:hidden}
.passport-card-footer span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.passport-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:15px}
.passport-empty{min-height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#775f68}
.passport-empty img{width:90px;height:90px;object-fit:contain}
.passport-empty h3{font-family:Georgia,serif;color:#4a142b;font-size:25px;margin:14px 0 6px}
.passport-empty p{max-width:280px;line-height:1.6}
.passport-photo-field input[type=file]{font:11px 'DM Sans',sans-serif;padding:8px;background:#fff}
.passport-photo-field small{font-size:11px;color:#86747e;line-height:1.5;font-weight:400}
@media(max-width:900px){.passport-layout{grid-template-columns:1fr}.passport-student-list{max-height:240px}}
@media(max-width:540px){.passport-edit-grid{grid-template-columns:1fr}.passport-edit-grid label.wide{grid-column:auto}.passport-controls,.passport-preview{padding:12px}.passport-card{width:100%;border-radius:8px}.passport-card-top{padding:5px 7px;gap:5px}.passport-card-top img{width:24px;height:24px}.passport-card-top strong{font-size:9px}.passport-card-top span,.passport-card-top small{font-size:4.8px}.passport-card-body{grid-template-columns:minmax(38px,19%) minmax(0,1fr) minmax(25px,14%);gap:4px;padding:4px 5px}.passport-label{font-size:4.8px}.passport-details h3{font-size:clamp(7px,2.5vw,10px)}.passport-details strong{font-size:clamp(5.5px,1.8vw,7.5px)}.passport-qr small{font-size:3.5px}.passport-card-footer{padding:3px 5px;font-size:4.5px;gap:3px}}
@media print{body *{visibility:hidden!important}.passport-card,.passport-card *{visibility:visible!important}.passport-card{position:absolute;left:0;top:0;width:85.6mm;height:54mm;aspect-ratio:auto;max-width:none;border-radius:2mm;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.passport-card-top{padding:1mm 1.5mm;gap:1mm}.passport-card-top img{width:7mm;height:7mm}.passport-card-top strong{font-size:6pt}.passport-card-top span,.passport-card-top small{font-size:3.2pt}.passport-card-body{grid-template-columns:12mm minmax(0,1fr) 8mm;gap:.8mm;padding:.7mm 1.2mm;min-height:0}.passport-photo{width:11mm;height:14mm;aspect-ratio:auto}.passport-label{font-size:3.2pt}.passport-details h3{font-size:5.4pt;line-height:1.02}.passport-details strong{font-size:4.2pt;line-height:1.02}.passport-qr{width:8mm}.passport-qr img{width:8mm;height:8mm}.passport-qr small{font-size:2.2pt}.passport-card-footer{padding:.6mm 1.2mm;font-size:2.8pt;gap:.8mm}@page{size:90mm 60mm;margin:2mm}}

.signature-pad-controls{margin-top:16px;padding:12px;border:1px solid #e5d9df;border-radius:12px;background:#fff}.signature-pad-controls>strong{font-size:13px;color:#4b2937}.signature-pad-controls>p{font-size:12px;margin:5px 0 10px}.signature-pad-wrap{margin-top:10px}.signature-pad{display:block;width:100%;height:110px;background:#fffdf8;border:1px dashed #b9a5ae;border-radius:8px;touch-action:none;cursor:crosshair}.signature-pad-actions,.signature-saved{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}.signature-saved img{max-width:140px;max-height:40px;object-fit:contain;background:#fffdf8;border:1px solid #eee;padding:3px;border-radius:5px}
.passport-card{position:relative;isolation:isolate}
.passport-card-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:-1;pointer-events:none;overflow:hidden}
.passport-card-watermark img{width:72%;height:90%;object-fit:contain;opacity:.075;filter:grayscale(1)}
.passport-card-body,.passport-card-top,.passport-card-footer,.passport-signature{position:relative}
.passport-card-top{padding:5px 8px}
.passport-signature{display:flex;align-items:center;gap:6px;padding:0 8px 3px 27%;min-height:20px;font-size:5px;line-height:1;color:#80684f;letter-spacing:.06em}
.passport-signature img{max-width:70px;width:auto;height:17px;object-fit:contain}.applicant-signature{padding-left:8px;min-height:16px;color:#4a142b}.applicant-signature img{max-width:52px;height:13px}
@media(max-width:540px){.passport-card-watermark img{width:78%;opacity:.07}.passport-signature{min-height:14px;padding-left:25%;font-size:4px}.passport-signature img{max-width:48px;height:12px}}
@media print{html,body{width:90mm!important;height:60mm!important;margin:0!important;padding:0!important;overflow:hidden!important}.passport-card-watermark img{opacity:.08}.passport-signature{padding-left:25%;min-height:4mm;font-size:3pt;gap:1mm}.applicant-signature{padding-left:1mm;min-height:3mm}.passport-signature img{max-width:18mm;height:4mm}.passport-actions,.passport-note,.passport-controls,.preview-heading,.workspace-topbar,.content>header,.content>footer,.success-message,.error-message{display:none!important}@page{size:90mm 60mm;margin:2mm}}
`}</style>
 </main>;
}
