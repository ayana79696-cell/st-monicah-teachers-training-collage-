'use client';

import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import {createClient} from '@/lib/supabase/client';

type Profile={id:string;full_name:string;role:string;department?:string|null;phone?:string|null;active:boolean;created_at?:string};
const crest='https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const roles=[
 {value:'super_admin',label:'Super administrator',description:'Full system access and user/role management'},
 {value:'principal',label:'Principal',description:'College-wide academic oversight and reports'},
 {value:'registrar',label:'Registrar',description:'Admissions, student records and registration'},
 {value:'hod',label:'Head of department',description:'Academic department and programme workflows'},
 {value:'lecturer',label:'Lecturer',description:'Teaching, units, assessments and permitted attendance'},
 {value:'finance',label:'Finance officer',description:'Payments, fee charges, discounts and statements'},
 {value:'librarian',label:'Librarian',description:'Library records and circulation workflows'},
 {value:'hostel_manager',label:'Hostel manager',description:'Accommodation and hostel records'},
 {value:'practice_supervisor',label:'Teaching practice supervisor',description:'Teaching practice placements and visits'},
 {value:'student',label:'Student',description:'Student-level access where enabled'}
];
export default function RolesPage(){
 const router=useRouter();
 const [profile,setProfile]=useState<Profile|null>(null);
 const [users,setUsers]=useState<Profile[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState<string|null>(null);
 const [search,setSearch]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [roleDrafts,setRoleDrafts]=useState<Record<string,string>>({});
 const [activeDrafts,setActiveDrafts]=useState<Record<string,boolean>>({});
 const db=createClient();
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{session}}=await db.auth.getSession();
   if(!session){router.replace('/login');return;}
   const {data:current,error:currentError}=await db.from('college_profiles').select('id,full_name,role,department,phone,active,created_at').eq('id',session.user.id).maybeSingle();
   if(currentError)throw currentError;
   if(!current?.active){router.replace('/login');return;}
   setProfile(current as Profile);
   if(current.role!=='super_admin'){setError('Only the Super Administrator can manage login access and roles.');setUsers([]);return;}
   const {data,error:userError}=await db.from('college_profiles').select('id,full_name,role,department,phone,active,created_at').order('full_name').limit(1000);
   if(userError)throw userError;
   const list=(userError?[]:user||[]) as Profile[];setUsers(list);
   setRoleDrafts(Object.fromEntries(list.map(u=>[u.id,u.role])));
   setActiveDrafts(Object.fromEntries(list.map(u=>[u.id,u.active])));
  }catch(e:any){setError(e?.message||'Unable to load access profiles.');}
  finally{setLoading(false);}
 },[router]);
 useEffect(()=>{void load();},[load]);
 async function saveUser(user:Profile){
  if(profile?.role!=='super_admin'){setError('Only the Super Administrator can change roles.');return;}
  const role=roleDrafts[user.id]||user.role,active=activeDrafts[user.id]??user.active;
  if(user.id===profile.id&&!active){setError('You cannot deactivate your own administrator login.');return;}
  if(user.id===profile.id&&role!=='super_admin'){setError('Keep at least one Super Administrator. You cannot remove your own Super Administrator role here.');return;}
  if(!confirm('Save access changes for '+user.full_name+'?'+(!active?' This will block this account from entering the ERP.':'')))return;
  setSaving(user.id);setError('');setNotice('');
  try{
   const {error:e}=await db.from('college_profiles').update({role,active}).eq('id',user.id);
   if(e)throw e;
   setNotice('Access updated for '+user.full_name+'. Their next request will use the new role and active status.');
   await load();
  }catch(e:any){setError(e?.message||'Could not update this account. Check database permissions and the role constraint.');}
  finally{setSaving(null);}
 }
 const visible=users.filter(u=>[u.full_name,u.role,u.department,u.phone].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()));
 return <main className="shell roles-shell">
  <section className="workspace-topbar no-print"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="roles"/><div className="topbar-user"><span>{profile?.full_name||'College user'}<small>{profile?.role||''}</small></span><button className="quiet-button" onClick={async()=>{await db.auth.signOut();router.replace('/login')}}>Sign out</button></div></section>
  <section className="content roles-content">
   <header className="workspace-record-header"><div><p className="eyebrow">SYSTEM ADMINISTRATION / SECURITY</p><h1>Roles &amp; Access</h1><p className="muted">Control which authenticated college accounts can enter the ERP and which role permissions they receive.</p></div><div className="status"><i/>Role management</div></header>
   <section className="module-hero roles-hero"><div className="module-hero-copy"><span className="module-hero-eyebrow">LOGIN ACCESS • PERMISSIONS</span><h2>Give the right people the right access.</h2><p>Assign a role to each existing login and suspend access when necessary. Changes are saved to the college profile used by the ERP.</p><span className="module-hero-tags">Authenticated accounts • Role-based access • Active / suspended</span></div><div className="module-hero-orb"><span>♙</span></div></section>
   {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
   {profile?.role==='super_admin'&&<><div className="roles-stats"><article><span>Login profiles</span><strong>{users.length}</strong></article><article><span>Active accounts</span><strong>{users.filter(u=>u.active).length}</strong></article><article><span>Suspended accounts</span><strong>{users.filter(u=>!u.active).length}</strong></article><article><span>Role types</span><strong>{new Set(users.map(u=>u.role)).size}</strong></article></div>
    <section className="roles-panel"><div className="roles-panel-head"><div><p className="eyebrow">USER DIRECTORY</p><h2>Manage login permissions</h2><p className="muted">This page changes roles for accounts that already exist in Supabase Authentication.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
     <div className="roles-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, role, department or phone…"/><span>{visible.length} account{visible.length===1?'':'s'}</span></div>
     <div className="roles-table-wrap"><table className="roles-table"><thead><tr><th>User</th><th>Role</th><th>Login status</th><th>Access summary</th><th>Save</th></tr></thead><tbody>{visible.map(user=><tr key={user.id}><td><strong>{user.full_name}</strong><small>{user.department||'No department assigned'}</small><small className="roles-user-id">Account: {user.id.slice(0,8)}…</small></td><td><select aria-label={'Role for '+user.full_name} value={roleDrafts[user.id]||user.role} onChange={e=>setRoleDrafts(d=>({...d,[user.id]:e.target.value}))}>{roles.map(role=><option value={role.value} key={role.value}>{role.label}</option>)}</select></td><td><label className="roles-active-toggle"><input type="checkbox" checked={activeDrafts[user.id]??user.active} onChange={e=>setActiveDrafts(d=>({...d,[user.id]:e.target.checked}))}/><span>{(activeDrafts[user.id]??user.active)?'Active':'Suspended'}</span></label></td><td className="roles-description">{roles.find(r=>r.value===(roleDrafts[user.id]||user.role))?.description||'Role-based module access'}</td><td><button className="primary-button roles-save-button" disabled={saving===user.id||((roleDrafts[user.id]||user.role)===user.role&&(activeDrafts[user.id]??user.active)===user.active)} onClick={()=>void saveUser(user)}>{saving===user.id?'Saving…':'Save access'}</button></td></tr>)}{!loading&&visible.length===0&&<tr><td colSpan={5} className="roles-empty">No login profiles match that search.</td></tr>}{loading&&<tr><td colSpan={5} className="roles-empty">Loading access profiles…</td></tr>}</tbody></table></div>
    </section>
    <aside className="roles-note"><strong>Important:</strong> Create the person's login first in Supabase Authentication, then ensure a matching college profile exists. This page assigns the ERP role and active status; it does not reveal passwords or create authentication credentials. Avoid suspending your only Super Administrator account.</aside>
   </>}
   <footer className="roles-footer">St. Monicah Teachers Training College <span>Only Super Administrator accounts can manage roles.</span></footer>
  </section>
 </main>;
}
