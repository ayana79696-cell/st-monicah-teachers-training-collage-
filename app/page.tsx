'use client';
import ErpNavigation from '@/components/ErpNavigation';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const modules = [
  {name:'Admissions & Students',table:'college_students',desc:'Applicant records, admission numbers, contacts and enrolment',icon:'ST'},
  {name:'Programmes & Units',table:'college_programmes',desc:'DSTE, approved programmes, units and study modes',icon:'AC'},
  {name:'Academic Periods',table:'college_academic_periods',desc:'Academic years, terms and active periods',icon:'YR'},
  {name:'Timetables',table:'college_timetable_sessions',desc:'Lectures, venues, time slots and study modes',icon:'TT'},
  {name:'Attendance',table:'college_attendance',desc:'Student attendance registers and notes',icon:'AT'},
  {name:'Assessments & Results',table:'college_assessments',desc:'Assessment setup, marks and result approvals',icon:'EX'},
  {name:'Teaching Practice',table:'college_practice_placements',desc:'School placements, supervisors and feedback',icon:'TP'},
  {name:'Fees & Payments',table:'college_fee_charges',desc:'Student charges and fee payment records',icon:'FN'},
  {name:'Staff & HR',table:'college_staff',desc:'Staff profiles, departments and employment status',icon:'HR'},
  {name:'Library',table:'college_library_items',desc:'Catalogue, lending and return management',icon:'LB'},
  {name:'Accommodation',table:'college_hostel_rooms',desc:'Hostel buildings, rooms and capacity',icon:'AC'},
  {name:'Procurement',table:'college_procurement_requests',desc:'Requests, approvals and estimated costs',icon:'PR'},
  {name:'Teaching Practice Partners',table:'college_practice_partners',desc:'Partner schools and placement contacts',icon:'PS'},
  {name:'Communications',table:'college_messages',desc:'College announcements and message history',icon:'CM'},
  {name:'Reports & Audit',table:'college_audit_log',desc:'Auditable activity and operational review',icon:'RP'},
  {name:'Settings & Access',table:'college_profiles',desc:'User profiles, roles and access control',icon:'SA'},
];

