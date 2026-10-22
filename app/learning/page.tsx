'use client';

import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import {createClient} from '@/lib/supabase/client';

type Profile={id:string;full_name:string;role:string;active:boolean;student_id?:string|null};
type Unit={id:string;unit_code:string;unit_title:string;programme_id:string|null};
type Resource={id:string;unit_id:string|null;title:string;description:string|null;resource_type:string;resource_url:string|null;is_published:boolean;created_at:string};
type Assignment={id:string;unit_id:string;title:string;instructions:string;due_at:string|null;max_score:number;status:string;created_at:string};
type Submission={id:string;assignment_id:string;student_id:string;submission_text:string|null;file_url:string|null;submitted_at:string;status:string;score:number|null;feedback:string|null;marked_by:string|null};
const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const staffRoles=['super_admin','principal','registrar','hod','lecturer'];
const field:React.CSSProperties={width:'100%',boxSizing:'border-box',padding:11,border:'1px solid #ded5db',borderRadius:8,font:'inherit',background:'#fff'};
export default function LearningPage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [units,setUnits]=useState<Unit[]>([]);
 const [resources,setResources]=useState<Resource[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [submissions,setSubmissions]=useState<Submission[]>([]);
 const [students,setStudents]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [resourceForm,setResourceForm]=useState({unit_id:'',title:'',description:'',resource_type:'document',resource_url:'',is_published:true});
 const [assignmentForm,setAssignmentForm]=useState({unit_id:'',title:'',instructions:'',due_at:'',max_score:'100',status:'published'});
 const [drafts,setDrafts]=useState<Record<string,{text:string;score:string;feedback:string}>>({});
 const isStudent=profile?.role==='student';
 const canManage=staffRoles.includes(profile?.role||'');

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const db=createClient();
   const {data:{session}}=await db.auth.getSession();
   if(!session){router.replace('/login');return;}
   const {data:p,error:pe}=await db.from('college_profiles').select('id,full_name,role,active,student_id').eq('id',session.user.id).maybeSingle();
   if(pe)throw pe;if(!p?.active){router.replace('/login');return;}
   setProfile(p as Profile);
   const [ur,rr,ar,sr,st]=await Promise.all([
    db.from('college_units').select('id,unit_code,unit_title,programme_id').eq('active',true).order('unit_code').limit(1000),
    db.from('college_learning_resources').select('*').order('created_at',{ascending:false}).limit(1000),
    db.from('college_learning_assignments').select('*').order('created_at',{ascending:false}).limit(1000),
    db.from('college_learning_submissions').select('*').order('submitted_at',{ascending:false}).limit(3000),
    staffRoles.includes(p.role)?db.from('college_students').select('id,first_name,middle_name,last_name,admission_number').order('last_name').limit(2000):Promise.resolve({data:[],error:null})
   ]);
   if(ur.error)throw ur.error;if(rr.error)throw rr.error;if(ar.error)throw ar.error;if(sr.error)throw sr.error;if(st.error)throw st.error;
   setUnits((ur.data||[]) as Unit[]);setResources((rr.data||[]) as Resource[]);setAssignments((ar.data||[]) as Assignment[]);setSubmissions((sr.data||[]) as Submission[]);
   setStudents(Object.fromEntries((st.data||[]).map((s:any)=>[s.id,[[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' '),s.admission_number].filter(Boolean).join(' · ')])));
   setDrafts(Object.fromEntries(((sr.data||[]) as Submission[]).map(s=>[s.id,{text:s.submission_text||'',score:s.score==null?'':String(s.score),feedback:s.feedback||''}])));
   if(p.role==='student'&&!p.student_id)setError('Your login is not linked to a student record. Ask the Registrar to link it before submitting assignments.');
  }catch(e:any){setError(e?.message||'Unable to load learning records.');}
  finally{setLoading(false);}
 },[router]);
 useEffect(()=>{void load()},[load]);
 async function createResource(e:React.FormEvent){
  e.preventDefault();if(!profile||!canManage)return;setBusy('resource');setError('');setNotice('');
  try{
   const payload={unit_id:resourceForm.unit_id||null,title:resourceForm.title.trim(),description:resourceForm.description.trim()||null,resource_type:resourceForm.resource_type,resource_url:resourceForm.resource_url.trim()||null,is_published:resourceForm.is_published,created_by:profile.id};
   const {error:e}=await createClient().from('college_learning_resources').insert(payload);if(e)throw e;
   setResourceForm({unit_id:'',title:'',description:'',resource_type:'document',resource_url:'',is_published:true});setNotice('Learning resource saved.');await load();
  }catch(e:any){setError(e?.message||'Could not save resource.');}finally{setBusy('');}
 }
 async function createAssignment(e:React.FormEvent){
  e.preventDefault();if(!profile||!canManage)return;if(!assignmentForm.unit_id){setError('Choose the unit for this assignment.');return;}
  setBusy('assignment');setError('');setNotice('');
  try{
   const payload={unit_id:assignmentForm.unit_id,title:assignmentForm.title.trim(),instructions:assignmentForm.instructions.trim(),due_at:assignmentForm.due_at?new Date(assignmentForm.due_at).toISOString():null,max_score:Number(assignmentForm.max_score),status:assignmentForm.status,created_by:profile.id};
   const {error:e}=await createClient().from('college_learning_assignments').insert(payload);if(e)throw e;
   setAssignmentForm({unit_id:'',title:'',instructions:'',due_at:'',max_score:'100',status:'published'});setNotice('Assignment created.');await load();
  }catch(e:any){setError(e?.message||'Could not create assignment.');}finally{setBusy('');}
 }
 async function submitWork(a:Assignment){
  if(!profile?.student_id){setError('Student account is not linked.');return;}
  const draft=drafts[a.id]||{text:'',score:'',feedback:''};if(!draft.text.trim()){setError('Enter your response or paste the link to your work before submitting.');return;}
  setBusy(a.id);setError('');setNotice('');
  try{
   const existing=submissions.find(s=>s.assignment_id===a.id&&s.student_id===profile.student_id);
   const data={assignment_id:a.id,student_id:profile.student_id,submission_text:draft.text.trim(),status:'submitted'};
   const result=existing
    ? await createClient().from('college_learning_submissions').update(data).eq('id',existing.id)
    : await createClient().from('college_learning_submissions').insert(data);
   if(result.error)throw result.error;setNotice('Assignment submitted successfully.');await load();
  }catch(e:any){setError(e?.message||'Could not submit assignment.');}finally{setBusy('');}
 }
 async function markWork(s:Submission){
  if(!profile||!canManage)return;const d=drafts[s.id]||{text:'',score:'',feedback:''};
  const score=d.score===''?null:Number(d.score);if(score!==null&&(!Number.isFinite(score)||score<0)){setError('Enter a valid non-negative mark.');return;}
  const assignment=assignments.find(a=>a.id===s.assignment_id);if(score!==null&&assignment&&score>Number(assignment.max_score)){setError('Mark cannot exceed '+assignment.max_score+'.');return;}
  setBusy(s.id);setError('');setNotice('');
  try{const {error:e}=await createClient().from('college_learning_submissions').update({score,feedback:d.feedback.trim()||null,status:'marked',marked_by:profile.id,marked_at:new Date().toISOString()}).eq('id',s.id);if(e)throw e;setNotice('Submission marked.');await load();}
  catch(e:any){setError(e?.message||'Could not mark submission.');}finally{setBusy('');}
 }
 const unitLabel=(id:string|null)=>{const u=units.find(x=>x.id===id);return u?u.unit_code+' — '+u.unit_title:'All units'};
 const mySubmission=(id:string)=>submissions.find(s=>s.assignment_id===id&&s.student_id===profile?.student_id);
 if(loading)return <main className="shell"><div style={{padding:32}}>Loading learning resources…</div></main>;
 return <main className="shell">
  <section className="workspace-topbar"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="College crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="academics"/></section>
  <div style={{maxWidth:1500,margin:'0 auto',padding:'24px clamp(14px,3vw,42px) 48px'}}>
   <p className="eyebrow">ACADEMICS / DIGITAL CLASSROOM</p><div className="section-head" style={{marginTop:0}}><div><h1>Learning & Assignments</h1><p className="muted">Study resources, course work, submissions and feedback in one place.</p></div><button className="secondary-button" onClick={()=>void load()}>Refresh</button></div>
   {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
   {canManage&&<div className="module-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',marginBottom:22}}>
    <form className="record-form" onSubmit={createResource}><h2>Add learning resource</h2><div className="form-grid" style={{gridTemplateColumns:'1fr'}}>
     <label>Resource title<input style={field} value={resourceForm.title} onChange={e=>setResourceForm({...resourceForm,title:e.target.value})} required minLength={2}/></label>
     <label>Unit (optional)<select style={field} value={resourceForm.unit_id} onChange={e=>setResourceForm({...resourceForm,unit_id:e.target.value})}><option value="">All students / general resource</option>{units.map(u=><option key={u.id} value={u.id}>{u.unit_code} — {u.unit_title}</option>)}</select></label>
     <label>Resource type<select style={field} value={resourceForm.resource_type} onChange={e=>setResourceForm({...resourceForm,resource_type:e.target.value})}>{['document','link','video','reading','presentation','other'].map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label>
     <label>Resource URL (optional)<input type="url" style={field} value={resourceForm.resource_url} onChange={e=>setResourceForm({...resourceForm,resource_url:e.target.value})} placeholder="https://…"/></label>
     <label>Description<textarea style={field} rows={3} value={resourceForm.description} onChange={e=>setResourceForm({...resourceForm,description:e.target.value})}/></label>
     <label style={{display:'flex',alignItems:'center',gap:9}}><input type="checkbox" checked={resourceForm.is_published} onChange={e=>setResourceForm({...resourceForm,is_published:e.target.checked})}/> Published for students</label>
    </div><button className="primary-button" disabled={busy==='resource'}>{busy==='resource'?'Saving…':'Save resource'}</button></form>
    <form className="record-form" onSubmit={createAssignment}><h2>Create assignment</h2><div className="form-grid" style={{gridTemplateColumns:'1fr'}}>
     <label>Course unit<select style={field} required value={assignmentForm.unit_id} onChange={e=>setAssignmentForm({...assignmentForm,unit_id:e.target.value})}><option value="">Choose unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.unit_code} — {u.unit_title}</option>)}</select></label>
     <label>Assignment title<input style={field} value={assignmentForm.title} onChange={e=>setAssignmentForm({...assignmentForm,title:e.target.value})} required minLength={2}/></label>
     <label>Instructions<textarea style={field} rows={4} value={assignmentForm.instructions} onChange={e=>setAssignmentForm({...assignmentForm,instructions:e.target.value})} required/></label>
     <label>Deadline<input type="datetime-local" style={field} value={assignmentForm.due_at} onChange={e=>setAssignmentForm({...assignmentForm,due_at:e.target.value})}/></label>
     <label>Maximum score<input type="number" style={field} min="1" value={assignmentForm.max_score} onChange={e=>setAssignmentForm({...assignmentForm,max_score:e.target.value})} required/></label>
     <label>Status<select style={field} value={assignmentForm.status} onChange={e=>setAssignmentForm({...assignmentForm,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option></select></label>
    </div><button className="primary-button" disabled={busy==='assignment'}>{busy==='assignment'?'Creating…':'Create assignment'}</button></form>
   </div>}
   <div className="section-head"><div><h2>Learning resources</h2><p className="muted">{resources.length} resources visible to your account</p></div></div>
   {resources.length===0?<div className="empty-state">No learning resources yet. Authorized lecturers can add notes, readings, videos and links above.</div>:<div className="module-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>{resources.filter(r=>canManage||r.is_published).map(r=><article className="module" key={r.id}><div className="module-top"><span className="module-icon">{r.resource_type.toUpperCase().slice(0,2)}</span><span className="count">{r.is_published?'Published':'Draft'}</span></div><h3>{r.title}</h3><p>{r.description||unitLabel(r.unit_id)}</p><p className="muted">{unitLabel(r.unit_id)}</p>{r.resource_url&&<a className="primary-button" href={r.resource_url} target="_blank" rel="noreferrer" style={{display:'inline-block',marginTop:12,textDecoration:'none'}}>Open resource ↗</a>}</article>)}</div>}
   <div className="section-head"><div><h2>Assignments</h2><p className="muted">Published work appears for students registered in its unit.</p></div></div>
   {assignments.filter(a=>canManage||a.status==='published').length===0?<div className="empty-state">No assignments available yet.</div>:<div style={{display:'grid',gap:12}}>{assignments.filter(a=>canManage||a.status==='published').map(a=>{const mine=mySubmission(a.id);return <article className="record-form" key={a.id} style={{margin:0}}><div className="section-head" style={{margin:'0 0 12px'}}><div><h2>{a.title}</h2><p className="muted">{unitLabel(a.unit_id)} · Max {a.max_score} marks · {a.due_at?'Due '+new Date(a.due_at).toLocaleString():'No deadline'}</p></div><span className="count">{a.status}</span></div><p style={{whiteSpace:'pre-wrap',lineHeight:1.6,fontSize:13}}>{a.instructions}</p>{isStudent&&<div style={{display:'grid',gap:9,marginTop:14}}><label style={{fontSize:12,fontWeight:700}}>Your response or secure work link<textarea style={field} rows={4} value={(drafts[a.id]||{text:'',score:'',feedback:''}).text} onChange={e=>setDrafts(prev=>({...prev,[a.id]:{...(prev[a.id]||{score:'',feedback:''}),text:e.target.value}}))} disabled={a.status!=='published'||mine?.status==='marked'} placeholder="Write your response or paste a link to your work…"/></label><button className="primary-button" style={{justifySelf:'start'}} disabled={busy===a.id||a.status!=='published'||mine?.status==='marked'} onClick={()=>void submitWork(a)}>{busy===a.id?'Submitting…':mine?'Update submission':'Submit assignment'}</button>{mine&&<p className="muted">Submitted {new Date(mine.submitted_at).toLocaleString()} · Status: {mine.status}{mine.score!==null?' · Score: '+mine.score+'/'+a.max_score:''}{mine.feedback?' · Feedback: '+mine.feedback:''}</p>}</div>}</article>})}</div>}
   {canManage&&<><div className="section-head"><div><h2>Submitted work & marking</h2><p className="muted">{submissions.length} submission records</p></div></div>{submissions.length===0?<div className="empty-state">Student submissions will appear here.</div>:<div className="table-wrap"><table className="records-table"><thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Response / link</th><th>Score</th><th>Feedback</th><th>Action</th></tr></thead><tbody>{submissions.map(s=>{const a=assignments.find(x=>x.id===s.assignment_id);const d=drafts[s.id]||{text:s.submission_text||'',score:s.score==null?'':String(s.score),feedback:s.feedback||''};return <tr key={s.id}><td>{students[s.student_id]||s.student_id.slice(0,8)}</td><td>{a?.title||'Assignment'}</td><td>{new Date(s.submitted_at).toLocaleString()}</td><td style={{minWidth:220,maxWidth:360,whiteSpace:'pre-wrap'}}>{s.submission_text||s.file_url||'—'}</td><td><input style={{...field,width:80}} type="number" min="0" max={a?.max_score||100} value={d.score} onChange={e=>setDrafts(prev=>({...prev,[s.id]:{...d,score:e.target.value}}))}/></td><td><input style={{...field,minWidth:180}} value={d.feedback} onChange={e=>setDrafts(prev=>({...prev,[s.id]:{...d,feedback:e.target.value}}))}/></td><td><button className="secondary-button" disabled={busy===s.id} onClick={()=>void markWork(s)}>{busy===s.id?'Saving…':'Save mark'}</button></td></tr>})}</tbody></table></div>}</>}
  </div>
 </main>;
}
