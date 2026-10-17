'use client';
import {Suspense,useCallback,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';
type Def=[string,string,[string,string,number?][]];
const relationFields:Record<string,{table:string;label:(row:Record<string,any>)=>string}>={
 programme_id:{table:'college_programmes',label:r=>[r.code,r.title].filter(Boolean).join(' — ')},
 student_id:{table:'college_students',label:r=>[[r.first_name,r.middle_name,r.last_name].filter(Boolean).join(' '),r.admission_number].filter(Boolean).join(' · ')},
 unit_id:{table:'college_units',label:r=>[r.unit_code,r.unit_title].filter(Boolean).join(' — ')},
 academic_period_id:{table:'college_academic_periods',label:r=>[r.academic_year,r.term_name].filter(Boolean).join(' · ')},
 partner_id:{table:'college_practice_partners',label:r=>r.institution_name||'Unnamed partner'},
 supervisor_id:{table:'college_staff',label:r=>[r.full_name,r.staff_number].filter(Boolean).join(' · ')},
 lecturer_id:{table:'college_staff',label:r=>[r.full_name,r.staff_number].filter(Boolean).join(' · ')}
};
const selectOptions:Record<string,string[]> = {
 'college_students.status':['applicant','active','deferred','completed','withdrawn','suspended'],
 'college_students.study_mode':['full_time','school_based','part_time'],
 'college_students.intake':['January','May','September','Other'],
 'college_academic_periods.status':['planned','active','closed'],
 'college_staff.employment_status':['active','leave','terminated'],
 'college_profiles.role':['super_admin','principal','registrar','hod','lecturer','finance','librarian','hostel_manager','student','practice_supervisor'],
 'college_hostel_rooms.gender_section':['women','men','mixed'],
 'college_hostel_allocations.status':['active','ended'],
 'college_enrolments.status':['enrolled','completed','withdrawn'],
 'college_attendance.status':['present','late','absent','excused'],
 'college_assessments.assessment_type':['coursework','practical','exam','teaching_practice'],
 'college_assessments.status':['draft','open','submitted','approved'],
 'college_practice_placements.status':['planned','active','completed','needs_followup'],
 'college_timetable_sessions.study_mode':['full_time','school_based','part_time'],
 'college_timetable_sessions.weekday':['1','2','3','4','5','6','7'],
 'college_payments.payment_method':['mpesa','bank','cash','cheque','scholarship','other'],
 'college_procurement_requests.status':['draft','submitted','approved','rejected','ordered','received'],
 'college_messages.audience':['all_students','programme','staff','individual'],
 'college_messages.channel':['in_app','sms','email'],
 'college_messages.status':['draft','queued','sent','failed'],
 'college_staff.department':['Administration','Academics','Finance','Human Resources','Library','ICT','Student Affairs','Teaching Practice','Procurement'],
 'college_staff.position':['Principal','Deputy Principal','Registrar','Lecturer','Tutor','Finance Officer','Librarian','Administrator','Support Staff']
};
function optionLabel(value:string){return value.replaceAll('_',' ').replace(/\\b\\w/g,letter=>letter.toUpperCase())}
const defs:Def[]=[
['Students','college_students',[['admission_number','Admission number',1],['first_name','First name',1],['middle_name','Middle name'],['last_name','Last name',1],['phone','Phone'],['email','Email'],['study_mode','Study mode'],['intake','Intake'],['status','Status']]],
['Programmes','college_programmes',[['code','Code',1],['title','Programme title',1],['award_level','Award level'],['duration_terms','Duration terms']]],
['Academic periods','college_academic_periods',[['academic_year','Academic year',1],['term_name','Term name',1],['starts_on','Start date'],['ends_on','End date'],['status','Status']]],
['Units','college_units',[['programme_id','Programme',1],['unit_code','Unit code',1],['unit_title','Unit title',1],['term_number','Term number']]],
['Staff','college_staff',[['staff_number','Staff number',1],['full_name','Full name',1],['email','Email'],['phone','Phone'],['department','Department'],['position','Position'],['employment_status','Employment status']]],
['Teaching practice partners','college_practice_partners',[['institution_name','Institution name',1],['county','County'],['contact_person','Contact person'],['phone','Phone'],['email','Email']]],
['Hostel rooms','college_hostel_rooms',[['building','Building',1],['room_number','Room number',1],['capacity','Capacity',1],['gender_section','Section']]],
['Library items','college_library_items',[['title','Title',1],['author','Author'],['isbn','ISBN'],['category','Category']]],
['Procurement requests','college_procurement_requests',[['request_number','Request number',1],['department','Department'],['description','Description',1],['quantity','Quantity',1],['estimated_cost_kes','Estimated cost (KES)'],['status','Status']]],
['Fee charges','college_fee_charges',[['student_id','Student',1],['description','Description',1],['amount_kes','Amount (KES)',1],['due_date','Due date']]],
['Attendance','college_attendance',[['student_id','Student',1],['session_date','Session date',1],['status','Status',1],['notes','Notes']]],
['Assessments','college_assessments',[['unit_id','Unit',1],['academic_period_id','Academic period',1],['title','Title',1],['assessment_type','Type',1],['max_score','Maximum score',1]]],
['Teaching practice placements','college_practice_placements',[['student_id','Student UUID',1],['partner_id','Placement school'],['supervisor_id','Supervisor'],['starts_on','Start date'],['ends_on','End date'],['status','Status']]],
['Timetable sessions','college_timetable_sessions',[['unit_id','Unit'],['lecturer_id','Lecturer'],['weekday','Weekday number'],['starts_at','Start time',1],['ends_at','End time',1],['venue','Venue']]],
['Messages','college_messages',[['audience','Audience',1],['subject','Subject',1],['message_body','Message body',1],['channel','Channel'],['status','Status']]],
['User profiles','college_profiles',[['id','Auth user UUID',1],['full_name','Full name',1],['role','Role',1],['department','Department']]],
['Audit log','college_audit_log',[]]
];
function Page(){const router=useRouter(),params=useSearchParams(),table=params.get('module')||'college_students';const def=defs.find(d=>d[1]===table)||defs[0];const [rows,setRows]=useState<Record<string,any>[]>([]),[profile,setProfile]=useState<any>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[show,setShow]=useState(false),[values,setValues]=useState<Record<string,string>>({}),[search,setSearch]=useState(''),[saving,setSaving]=useState(false),[lookupOptions,setLookupOptions]=useState<Record<string,{value:string;label:string}[]>>({});
const load=useCallback(async()=>{setBusy(true);setError('');try{const db=createClient(),{data:{session}}=await db.auth.getSession();if(!session){router.replace('/login');return;}const {data:p,error:pe}=await db.from('college_profiles').select('full_name,role,active').eq('id',session.user.id).maybeSingle();if(pe)throw pe;if(!p?.active){router.replace('/');return;}setProfile(p);const {data,error:e}=await db.from(def[1]).select('*').limit(100);if(e)throw e;setRows(data||[]);
const needed=Array.from(new Set((def[2] as any[]).map(f=>f[0]).filter((key:string)=>relationFields[key])));
const optionEntries=await Promise.all(needed.map(async key=>{const rel=relationFields[key];const {data:items}=await db.from(rel.table).select('*').limit(500);return [key,(items||[]).map((row:Record<string,any>)=>({value:String(row.id),label:rel.label(row)})).filter((o:{value:string;label:string})=>o.value&&o.label)] as const;}));
setLookupOptions(Object.fromEntries(optionEntries));}catch(e){setError(e instanceof Error?e.message:'Unable to load records.');}finally{setBusy(false);}},[def,router]);
useEffect(()=>{void load()},[load]);
async function save(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');try{const payload:Record<string,any>={};for(const f of def[2] as any[]){const v=(values[f[0]]||'').trim();if(v==='')continue;payload[f[0]]=['capacity','quantity','estimated_cost_kes','amount_kes','max_score','weekday','duration_terms','term_number'].includes(f[0])?Number(v):v;}const {error:e}=await createClient().from(def[1]).insert(payload);if(e)throw e;setValues({});setShow(false);await load();}catch(e){setError(e instanceof Error?e.message:(typeof e==='object'&&e&&'message' in e?String((e as any).message):JSON.stringify(e)||'Save failed. Check required fields and permissions.'))}finally{setSaving(false)}}
const visible=rows.filter(r=>JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='id'&&!k.endsWith('_id')))).toLowerCase().includes(search.toLowerCase())),cols=rows.length?Object.keys(rows[0]).filter(k=>!['id','created_at','updated_at','student_id','unit_id','programme_id','academic_period_id','partner_id','supervisor_id','lecturer_id','profile_id','user_id'].includes(k)&&!k.endsWith('_id')).slice(0,7):[];
return <main className="shell"><aside className="sidebar"><div className="brand"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div><p className="nav-label">COLLEGE WORKSPACE</p><a className="nav" href="/">← Overview</a>{defs.map(d=><a key={d[1]} className={'nav '+(d[1]===def[1]?'active':'')} href={'/workspace?module='+d[1]}>{d[0]}</a>)}<div className="sidebar-foot">{profile?.full_name||'College user'}<span>{profile?.role||''}</span><button className="quiet-button" onClick={async()=>{await createClient().auth.signOut();router.replace('/login')}}>Sign out</button></div></aside><section className="content"><header><div><p className="eyebrow">COLLEGE WORKSPACE / LIVE RECORDS</p><h1>{def[0]}</h1><p className="muted">View and manage authorised records stored in the college database.</p></div><div className="status"><i/>Live database</div></header>{error&&<p className="error-message">{error}</p>}<div className="section-head"><div><h2>Records</h2><p className="muted">{rows.length} records loaded (up to 100)</p></div><div className="toolbar"><input className="search-input" placeholder="Search records…" value={search} onChange={e=>setSearch(e.target.value)}/><button className="secondary-button" onClick={()=>void load()}>Refresh</button>{def[2].length>0&&<button className="primary-button" onClick={()=>setShow(!show)}>{show?'Cancel':'＋ Add record'}</button>}</div></div>{show&&<form className="record-form" onSubmit={save}><h2>New {def[0].toLowerCase()} record</h2><div className="form-grid">{(def[2] as any[]).map(f=><label key={f[0]}>{f[1]}{f[2]?' *':''}{relationFields[f[0]]?<select required={!!f[2]} value={values[f[0]]||''} onChange={e=>setValues(v=>({...v,[f[0]]:e.target.value}))}><option value="">Choose {f[1].toLowerCase()}</option>{(lookupOptions[f[0]]||[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:(selectOptions[def[1]+'.'+f[0]]||selectOptions[f[0]])?<select required={!!f[2]} value={values[f[0]]||''} onChange={e=>setValues(v=>({...v,[f[0]]:e.target.value}))}><option value="">Choose {f[1].toLowerCase()}</option>{(selectOptions[def[1]+'.'+f[0]]||selectOptions[f[0]]).map(option=><option key={option} value={option}>{optionLabel(option)}</option>)}</select>:f[0]==='id'?<input value="Assigned automatically" disabled aria-label="System-managed user ID"/>:<input required={!!f[2]} type={f[0].includes('date')||f[0]==='starts_on'||f[0]==='ends_on'?'date':f[0].includes('email')?'email':'text'} value={values[f[0]]||''} onChange={e=>setValues(v=>({...v,[f[0]]:e.target.value}))}/>}</label>)}</div><button disabled={saving} className="primary-button">{saving?'Saving…':'Save record'}</button></form>}{busy?<p className="empty-state">Loading live records…</p>:visible.length===0?<p className="empty-state">No matching records. Add a record or try another search.</p>:<div className="table-wrap"><table className="records-table"><thead><tr>{cols.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{visible.map((r,i)=><tr key={r.id||i}>{cols.map(c=><td key={c}>{r[c]===null||r[c]===undefined?'—':c.endsWith('_id')?'—':String(r[c])}</td>)}</tr>)}</tbody></table></div>}<footer>Saint Monica's Teachers Training College <span>Database permissions apply to every request.</span></footer></section></main>}
export default function Workspace(){return <Suspense fallback={<main className="login-shell">Opening module…</main>}><Page/></Suspense>}
