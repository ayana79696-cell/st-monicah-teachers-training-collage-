'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

type Student={id:string;admission_number:string;first_name:string;middle_name?:string|null;last_name:string;programme_id?:string|null;intake?:string|null;intake_year?:number|null;status:string;email?:string|null;phone?:string|null};
type Programme={id:string;title:string;code:string};
type Passport={id:string;student_id:string;passport_number:string;verification_token:string;status:string;issued_at:string;expires_at?:string|null;photo_url?:string|null};
const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';

export default function PassportStudio(){
 const router=useRouter();
 const [students,setStudents]=useState<Student[]>([]);
 const [programmes,setProgrammes]=useState<Programme[]>([]);
 const [passports,setPassports]=useState<Passport[]>([]);
 const [profile,setProfile]=useState<any>(null);
 const [selected,setSelected]=useState('');
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
     const [{data:ss,error:se},{data:pp,error:pge},{data:ps,error:pse}]=await Promise.all([
       db.from('college_students').select('id,admission_number,first_name,middle_name,last_name,programme_id,intake,intake_year,status,email,phone').order('last_name').limit(1000),
       db.from('college_programmes').select('id,title,code').order('title').limit(500),
       db.from('college_student_passports').select('id,student_id,passport_number,verification_token,status,issued_at,expires_at,photo_url').limit(1000)
     ]);
     if(se)throw se;if(pge)throw pge;if(pse)throw pse;
     setStudents(ss||[]);setProgrammes(pp||[]);setPassports(ps||[]);
   }catch(e:any){setError(e?.message||'Unable to load passport records.');}finally{setBusy(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
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
 async function issue(){
   if(!student){setError('Choose a student first.');return;}
   setSaving(true);setError('');setNotice('');
   try{
     const db=createClient();const existing=passports.find(p=>p.student_id===student.id);
     const payload={status:'active',issued_at:new Date().toISOString().slice(0,10),expires_at:expiry||null,photo_url:photo.trim()||null,revoked_at:null,revoked_by:null,issued_by:(await db.auth.getUser()).data.user?.id};
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
 return <main className="shell"><aside className="sidebar"><div className="brand"><img className="crest-logo" src={crest} alt="St. Monicah crest"/><div><strong>ST. MONICAH</strong><span>TEACHERS TRAINING COLLEGE</span></div></div><p className="nav-label">COLLEGE WORKSPACE</p><div className="nav-items"><a className="nav" href="/">← Overview</a><a className="nav" href="/workspace?module=college_students">Students</a><a className="nav active" href="/passports">Passport Studio</a><a className="nav" href="/workspace?module=college_programmes">Programmes</a><a className="nav" href="/workspace?module=college_fee_charges">Fee charges</a></div><div className="sidebar-foot">{profile?.full_name||'College user'}<span>{profile?.role||''}</span><button className="quiet-button" onClick={async()=>{await createClient().auth.signOut();router.replace('/login')}}>Sign out</button></div></aside>
 <section className="content"><header><div><p className="eyebrow">STUDENT IDENTITY / SECURE VERIFICATION</p><h1>Student Passport Studio</h1><p className="muted">Issue, preview, print and revoke official college student passports.</p></div><div className="status"><i/>Connected</div></header>
 {error&&<p className="error-message">{error}</p>}{notice&&<p className="success-message">{notice}</p>}
 <div className="passport-layout"><section className="passport-controls"><h2>Choose a trainee</h2><input className="search-input" placeholder="Search name or admission number…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="passport-student-list">{filtered.map(s=><button type="button" key={s.id} className={'passport-student '+(selected===s.id?'chosen':'')} onClick={()=>{setSelected(s.id);setPhoto(passports.find(p=>p.student_id===s.id)?.photo_url||'');setExpiry(passports.find(p=>p.student_id===s.id)?.expires_at||'');setError('');setNotice('')}}><strong>{s.first_name} {s.middle_name||''} {s.last_name}</strong><span>{s.admission_number} · {s.status.replaceAll('_',' ')}</span><small>{programmes.find(p=>p.id===s.programme_id)?.title||'Programme not assigned'}</small></button>)}{!busy&&!filtered.length&&<p className="muted">No matching students.</p>}</div><label>Passport expiry (optional)<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label><label className="passport-photo-field">Add student photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!student||photoUploading||saving||!['super_admin','principal','registrar'].includes(profile?.role)} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void uploadPhoto(file)}}/><small>{photoUploading?'Uploading and resizing photo…':'Choose a JPG, PNG or WebP photo; it is resized automatically.'}</small></label><label>Or use a photo URL<input type="url" placeholder="https://…" value={/^https?:\/\//i.test(photo)?photo:''} onChange={e=>setPhoto(e.target.value)}/></label><label className="passport-photo-field">Authorized officer signature<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';uploadSignature(file)}}/><small>Upload the approved registrar/principal signature (PNG with transparent background works best). Saved in this browser.</small></label><label>Or signature image URL<input type="url" placeholder="https://…" value={/^https?:\/\//i.test(signature)?signature:''} onChange={e=>{setSignature(e.target.value);setSignaturePreview(e.target.value);try{window.localStorage.setItem('stmonicah-passport-signature',e.target.value)}catch{}}}/></label><button type="button" className="secondary-button" onClick={()=>{setSignature('');setSignaturePreview('');try{window.localStorage.removeItem('stmonicah-passport-signature')}catch{}}}>Remove signature</button><p className="muted passport-note">Use a clear, front-facing photo. Uploaded photos are stored privately and only authorized passport staff can access them.</p><button className="primary-button" disabled={!student||saving||!['super_admin','principal','registrar'].includes(profile?.role)} onClick={()=>void issue()}>{saving?'Saving…':passport?'Reissue / update passport':'Generate passport'}</button>{passport&&<button className="secondary-button" disabled={saving} onClick={()=>void revoke()}>Revoke passport</button>}{!['super_admin','principal','registrar'].includes(profile?.role)&&<p className="muted">Only super admin, principal or registrar can issue or revoke passports.</p>}</section>
 <section className="passport-preview"><div className="preview-heading"><div><p className="eyebrow">PRINT PREVIEW</p><h2>{passport?'Official student passport':'Your passport appears here'}</h2></div>{passport&&<span className={'passport-status '+passport.status}>{passport.status.toUpperCase()}</span>}</div>
 {student&&passport?<><div className="passport-card" id="passport-card"><div className="passport-card-watermark"><img src={crest} alt=""/></div><div className="passport-card-top"><img src={crest} alt="College crest"/><div><strong>ST. MONICAH</strong><span>TEACHERS TRAINING COLLEGE</span><small>STUDENT PASSPORT</small></div></div><div className="passport-card-body"><div className="passport-photo">{photoPreview?<img src={photoPreview} alt="Student portrait"/>:<div className="photo-placeholder">PHOTO</div>}</div><div className="passport-details"><span className="passport-label">STUDENT NAME</span><h3>{fullName}</h3><span className="passport-label">ADMISSION NUMBER</span><strong>{student.admission_number}</strong><span className="passport-label">PROGRAMME</span><strong>{programme?programme.title:'Not assigned'}</strong><span className="passport-label">INTAKE</span><strong>{[student.intake,student.intake_year].filter(Boolean).join(' ')||'—'}</strong><span className="passport-label">PASSPORT NUMBER</span><strong>{passport.passport_number}</strong></div><div className="passport-qr">{qrUrl&&<img src={qrUrl} alt="QR code for passport verification"/>}<small>SCAN TO VERIFY</small></div></div><div className="passport-signature">{signaturePreview&&<img src={signaturePreview} alt="Authorized officer signature"/>}<span>AUTHORIZED SIGNATURE</span></div><div className="passport-card-footer"><span>ISSUED {passport.issued_at}</span><span>{passport.expires_at?'EXPIRES '+passport.expires_at:'VALID UNTIL REVOKED OR EXPIRED'}</span></div></div><div className="passport-actions"><button className="primary-button" onClick={()=>window.print()}>Print / Save as PDF</button><button className="secondary-button" onClick={()=>navigator.clipboard.writeText(verifyUrl)}>Copy verification link</button></div><p className="muted passport-note">QR verification reveals only the passport number, student name, admission number, programme, issue/expiry dates and validity status. QR rendering currently uses a hosted QR image service; the token is random and the QR contains only the verification URL.</p></>:<div className="passport-empty"><img src={crest} alt="St. Monicah crest"/><h3>Identity with purpose.</h3><p>Select a student to issue or preview their official college passport.</p></div>}
 </section></div><footer>St. Monicah Teachers Training College <span>Passport access is role-controlled and revocation is recorded.</span></footer></section>
 <style jsx global>{`
.passport-layout{display:grid;grid-template-columns:minmax(270px,340px) minmax(0,1fr);gap:22px;margin-top:24px;align-items:start}
.passport-controls,.passport-preview{background:#fffdf9;border:1px solid #e8dfd5;border-radius:20px;padding:22px;min-width:0}
.passport-controls h2,.passport-preview h2{font-size:20px;margin:0 0 14px;color:#401426}
.passport-controls label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:650;color:#4b2937;margin-top:15px}
.passport-controls label input{border:1px solid #d8cbd0;border-radius:10px;padding:11px;background:white;color:#2c2025;width:100%;min-width:0}
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
@media(max-width:540px){.passport-controls,.passport-preview{padding:12px}.passport-card{width:100%;border-radius:8px}.passport-card-top{padding:5px 7px;gap:5px}.passport-card-top img{width:24px;height:24px}.passport-card-top strong{font-size:9px}.passport-card-top span,.passport-card-top small{font-size:4.8px}.passport-card-body{grid-template-columns:minmax(38px,19%) minmax(0,1fr) minmax(25px,14%);gap:4px;padding:4px 5px}.passport-label{font-size:4.8px}.passport-details h3{font-size:clamp(7px,2.5vw,10px)}.passport-details strong{font-size:clamp(5.5px,1.8vw,7.5px)}.passport-qr small{font-size:3.5px}.passport-card-footer{padding:3px 5px;font-size:4.5px;gap:3px}}
@media print{body *{visibility:hidden!important}.passport-card,.passport-card *{visibility:visible!important}.passport-card{position:absolute;left:0;top:0;width:85.6mm;height:54mm;aspect-ratio:auto;max-width:none;border-radius:2mm;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden}.passport-card-top{padding:1mm 1.5mm;gap:1mm}.passport-card-top img{width:7mm;height:7mm}.passport-card-top strong{font-size:6pt}.passport-card-top span,.passport-card-top small{font-size:3.2pt}.passport-card-body{grid-template-columns:12mm minmax(0,1fr) 8mm;gap:.8mm;padding:.7mm 1.2mm;min-height:0}.passport-photo{width:11mm;height:14mm;aspect-ratio:auto}.passport-label{font-size:3.2pt}.passport-details h3{font-size:5.4pt;line-height:1.02}.passport-details strong{font-size:4.2pt;line-height:1.02}.passport-qr{width:8mm}.passport-qr img{width:8mm;height:8mm}.passport-qr small{font-size:2.2pt}.passport-card-footer{padding:.6mm 1.2mm;font-size:2.8pt;gap:.8mm}@page{size:90mm 60mm;margin:2mm}}

.passport-card{position:relative;isolation:isolate}
.passport-card-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:-1;pointer-events:none;overflow:hidden}
.passport-card-watermark img{width:72%;height:90%;object-fit:contain;opacity:.075;filter:grayscale(1)}
.passport-card-body,.passport-card-top,.passport-card-footer,.passport-signature{position:relative}
.passport-card-top{padding:5px 8px}
.passport-signature{display:flex;align-items:center;gap:6px;padding:0 8px 3px 27%;min-height:20px;font-size:5px;line-height:1;color:#80684f;letter-spacing:.06em}
.passport-signature img{max-width:70px;width:auto;height:17px;object-fit:contain}
@media(max-width:540px){.passport-card-watermark img{width:78%;opacity:.07}.passport-signature{min-height:14px;padding-left:25%;font-size:4px}.passport-signature img{max-width:48px;height:12px}}
@media print{.passport-card-watermark img{opacity:.08}.passport-signature{padding-left:25%;min-height:4mm;font-size:3pt;gap:1mm}.passport-signature img{max-width:18mm;height:4mm}}
`}</style>
 </main>;
}
