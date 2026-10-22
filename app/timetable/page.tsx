'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Session = { id:string; unit_id:string|null; lecturer_id:string|null; academic_period_id:string|null; study_mode:string|null; weekday:number|null; starts_at:string; ends_at:string; venue:string|null; session_date:string|null; unit_label:string; lecturer_label:string; period_label:string };
type Cache = { key:string; rows:Session[]; cached_at:string };
const DB='st-monicah-field-companion';
const STORE='timetable';
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const pretty=(value:string|null|undefined)=>value ? value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()) : 'Not set';
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,3);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('drafts')){const s=db.createObjectStore('drafts',{keyPath:'client_record_id'});s.createIndex('owner_id','owner_id',{unique:false});s.createIndex('sync_state','sync_state',{unique:false});}if(!db.objectStoreNames.contains('assignments'))db.createObjectStore('assignments',{keyPath:'owner_id'});if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error??new Error('Local storage is unavailable.'));});}
async function readCache():Promise<Cache|null>{const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get('all');req.onsuccess=()=>{db.close();resolve(req.result??null)};req.onerror=()=>{db.close();reject(req.error)}})}
async function writeCache(rows:Session[]){const db=await openDb();return new Promise<void>((resolve,reject)=>{const req=db.transaction(STORE,'readwrite').objectStore(STORE).put({key:'all',rows,cached_at:new Date().toISOString()});req.onsuccess=()=>{db.close();resolve()};req.onerror=()=>{db.close();reject(req.error)}})}
function timeLabel(t:string){return t?.slice(0,5)??''}
function dateLabel(value:string){return new Date(value+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}

export default function TimetablePage(){
 const router=useRouter(); const supabase=useMemo(()=>createClient(),[]);
 const [rows,setRows]=useState<Session[]>([]); const [loading,setLoading]=useState(true); const [online,setOnline]=useState(true); const [cachedAt,setCachedAt]=useState(''); const [notice,setNotice]=useState(''); const [error,setError]=useState(''); const [day,setDay]=useState('all'); const [mode,setMode]=useState('all'); const [weekView,setWeekView]=useState<'week'|'list'>('week');
 const load=useCallback(async()=>{
   setError(''); setNotice('');
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){router.replace('/login');return;}
   if(!navigator.onLine){const cached=await readCache();if(!cached){setError('No timetable has been saved on this device yet. Connect to the internet, open Timetable, and refresh it once before going offline.');return;}setRows(cached.rows);setCachedAt(cached.cached_at);return;}
   const {data:base,error:baseError}=await supabase.from('college_timetable_sessions').select('id,unit_id,lecturer_id,academic_period_id,study_mode,weekday,starts_at,ends_at,venue,session_date').order('weekday',{ascending:true}).order('starts_at',{ascending:true}).limit(1000);
   if(baseError)throw baseError;
   const sessions=base??[];
   const unitIds=[...new Set(sessions.map((r:any)=>r.unit_id).filter(Boolean))];
   const lecturerIds=[...new Set(sessions.map((r:any)=>r.lecturer_id).filter(Boolean))];
   const periodIds=[...new Set(sessions.map((r:any)=>r.academic_period_id).filter(Boolean))];
   const [units,staff,periods]=await Promise.all([
     unitIds.length?supabase.from('college_units').select('id,unit_code,unit_title').in('id',unitIds):Promise.resolve({data:[],error:null} as any),
     lecturerIds.length?supabase.from('college_staff').select('id,full_name').in('id',lecturerIds):Promise.resolve({data:[],error:null} as any),
     periodIds.length?supabase.from('college_academic_periods').select('id,academic_year,term_name').in('id',periodIds):Promise.resolve({data:[],error:null} as any)
   ]);
   if(units.error)throw units.error;if(staff.error)throw staff.error;if(periods.error)throw periods.error;
   const um=new Map<string,string>((units.data??[]).map((x:any)=>[x.id,[x.unit_code,x.unit_title].filter(Boolean).join(' · ')] as [string,string]));
   const sm=new Map<string,string>((staff.data??[]).map((x:any)=>[x.id,x.full_name] as [string,string]));
   const pm=new Map<string,string>((periods.data??[]).map((x:any)=>[x.id,[x.academic_year,x.term_name].filter(Boolean).join(' · ')] as [string,string]));
   const mapped:Session[]=sessions.map((r:any)=>({...r,unit_label:um.get(r.unit_id)??'Unit not assigned',lecturer_label:sm.get(r.lecturer_id)??'Lecturer not assigned',period_label:pm.get(r.academic_period_id)??'Academic period not set'}));
   await writeCache(mapped);const cached=await readCache();setRows(mapped);setCachedAt(cached?.cached_at??new Date().toISOString());setNotice('Timetable refreshed and saved on this device for offline viewing.');
 },[router,supabase]);
 useEffect(()=>{const on=()=>setOnline(true);const off=()=>setOnline(false);setOnline(navigator.onLine);window.addEventListener('online',on);window.addEventListener('offline',off);let alive=true;void load().catch(e=>{if(alive)setError(e instanceof Error?e.message:'Could not load timetable.');}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false;window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[load]);
 const filtered=rows.filter(r=>(day==='all'||String(r.weekday??'')===day)&&(mode==='all'||r.study_mode===mode)).sort((a,b)=>(a.weekday??8)-(b.weekday??8)||a.starts_at.localeCompare(b.starts_at));
 const grouped=days.map((name,i)=>({name,weekday:i+1,items:filtered.filter(r=>r.weekday===i+1)})).filter(g=>day==='all'||String(g.weekday)===day);
 if(loading)return <main className="login-shell"><section className="login-card"><h1>Loading timetable…</h1><p className="muted">Opening the college schedule.</p></section></main>;
 return <main className="shell"><section className="workspace-topbar"><a className="topbar-brand" href="/"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah crest"/><span><strong>ST. MONICA'S</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="academics"/><div className="topbar-user"><span>Timetable<small>{online?'Online':'Offline copy'}</small></span><button className="quiet-button" onClick={async()=>{await supabase.auth.signOut();router.replace('/login')}}>Sign out</button></div></section>
 <section className="content timetable-content"><header><div><p className="eyebrow">ACADEMICS · CLASS SCHEDULE</p><h1>College Timetable</h1><p className="muted">Your saved timetable remains available on this device when the internet is unavailable.</p></div><div className={'field-connectivity '+(online?'is-online':'is-offline')}><i/>{online?'Online':'Offline copy'}</div></header>
 {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
 <div className="timetable-toolbar"><label>Day<select value={day} onChange={e=>setDay(e.target.value)}><option value="all">All days</option>{days.map((d,i)=><option key={d} value={String(i+1)}>{d}</option>)}</select></label><label>Study mode<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">All study modes</option><option value="full_time">Full-time</option><option value="school_based">School-based</option><option value="part_time">Part-time</option></select></label><div className="timetable-toolbar-actions"><button className="field-button secondary" disabled={!online} onClick={()=>void load().catch(e=>setError(e instanceof Error?e.message:'Refresh failed.'))}>↻ Refresh & save offline</button><a className="field-button primary" href="/workspace?module=college_timetable_sessions">Manage timetable</a></div></div>
 <div className="timetable-cache-note"><strong>{online?'Connected':'Offline mode'}</strong><span>{cachedAt?'Saved on this device '+new Date(cachedAt).toLocaleString():'No saved timetable yet'} · {rows.length} sessions cached</span></div>
 <div className="timetable-view-toggle"><button className={weekView==='week'?'selected':''} onClick={()=>setWeekView('week')}>Weekly view</button><button className={weekView==='list'?'selected':''} onClick={()=>setWeekView('list')}>List view</button></div>
 {rows.length===0?<section className="field-panel timetable-empty"><h2>No timetable sessions found</h2><p className="muted">Once sessions are entered, refresh this page online to save them for offline use.</p><a className="field-button primary" href="/workspace?module=college_timetable_sessions">Open timetable management</a></section>:weekView==='week'?<div className="timetable-week">{grouped.map(g=><section className="timetable-day" key={g.weekday}><div className="timetable-day-heading"><h2>{g.name}</h2><span>{g.items.length} {g.items.length===1?'session':'sessions'}</span></div>{g.items.length===0?<p className="timetable-no-session">No scheduled sessions</p>:g.items.map(r=><article className="timetable-session" key={r.id}><div className="timetable-time"><strong>{timeLabel(r.starts_at)}</strong><span>to {timeLabel(r.ends_at)}</span></div><div className="timetable-session-detail"><strong>{r.unit_label}</strong><span>{r.lecturer_label}</span><small>{r.venue||'Venue not set'} · {pretty(r.study_mode)}</small>{r.session_date&&<small>Date: {dateLabel(r.session_date)}</small>}</div></article>)}</section>)}</div>:<div className="timetable-list">{filtered.map(r=><article className="timetable-session" key={r.id}><div className="timetable-time"><strong>{days[(r.weekday??1)-1]??'Day not set'}</strong><span>{timeLabel(r.starts_at)}–{timeLabel(r.ends_at)}</span></div><div className="timetable-session-detail"><strong>{r.unit_label}</strong><span>{r.lecturer_label}</span><small>{r.venue||'Venue not set'} · {pretty(r.study_mode)}</small><small>{r.period_label}{r.session_date?' · '+dateLabel(r.session_date):''}</small></div></article>)}</div>}
 <footer>St. Monicah Teachers Training College · <a href="/field-companion">Offline Field Companion</a> · <a href="/workspace?module=college_timetable_sessions">Timetable management</a></footer></section></main>
}
