'use client';
import ErpNavigation from '@/components/ErpNavigation';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
type Row=Record<string,any>;
export default function LearningPage(){
 const db=useMemo(()=>createClient(),[]);const router=useRouter();
 const [profile,setProfile]=useState<Row|null>(null);const [resources,setResources]=useState<Row[]>([]);
 const [assignments,setAssignments]=useState<Row[]>([]);const [submissions,setSubmissions]=useState<Row[]>([]);
 const [drafts,setDrafts]=useState<Record<string,string>>({});const [busy,setBusy]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const {data:{session}}=await db.auth.getSession();if(!session){router.replace('/login');return;}
  const {data:p,error:pe}=await db.from('college_profiles').select('id,role,active,student_id,full_name').eq('id',session.user.id).maybeSingle();if(pe)throw pe;if(!p?.active){router.replace('/');return;}setProfile(p);
  const [rr,aa]=await Promise.all([db.from('college_learning_resources').select('*').order('created_at',{ascending:false}).limit(250),db.from('college_learning_assignments').select('*').order('created_at',{ascending:false}).limit(250)]);
  if(rr.error)throw rr.error;if(aa.error)throw aa.error;setResources(rr.data||[]);setAssignments(aa.data||[]);
  if(p.role==='student'&&p.student_id){const {data:ss,error:se}=await db.from('college_learning_submissions').select('*').eq('student_id',p.student_id).limit(500);if(se)throw se;setSubmissions(ss||[]);}
 }catch(e:any){setError([e?.message,e?.details,e?.hint,e?.code?'Code: '+e.code:null].filter(Boolean).join(' — ')||'Unable to load learning records.');}finally{setLoading(false);}},[db,router]);
 useEffect(()=>{void load();},[load]);
 const student=profile?.role==='student';
 async function submit(assignment:Row){if(!profile?.student_id){setError('Your student account is not linked to a student record. Ask the Registrar.');return;}const text=drafts[assignment.id]?.trim();if(!text){setError('Enter your submission before sending.');return;}setBusy(assignment.id);setError('');try{const {error:e}=await db.from('college_learning_submissions').insert({assignment_id:assignment.id,student_id:profile.student_id,submission_text:text,status:'submitted'});if(e)throw e;setDrafts(s=>({...s,[assignment.id]:''}));await load();}catch(e:any){setError(e?.message||'Submission failed.');}finally{setBusy('');}}
 const publishedAssignments=assignments.filter(a=>a.status==='published');
 const publishedResources=resources.filter(r=>r.is_published);
 return <main className="workspace-shell"><ErpNavigation active="academics"/><div style={{maxWidth:1200,margin:'0 auto',padding:24}}><p className="eyebrow">ACADEMICS / DIGITAL CLASSROOM</p><h1>Learning center</h1><p>Unit resources, assignments, submissions and feedback.</p>{error&&<p role="alert" style={{padding:12,background:'#fff0f0',color:'#991b1b'}}>{error}</p>}
 {student&&!profile?.student_id&&<p role="alert">Your student profile is not linked yet. Ask the Registrar to link it before submitting work.</p>}
 {loading?<p>Loading learning materials…</p>:<><section style={{marginTop:20}}><h2>Published learning resources</h2>{publishedResources.length===0?<p>No published resources are available to your account yet.</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12}}>{publishedResources.map(r=><article key={r.id} style={{border:'1px solid #ddd',borderRadius:12,padding:16}}><strong>{r.title}</strong><p>{r.description||'Learning material'}</p><small>{r.resource_type}</small>{r.resource_url&&<p><a href={r.resource_url} target="_blank" rel="noreferrer">Open resource ↗</a></p>}</article>)}</div>}</section>
 <section style={{marginTop:28}}><h2>Assignments</h2>{publishedAssignments.length===0?<p>No published assignments available.</p>:<div style={{display:'grid',gap:12}}>{publishedAssignments.map(a=>{const prior=submissions.find(s=>s.assignment_id===a.id);return <article key={a.id} style={{border:'1px solid #ddd',borderRadius:12,padding:16}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h3>{a.title}</h3><p>{a.instructions}</p><small>Due: {a.due_at?new Date(a.due_at).toLocaleString():'No deadline'} · Maximum score: {a.max_score}</small></div>{prior&&<span>{prior.status==='marked'?'Marked':prior.status==='late'?'Submitted late':'Submitted'}</span>}</div>{student&&(!prior||['submitted','late'].includes(prior.status))&&<form onSubmit={e=>{e.preventDefault();void submit(a);}} style={{display:'grid',gap:8,marginTop:12}}><label>Submission text<textarea value={drafts[a.id]||''} onChange={e=>setDrafts(s=>({...s,[a.id]:e.target.value}))} rows={4} style={{width:'100%',padding:10}} placeholder="Write your answer or submission notes…"/></label><button type="submit" disabled={busy===a.id}>{busy===a.id?'Submitting…':'Submit assignment'}</button></form>}{prior&&<div style={{marginTop:10}}><strong>Submission status:</strong> {prior.status}{prior.score!==null&&prior.score!==undefined?' · Score: '+prior.score:''}{prior.feedback&&<p>Feedback: {prior.feedback}</p>}</div>}{!student&&<p><small>To publish or manage this assignment, use the Learning, compliance &amp; automation workspace.</small></p>}</article>})}</div>}</section></>}
 <section style={{marginTop:28,border:'1px solid #ddd',borderRadius:12,padding:16}}><h2>Lecturer workspace</h2><p>Staff can create resources and assignments in the connected services workspace. Only assignments marked <strong>published</strong> are visible to eligible students. Student submissions are linked to the authenticated student record and are restricted by database policies.</p><a href="/services">Open learning &amp; services management →</a></section>
 </div></main>;
}