type Profile = {id:string; full_name:string; role:string; department?:string|null};
export default function Home() {
  const router = useRouter();
  const [loading,setLoading] = useState(true);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [email,setEmail] = useState('');
  const [name,setName] = useState('');
  const [setup,setSetup] = useState(false);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [counts,setCounts] = useState<Record<string,number>>({});
  const [error,setError] = useState('');
  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const supabase=createClient();
        const {data:{session}}=await supabase.auth.getSession();
        if(!session){router.replace('/login');return;}
        if(!alive)return;
        setEmail(session.user.email ?? '');
        const {data:p,error:pError}=await supabase.from('college_profiles').select('id,full_name,role,department,active').eq('id',session.user.id).maybeSingle();
        if(pError) throw pError;
        if(p?.active){setProfile(p as Profile);}
        else setSetup(true);
        // Do not block the first workspace render on many exact-count database queries.
        // Load only the four headline counts in the background after authentication succeeds.
        if(p?.active) {
          void Promise.all(
            ['college_students','college_programmes','college_staff','college_practice_placements'].map(async table => {
              try {
                const { count } = await supabase.from(table).select('*', { count: 'estimated', head: true });
                return [table, count ?? 0] as const;
              } catch {
                return [table, 0] as const;
              }
            })
          ).then(entries => {
            if (alive) setCounts(Object.fromEntries(entries));
          });
        }
      } catch(e) { if(alive)setError(e instanceof Error?e.message:'Unable to connect to the college database.'); }
      finally {if(alive)setLoading(false);}
    }
    void init();
    return ()=>{alive=false;};
  },[router]);
  async function claimAdmin(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try {
      const supabase=createClient();
      const {error:rpcError}=await supabase.rpc('claim_initial_college_super_admin',{p_full_name:name.trim()});
      if(rpcError)throw rpcError;
      const {data:{session}}=await supabase.auth.getSession();
      if(session) {
        const {data:p,error:pError}=await supabase.from('college_profiles').select('id,full_name,role,department,active').eq('id',session.user.id).single();
        if(pError)throw pError;
        setProfile(p as Profile);setSetup(false);setMessage('Initial Super Administrator account is ready.');
      }
    } catch(e) {setError(e instanceof Error?e.message:'Initial administrator setup failed.');}
    finally {setBusy(false);}
  }
  async function signOut(){const supabase=createClient();await supabase.auth.signOut();router.replace('/login');}
  if(loading)return <main className="login-shell"><section className="login-card"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><h1>Opening college workspace…</h1><p className="muted">Connecting securely to St. Monica’s database.</p></section></main>;
  if(error && !profile && !setup)return <main className="login-shell"><section className="login-card"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><h1>Connection needs attention</h1><p className="error-message">{error}</p><p className="muted">Check that the Supabase URL and public key are configured in Vercel.</p><button onClick={()=>router.push('/login')}>Back to sign in</button></section></main>;
  if(setup)return <main className="login-shell"><section className="login-card"><div className="login-brand"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest" /><div><strong>ST. MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div><p className="eyebrow">ONE-TIME COLLEGE SETUP</p><h1>Set up your administrator</h1><p className="muted">Signed in as {email}. If no college profile exists yet, this account can claim the first Super Administrator role. This action is available only once.</p><form className="login-form" onSubmit={claimAdmin}><label>Administrator full name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120} /></label>{error&&<p className="error-message" role="alert">{error}</p>}<button disabled={busy}>{busy?'Setting up…':'Complete first-time setup'}</button></form><p className="login-foot">After setup, create all other accounts from Settings & Access. Never share your password.</p></section></main>;
  if(!profile)return <main className="login-shell"><section className="login-card"><h1>Profile awaiting access</h1><p className="muted">This sign-in does not have an active college role. Ask the college Super Administrator to activate your profile.</p>{error&&<p className="error-message">{error}</p>}<button onClick={signOut}>Sign out</button></section></main>;
  return <main className="shell">
    <section className="workspace-topbar"><a className="topbar-brand" href="/"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest"/><span><strong>ST. MONICA'S</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <ErpNavigation active="overview"/><div className="topbar-user"><span>{profile.full_name}<small>{profile.role.replaceAll('_',' ')}</small></span><button className="quiet-button" onClick={signOut}>Sign out</button></div>
    </section>
    <section className="content" id="overview"><header><div><p className="eyebrow">ST. MONICA'S · COLLEGE MANAGEMENT</p><h1>College overview</h1><p className="muted">Welcome, {profile.full_name}. Your college workspace is connected to live data.</p></div><div className="status"><i /> Secure session</div></header>
    {message&&<p className="success-message">{message}</p>}
    <section className="welcome welcome-featured" style={{backgroundImage:"linear-gradient(90deg,rgba(38,8,23,.96) 0%,rgba(68,17,40,.82) 48%,rgba(38,8,23,.22) 100%),url(https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1800&q=85)"}}><div className="welcome-copy"><p className="eyebrow light">A CONNECTED CAMPUS · ONE WORKSPACE</p><h2>Everything your college needs. Beautifully connected.</h2><p>Manage students, academics, finance and college services through one clear, modern workspace built for your daily work.</p><a className="hero-action" href="/workspace?module=college_payments"><span>▦</span> Open Finance Dashboard <span>↗</span></a><a className="hero-action" href="/admissions"><span>♙</span> Open Admissions Desk <span>↗</span></a><a className="hero-action" href="/apply" target="_blank">Public application form <span>↗</span></a></div><div className="home-hero-crest"><img className="seal-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah Teacher’s Training College crest"/><span>EXCELLENCE IN TEACHER EDUCATION</span></div><div className="home-hero-orb" aria-hidden="true">✦</div></section>
    <div className="dashboard-stats">{[{label:"Students",value:counts.college_students??0,note:"Admissions & enrolment",table:"college_students",mark:"ST"},{label:"Programmes",value:counts.college_programmes??0,note:"Courses offered",table:"college_programmes",mark:"PR"},{label:"College staff",value:counts.college_staff??0,note:"People & departments",table:"college_staff",mark:"HR"},{label:"Teaching practice",value:counts.college_practice_placements??0,note:"School placements",table:"college_practice_placements",mark:"TP"}].map(stat=><a href={"/workspace?module="+stat.table} className="stat-card" key={stat.table}><span className="stat-mark">{stat.mark}</span><span className="stat-label">{stat.label}</span><strong>{stat.value.toLocaleString()}</strong><span className="stat-note">{stat.note}</span><span className="stat-arrow">↗</span></a>)}</div>
    <div className="section-head"><div><h2>Workspace modules</h2><p className="muted">Purpose-built spaces for admissions, academics and college operations.</p></div><span className="count">{modules.length} WORKSPACES</span></div>
    <div className="module-grid">{modules.map(m=><a className="module module-link" href={'/workspace?module='+encodeURIComponent(m.table)} key={m.table}><div className="module-top"><span className="module-icon">{m.icon}</span><span className="arrow">↗</span></div><h3>{m.name}</h3><p>{m.desc}</p><span className="module-state">{counts[m.table] ?? 0} records · Open module</span></a>)}</div>
    <footer>St. Monica's Teachers Training College <span>Authenticated · Role: {profile.role.replaceAll('_',' ')}</span></footer></section>
  </main>;
}
