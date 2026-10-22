'use client';
import ErpNavigation from '@/components/ErpNavigation';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

type Row=Record<string,any>;
const modules=[
 {key:'college_parent_links',title:'Parent/student links',fields:[['parent_profile_id','Parent profile UUID','text'],['student_id','Student UUID','text'],['relationship','Relationship','text'],['active','Active (true/false)','select:true,false']],label:'student_id'},
 {key:'college_learning_resources',title:'Learning resources',fields:[['title','Title','text'],['description','Description','textarea'],['resource_type','Type','select:document,video,link,presentation,reading'],['resource_url','Resource URL','text'],['unit_id','Unit ID (optional)','text'],['is_published','Publish to students','select:true,false']],label:'title'},
 {key:'college_learning_assignments',title:'Learning assignments',fields:[['unit_id','Unit ID','text'],['title','Title','text'],['instructions','Instructions','textarea'],['due_at','Due date','datetime-local'],['max_score','Maximum score','number'],['status','Status','select:draft,published,closed']],label:'title'},
 {key:'college_unit_registrations',title:'Unit registration',fields:[['student_id','Student UUID','text'],['unit_id','Unit UUID','text'],['academic_period_id','Academic period UUID','text'],['status','Status','select:registered,completed,withdrawn'],['notes','Notes','textarea']],label:'student_id'},
 {key:'college_graduation_clearance',title:'Graduation clearance',fields:[['student_id','Student UUID','text'],['academic_period_id','Academic period UUID','text'],['clearance_area','Clearance area','text'],['status','Status','select:pending,cleared,blocked'],['notes','Notes','textarea']],label:'clearance_area'},
 {key:'college_quality_records',title:'Quality & compliance',fields:[['record_type','Record type','select:accreditation,inspection,policy,curriculum_review,trainer_qualification,approval,evidence,other'],['title','Title','text'],['details','Details','textarea'],['reference_number','Reference number','text'],['owner_name','Responsible person','text'],['issued_on','Issued on','date'],['expires_on','Expires on','date'],['status','Status','select:draft,active,submitted,approved,expired,closed'],['file_url','Evidence link','text']],label:'title'},
 {key:'college_workflow_rules',title:'Workflow rules',fields:[['name','Rule name','text'],['trigger_event','Trigger event','select:overdue_fees,attendance_absence,missing_marks,quality_expiry,admission_pending,manual'],['threshold','Threshold','number'],['reminder_hours','Reminder hours','number'],['escalate_to_role','Escalate to role','select:principal,super_admin,registrar,finance,hr,hod'],['message_template','Reminder template','textarea']],label:'name'},
 {key:'college_early_warning_alerts',title:'Early-warning alerts',fields:[['alert_key','Alert key','text'],['category','Category','select:attendance,academic,fees,quality,operations'],['severity','Severity','select:low,medium,high'],['title','Title','text'],['details','Details','textarea'],['status','Status','select:open,reviewing,resolved,dismissed']],label:'title'},
 {key:'college_document_review_items',title:'Document review',fields:[['student_id','Student UUID','text'],['application_id','Application UUID (optional)','text'],['document_type','Document type','text'],['storage_path','Private storage path','text'],['status','Status','select:pending,verified,rejected,missing'],['reviewer_notes','Reviewer notes','textarea']],label:'document_type'},
 {key:'college_finance_import_batches',title:'Finance import audit',fields:[['source_name','Statement/source','text'],['imported_rows','Imported rows','number'],['matched_rows','Matched rows','number'],['skipped_rows','Skipped rows','number'],['duplicate_rows','Duplicate rows','number'],['status','Status','select:processing,completed,failed'],['notes','Notes','textarea']],label:'source_name'},
 {key:'college_message_deliveries',title:'Message delivery statuses',fields:[['destination','Destination','text'],['channel','Channel','select:sms,email'],['status','Status','select:queued,submitted,delivered,failed'],['provider','Provider','text'],['provider_message_id','Provider message ID','text'],['error_message','Error details','textarea']],label:'destination'}
] as const;
type Mod=typeof modules[number];
export default function ServicesPage(){
 const router=useRouter();const db=useMemo(()=>createClient(),[]);
 const [key,setKey]=useState<string>(modules[0].key);const [rows,setRows]=useState<Row[]>([]);
 const [form,setForm]=useState<Row>({});const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');const [search,setSearch]=useState('');
 const [profile,setProfile]=useState<Row|null>(null);
 const mod=modules.find(m=>m.key===key)||modules[0];
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const {data:{session}}=await db.auth.getSession();if(!session){router.replace('/login');return;}
   const {data:p,error:pe}=await db.from('college_profiles').select('id,role,active').eq('id',session.user.id).maybeSingle();
   if(pe)throw pe;if(!p?.active){router.replace('/');return;}setProfile(p);
   const {data,error:e}=await db.from(key).select('*').order('created_at',{ascending:false}).limit(250);if(e)throw e;setRows(data||[]);
  }catch(e:any){setError([e?.message,e?.details,e?.hint,e?.code?'Code: '+e.code:null].filter(Boolean).join(' — ')||'Unable to load records.');}
  finally{setLoading(false);}
 },[db,key,router]);
 useEffect(()=>{void load();},[load]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');
  if(!profile||!['super_admin','principal','registrar','finance','hr','hod','lecturer','practice_supervisor','ict_admin'].includes(profile.role)){setError('Your role does not have permission to add these records.');setBusy(false);return;}
  try{const payload:Row={};for(const f of mod.fields){const [name,,type]=f;const value=form[name];if(value!==''&&value!==undefined&&value!==null)payload[name]=type==='number'?Number(value):(['is_published','active'].includes(name)?value==='true':value);}
   if(['college_learning_resources','college_quality_records','college_workflow_rules','college_finance_import_batches'].includes(key))payload.created_by=profile.id;
   if(key==='college_unit_registrations')payload.registered_by=profile.id;
   const {error:e2}=await db.from(key).insert(payload);if(e2)throw e2;
   setNotice('Saved to the college database.');setForm({});await load();
  }catch(e:any){setError([e?.message,e?.details,e?.hint,e?.code?'Code: '+e.code:null].filter(Boolean).join(' — ')||'Save failed.');}
  finally{setBusy(false);}
 }
 async function setStatus(row:Row,status:string){setError('');const changes:Row={status};
  if(key==='college_early_warning_alerts'&&status==='resolved'){changes.resolved_at=new Date().toISOString();changes.resolved_by=profile?.id;}
  if(key==='college_document_review_items'){changes.reviewed_by=profile?.id;changes.reviewed_at=new Date().toISOString();}
  if(key==='college_graduation_clearance'){changes.reviewed_by=profile?.id;changes.reviewed_at=new Date().toISOString();}
  const {error:e}=await db.from(key).update(changes).eq('id',row.id);if(e){setError(e.message);return;}setNotice('Status updated.');await load();
 }
 const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 return <main className="workspace-shell"><ErpNavigation active="overview"/><div style={{maxWidth:1400,margin:'0 auto',padding:24}}>
 <header style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}><div><p className="eyebrow">COLLEGE SERVICES / BLUEPRINT COMPLETION</p><h1>Learning, compliance & automation</h1><p>Connected records and operational tools for the college.</p></div><button onClick={()=>void load()} disabled={loading}>Refresh records</button></header>
 <nav aria-label="Service modules" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,margin:'20px 0'}}>{modules.map(m=><button key={m.key} onClick={()=>{setKey(m.key);setForm({});setSearch('');setError('');setNotice('');}} style={{padding:12,textAlign:'left',borderRadius:10,border:key===m.key?'2px solid #7b1e35':'1px solid #ddd',background:key===m.key?'#fff6f8':'white'}}><strong>{m.title}</strong></button>)}</nav>
 <section style={{display:'grid',gridTemplateColumns:'minmax(260px,360px) minmax(0,1fr)',gap:18,alignItems:'start'}}><form onSubmit={save} style={{border:'1px solid #ddd',borderRadius:14,padding:16,display:'grid',gap:12}}><h2>Add: {mod.title}</h2>{mod.fields.map(f=>{const [name,label,type]=f;return <label key={name} style={{display:'grid',gap:5,fontSize:13}}>{label}{type.startsWith('select:')?<select value={form[name]||''} onChange={e=>setForm((s:Row)=>({...s,[name]:e.target.value}))} required={!name.includes('optional')}><option value="">Choose…</option>{type.slice(7).split(',').map(o=><option key={o} value={o}>{o}</option>)}</select>:type==='textarea'?<textarea value={form[name]||''} onChange={e=>setForm((s:Row)=>({...s,[name]:e.target.value}))}/>:<input type={type} value={form[name]||''} onChange={e=>setForm((s:Row)=>({...s,[name]:e.target.value}))} required={['title','name','trigger_event','record_type','source_name','destination','alert_key','category','severity','details','document_type','clearance_area','student_id','unit_id','academic_period_id','instructions'].includes(name)}/>}</label>})}<button type="submit" disabled={busy||loading}>{busy?'Saving…':'Save record'}</button><small>Records save to Supabase and are subject to row-level security.</small></form>
 <div style={{border:'1px solid #ddd',borderRadius:14,padding:16,minWidth:0}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}><h2>Saved records ({rows.length})</h2><input placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)} /></div>
 {error&&<p role="alert" style={{padding:10,background:'#fff0f0',color:'#991b1b'}}>{error}</p>}{notice&&<p role="status" style={{padding:10,background:'#effdf5',color:'#065f46'}}>{notice}</p>}
 {loading?<p>Loading records…</p>:filtered.length===0?<p>No matching records. Add a record or change your search.</p>:<div style={{display:'grid',gap:8,marginTop:12}}>{filtered.map(row=><article key={row.id} style={{border:'1px solid #eee',borderRadius:10,padding:12,display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div style={{minWidth:0}}><strong>{String(row[mod.label]||row.title||row.name||row.id)}</strong><p style={{overflowWrap:'anywhere',fontSize:13}}>{String(row.details||row.description||row.notes||row.message_template||row.resource_url||row.error_message||'')}</p><small>{row.created_at?new Date(row.created_at).toLocaleString():''}</small></div><div style={{display:'grid',gap:6,alignContent:'start'}}>{row.status&&<span>{String(row.status).replaceAll('_',' ')}</span>}{['college_early_warning_alerts','college_document_review_items','college_graduation_clearance'].includes(key)&&row.status&&<select aria-label="Update record status" value={row.status} onChange={e=>void setStatus(row,e.target.value)}>{(key==='college_early_warning_alerts'?['open','reviewing','resolved','dismissed']:key==='college_document_review_items'?['pending','verified','rejected','missing']:['pending','cleared','blocked']).map(s=><option key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select>}</div></article>)}</div>}</div></section>
 <section style={{marginTop:20,padding:18,border:'1px solid #ddd',borderRadius:14}}><h2>Provider setup and go-live safeguards</h2><p><strong>Payments:</strong> import audit and payment-intent records are available, but live M-Pesa/bank collection requires merchant credentials, signed callback validation, idempotency and reconciliation tests.</p><p><strong>SMS/email:</strong> delivery status records are available; queued is not delivered. Provider and approved sender setup is required.</p><p><strong>Document extraction:</strong> this review queue tracks human verification; automatic OCR is not active here.</p><p><strong>Security:</strong> enable privileged-account MFA, confirm protected backups, and test restore in a non-production project before go-live.</p></section>
 </div><style jsx>{`@media(max-width:850px){section[style*="grid-template-columns"]{grid-template-columns:1fr!important}}`}</style></main>;
}
