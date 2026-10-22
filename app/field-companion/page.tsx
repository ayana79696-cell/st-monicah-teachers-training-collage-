'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Placement = {
  id: string; student_id: string; partner_id: string | null; supervisor_id: string | null;
  starts_on: string | null; ends_on: string | null; status: string; approval_status: string;
  student_label: string; school_label: string;
};
type Draft = {
  client_record_id: string; owner_id: string; placement_id: string; visit_date: string;
  visit_type: string; observer_id: string | null; lesson_subject: string; lesson_topic: string;
  lesson_plan_notes: string; lesson_observation: string; trainee_reflection: string;
  score: string; maximum_score: string; feedback: string; action_points: string;
  follow_up_required: boolean; supervisor_verified: boolean; verified_at: string | null;
  supervisor_verified_by: string | null; gps_latitude: number | null; gps_longitude: number | null;
  gps_accuracy_m: number | null; client_recorded_at: string; created_by: string;
  sync_state: 'pending' | 'synced'; local_updated_at: string;
};
type Profile = { id: string; full_name: string; role: string; active: boolean };
const DB_NAME = 'st-monicah-field-companion';
const STORE = 'drafts';
const ALLOWED_ROLES = ['super_admin', 'principal', 'practice_supervisor'];

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_record_id' });
        store.createIndex('owner_id', 'owner_id', { unique: false });
        store.createIndex('sync_state', 'sync_state', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local draft storage could not open.'));
  });
}
async function allDrafts(): Promise<Draft[]> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => { resolve((req.result ?? []) as Draft[]); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  });
}
async function putDraft(draft: Draft): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(draft);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error ?? new Error('Could not save draft on this device.')); };
  });
}
async function deleteDraft(id: string): Promise<void> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => { db.close(); resolve(); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
function todayLocal() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export default function FieldCompanionPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [gpsState, setGpsState] = useState('GPS not requested');
  const [gps, setGps] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [form, setForm] = useState({
    placement_id: '', visit_date: todayLocal(), visit_type: 'observation', lesson_subject: '',
    lesson_topic: '', lesson_plan_notes: '', lesson_observation: '', trainee_reflection: '',
    score: '', maximum_score: '100', feedback: '', action_points: '', follow_up_required: false,
    supervisor_verified: false,
  });

  const refreshDrafts = useCallback(async (ownerId: string) => {
    try {
      const all = await allDrafts();
      setDrafts(all.filter(d => d.owner_id === ownerId).sort((a, b) => b.local_updated_at.localeCompare(a.local_updated_at)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Local draft storage is unavailable. Do not continue offline until it is fixed.');
    }
  }, []);

  const loadAssignments = useCallback(async (userId: string, userEmail: string) => {
    const { data: raw, error: placementError } = await supabase
      .from('college_practice_placements')
      .select('id,student_id,partner_id,supervisor_id,starts_on,ends_on,status,approval_status')
      .in('status', ['active', 'planned', 'needs_followup'])
      .order('created_at', { ascending: false })
      .limit(500);
    if (placementError) throw placementError;
    const rows = raw ?? [];
    const studentIds = [...new Set(rows.map((r: any) => r.student_id).filter(Boolean))];
    const partnerIds = [...new Set(rows.map((r: any) => r.partner_id).filter(Boolean))];
    const [studentsResult, partnersResult, staffResult] = await Promise.all([
      studentIds.length ? supabase.from('college_students').select('id,first_name,middle_name,last_name,admission_number').in('id', studentIds) : Promise.resolve({ data: [], error: null } as any),
      partnerIds.length ? supabase.from('college_practice_partners').select('id,institution_name').in('id', partnerIds) : Promise.resolve({ data: [], error: null } as any),
      userEmail ? supabase.from('college_staff').select('id').eq('email', userEmail).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    ]);
    if (studentsResult.error) throw studentsResult.error;
    if (partnersResult.error) throw partnersResult.error;
    const studentMap = new Map((studentsResult.data ?? []).map((s: any) => [s.id, [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') + (s.admission_number ? ' · ' + s.admission_number : '')]));
    const partnerMap = new Map((partnersResult.data ?? []).map((p: any) => [p.id, p.institution_name]));
    const visibleRows = rows.filter((r: any) => r.supervisor_id === null || r.supervisor_id === staffResult.data?.id);
    const mapped: Placement[] = visibleRows.map((r: any) => ({
      ...r, student_label: studentMap.get(r.student_id) ?? 'Trainee record', school_label: partnerMap.get(r.partner_id) ?? 'Host school not set',
    }));
    setPlacements(mapped);
    if (!form.placement_id && mapped.length) setForm(old => ({ ...old, placement_id: mapped[0].id }));
    setStaffId(staffResult.data?.id ?? null);
    // Cache only this authenticated supervisor's assignments for offline forms.
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        for (const d of (req.result ?? []) as Draft[]) {
          if (d.owner_id === userId && d.sync_state === 'synced') store.delete(d.client_record_id);
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }, [supabase, form.placement_id]);

  const syncPending = useCallback(async (userId: string) => {
    if (!navigator.onLine) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || sessionData.session.user.id !== userId) {
      setError('Your online session has expired. Sign in again before syncing saved records.');
      return;
    }
    const all = await allDrafts();
    const mine = all.filter(d => d.owner_id === userId && d.sync_state === 'pending');
    if (!mine.length) return;
    setBusy(true);
    let synced = 0;
    try {
      for (const draft of mine) {
        const row = {
          client_record_id: draft.client_record_id, placement_id: draft.placement_id,
          visit_date: draft.visit_date, visit_type: draft.visit_type, observer_id: draft.observer_id,
          lesson_subject: draft.lesson_subject || null, lesson_topic: draft.lesson_topic || null,
          lesson_plan_notes: draft.lesson_plan_notes || null, lesson_observation: draft.lesson_observation || null,
          trainee_reflection: draft.trainee_reflection || null, score: draft.score === '' ? null : Number(draft.score),
          maximum_score: draft.maximum_score === '' ? null : Number(draft.maximum_score),
          feedback: draft.feedback || null, action_points: draft.action_points || null,
          follow_up_required: draft.follow_up_required, supervisor_verified: draft.supervisor_verified,
          verified_at: draft.supervisor_verified ? draft.verified_at : null,
          supervisor_verified_by: draft.supervisor_verified ? draft.supervisor_verified_by : null,
          gps_latitude: draft.gps_latitude, gps_longitude: draft.gps_longitude, gps_accuracy_m: draft.gps_accuracy_m,
          client_recorded_at: draft.client_recorded_at, created_by: draft.created_by,
        };
        const { error: writeError } = await supabase.from('college_practice_visits')
          .upsert(row, { onConflict: 'client_record_id', ignoreDuplicates: true });
        if (writeError) {
          if (writeError.code === '42501' || /row-level security|permission denied/i.test(writeError.message)) {
            setError('Sync blocked by the college database permissions. The local draft is preserved; ask the Super Administrator to review your role.');
            break;
          }
          setError('A record is still waiting to sync: ' + writeError.message);
          break;
        }
        await putDraft({ ...draft, sync_state: 'synced' });
        synced++;
      }
      await refreshDrafts(userId);
      if (synced) setNotice(synced + ' field record' + (synced === 1 ? '' : 's') + ' synced securely.');
    } finally {
      setBusy(false);
    }
  }, [refreshDrafts, supabase]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    let active = true;
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/login'); return; }
        const { data: p, error: pError } = await supabase.from('college_profiles')
          .select('id,full_name,role,active').eq('id', session.user.id).maybeSingle();
        if (pError && navigator.onLine) throw pError;
        if (p && (!p.active || !ALLOWED_ROLES.includes(p.role))) {
          setError('This module is limited to active Super Administrators, Principals and Teaching Practice Supervisors.');
          setLoading(false); return;
        }
        if (!p && navigator.onLine) {
          setError('Your college profile could not be verified. Sign in online and ask the Super Administrator to check your role.');
          setLoading(false); return;
        }
        const effectiveProfile = p ?? { id: session.user.id, full_name: 'Field supervisor', role: 'practice_supervisor', active: true };
        if (!active) return;
        setProfile(effectiveProfile as Profile);
        await refreshDrafts(session.user.id);
        if (navigator.onLine) {
          await loadAssignments(session.user.id, session.user.email ?? '');
          await syncPending(session.user.id);
        } else {
          const all = await allDrafts();
          const ids = [...new Set(all.filter(d => d.owner_id === session.user.id && d.sync_state === 'pending').map(d => d.placement_id))];
          setPlacements(ids.map(id => ({ id, student_id: '', partner_id: null, supervisor_id: null, starts_on: null, ends_on: null, status: 'active', approval_status: 'approved', student_label: 'Previously assigned placement', school_label: 'Cached placement' })));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to open the Field Companion.');
      } finally { if (active) setLoading(false); }
    }
    void init();
    return () => { active = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [loadAssignments, refreshDrafts, router, supabase, syncPending]);

  useEffect(() => {
    if (online && profile?.id) void syncPending(profile.id);
  }, [online, profile?.id, syncPending]);

  async function requestGps() {
    setGpsState('Requesting location permission…');
    if (!('geolocation' in navigator)) { setGpsState('This device does not support GPS. You can continue without it.'); return; }
    navigator.geolocation.getCurrentPosition(
      position => {
        setGps({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        setGpsState('Location captured · accuracy about ' + Math.round(position.coords.accuracy) + ' m');
      },
      () => setGpsState('Location not shared. You can continue without GPS.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function saveRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setNotice('');
    if (!profile || !form.placement_id) { setError('Select an assigned teaching-practice placement first.'); return; }
    if (!form.lesson_subject.trim() || !form.lesson_topic.trim()) { setError('Enter the lesson subject and topic.'); return; }
    if (form.score !== '' && (Number(form.score) < 0 || Number(form.score) > Number(form.maximum_score || 100))) {
      setError('The score must be between zero and the maximum score.'); return;
    }
    if (form.supervisor_verified && !navigator.onLine) {
      setError('A supervisor visit cannot be verified while offline. Save the lesson record now, then verify the visit online after you have physically visited the school.');
      return;
    }
    const now = new Date().toISOString();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== profile.id) { setError('Please sign in again before saving.'); return; }
    const draft: Draft = {
      client_record_id: crypto.randomUUID(), owner_id: profile.id, placement_id: form.placement_id,
      visit_date: form.visit_date, visit_type: form.visit_type, observer_id: staffId,
      lesson_subject: form.lesson_subject.trim(), lesson_topic: form.lesson_topic.trim(),
      lesson_plan_notes: form.lesson_plan_notes.trim(), lesson_observation: form.lesson_observation.trim(),
      trainee_reflection: form.trainee_reflection.trim(), score: form.score, maximum_score: form.maximum_score,
      feedback: form.feedback.trim(), action_points: form.action_points.trim(), follow_up_required: form.follow_up_required,
      supervisor_verified: form.supervisor_verified, verified_at: form.supervisor_verified ? now : null,
      supervisor_verified_by: form.supervisor_verified ? profile.id : null,
      gps_latitude: gps?.latitude ?? null, gps_longitude: gps?.longitude ?? null, gps_accuracy_m: gps?.accuracy ?? null,
      client_recorded_at: now, created_by: profile.id, sync_state: 'pending', local_updated_at: now,
    };
    try {
      await putDraft(draft);
      await refreshDrafts(profile.id);
      setNotice(navigator.onLine ? 'Saved safely on this device. Syncing to the college database…' : 'Saved on this device. It will sync when you are online again.');
      setForm(old => ({ ...old, lesson_subject: '', lesson_topic: '', lesson_plan_notes: '', lesson_observation: '', trainee_reflection: '', score: '', feedback: '', action_points: '', follow_up_required: false, supervisor_verified: false }));
      setGps(null); setGpsState('GPS not requested');
      if (navigator.onLine) await syncPending(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this field record on the device.');
    }
  }

  const pendingCount = drafts.filter(d => d.sync_state === 'pending').length;
  const visibleDrafts = profile ? drafts.filter(d => d.owner_id === profile.id) : [];
  if (loading) return <main className="login-shell"><section className="login-card"><h1>Opening Field Companion…</h1><p className="muted">Checking your college role and field assignments.</p></section></main>;

  return <main className="shell">
    <section className="workspace-topbar">
      <a className="topbar-brand" href="/"><img className="crest-logo" src="https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png" alt="St. Monicah crest"/><span><strong>ST. MONICA'S</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <ErpNavigation active="academics" />
      <div className="topbar-user"><span>{profile?.full_name ?? 'Field Companion'}<small>{profile?.role.replaceAll('_', ' ')}</small></span><button className="quiet-button" onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>Sign out</button></div>
    </section>
    <section className="content field-companion-content">
      <header><div><p className="eyebrow">TEACHING PRACTICE · FIELDWORK</p><h1>Offline Field Companion</h1><p className="muted">Capture lesson evidence on a phone, tablet or laptop, even when the network drops.</p></div><div className={'field-connectivity ' + (online ? 'is-online' : 'is-offline')}><i />{online ? 'Online' : 'Offline mode'}</div></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {error.startsWith('This module is limited') ? <section className="field-panel"><h2>Access restricted</h2><p className="muted">{error}</p><a className="field-button secondary" href="/">Return to overview</a></section> : <>
        <div className="field-kpis">
          <article><span>Connection</span><strong>{online ? 'Connected' : 'Offline'}</strong><small>{online ? 'Database sync is available' : 'New records stay on this device'}</small></article>
          <article><span>Waiting to sync</span><strong>{pendingCount}</strong><small>Drafts kept in local device storage</small></article>
          <article><span>Assigned placements</span><strong>{placements.length}</strong><small>Assignments visible to your role</small></article>
        </div>
        <div className="field-workspace">
          <section className="field-panel">
            <div className="field-panel-heading"><div><p className="eyebrow">FIELD RECORD</p><h2>Lesson & observation record</h2></div><span className="field-step">01 / 02</span></div>
            <p className="muted">Save lesson details and reflections offline. Supervisor verification is only accepted while online.</p>
            <form className="field-form" onSubmit={saveRecord}>
              <label>Teaching-practice placement
                <select required value={form.placement_id} onChange={e => setForm({ ...form, placement_id: e.target.value })}>
                  <option value="">Choose assigned placement</option>
                  {placements.map(p => <option key={p.id} value={p.id}>{p.student_label} — {p.school_label}</option>)}
                </select>
              </label>
              {form.placement_id && placements.find(p => p.id === form.placement_id) && <div className="field-placement-note"><strong>{placements.find(p => p.id === form.placement_id)?.school_label}</strong><span>{placements.find(p => p.id === form.placement_id)?.starts_on ?? 'Start date not set'} → {placements.find(p => p.id === form.placement_id)?.ends_on ?? 'End date not set'}</span></div>}
              <div className="field-form-grid">
                <label>Visit / lesson date<input type="date" required value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })}/></label>
                <label>Record type<select value={form.visit_type} onChange={e => setForm({ ...form, visit_type: e.target.value })}><option value="observation">Lesson observation</option><option value="follow_up">Follow-up</option><option value="final">Final assessment</option><option value="remote">Remote review</option></select></label>
                <label>Lesson subject<input required maxLength={120} value={form.lesson_subject} onChange={e => setForm({ ...form, lesson_subject: e.target.value })} placeholder="e.g. English"/></label>
                <label>Lesson topic<input required maxLength={180} value={form.lesson_topic} onChange={e => setForm({ ...form, lesson_topic: e.target.value })} placeholder="Topic taught"/></label>
                <label>Score<input type="number" min="0" max="1000" step="0.5" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} placeholder="Optional"/></label>
                <label>Maximum score<input type="number" min="1" max="1000" step="0.5" value={form.maximum_score} onChange={e => setForm({ ...form, maximum_score: e.target.value })}/></label>
              </div>
              <label>Lesson plan notes<textarea rows={3} maxLength={8000} value={form.lesson_plan_notes} onChange={e => setForm({ ...form, lesson_plan_notes: e.target.value })} placeholder="Learning outcomes, lesson stages, resources and activities"/></label>
              <label>Supervisor observation<textarea rows={4} maxLength={8000} value={form.lesson_observation} onChange={e => setForm({ ...form, lesson_observation: e.target.value })} placeholder="Teaching approach, learner engagement, assessment and classroom management"/></label>
              <label>Trainee reflection<textarea rows={3} maxLength={8000} value={form.trainee_reflection} onChange={e => setForm({ ...form, trainee_reflection: e.target.value })} placeholder="What worked, what to improve and next steps"/></label>
              <label>Feedback<textarea rows={2} maxLength={4000} value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} placeholder="Feedback to the trainee"/></label>
              <label>Action points / next visit<textarea rows={2} maxLength={4000} value={form.action_points} onChange={e => setForm({ ...form, action_points: e.target.value })} placeholder="Agreed actions and follow-up"/></label>
              <label className="field-check"><input type="checkbox" checked={form.follow_up_required} onChange={e => setForm({ ...form, follow_up_required: e.target.checked })}/> Follow-up required</label>
              <div className="field-verify-box">
                <div><strong>Supervisor visit verification</strong><p>Only check this when you are physically confirming an actual school visit. Verification records your signed-in account and timestamp. GPS is optional and is not treated as proof by itself.</p></div>
                <label className="field-check"><input type="checkbox" checked={form.supervisor_verified} disabled={!online} onChange={e => setForm({ ...form, supervisor_verified: e.target.checked })}/> I confirm this supervisory visit</label>
                {!online && <small>Connect to the internet to verify a visit. Lesson records can still be saved offline.</small>}
              </div>
              <div className="field-gps-box"><div><strong>Optional GPS evidence</strong><p>{gpsState}</p>{gps && <small>{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)} · ±{Math.round(gps.accuracy)} m</small>}</div><button type="button" className="field-button secondary" onClick={requestGps}>Share location</button></div>
              <p className="field-privacy-note">Location is requested only after you press “Share location”. Denying GPS does not block saving. On shared devices, sign out when finished and avoid leaving unsynced sensitive notes accessible to others.</p>
              <div className="field-actions"><button type="submit" className="field-button primary" disabled={busy}>{busy ? 'Saving / syncing…' : online ? 'Save field record' : 'Save offline'}</button><button type="button" className="field-button secondary" disabled={!online || busy || pendingCount === 0} onClick={() => profile && void syncPending(profile.id)}>Sync pending records</button></div>
            </form>
          </section>
          <section className="field-panel field-queue-panel">
            <div className="field-panel-heading"><div><p className="eyebrow">DEVICE QUEUE</p><h2>Saved field records</h2></div><span className="field-step">{visibleDrafts.length} RECORDS</span></div>
            {visibleDrafts.length === 0 ? <div className="field-empty"><span>✓</span><strong>No saved records yet</strong><p>Records saved in this companion appear here. Pending records are preserved on this device until the database accepts them.</p></div> : <div className="field-record-list">{visibleDrafts.map(d => <article className="field-record" key={d.client_record_id}><div><strong>{d.lesson_subject || 'Lesson record'} · {d.lesson_topic || 'Topic not set'}</strong><p>{d.visit_date} · {placements.find(p => p.id === d.placement_id)?.school_label ?? 'Placement record'}</p><small>{d.supervisor_verified ? 'Supervisor verification recorded' : 'Not supervisor-verified'}{d.gps_latitude !== null ? ' · GPS attached' : ''}</small></div><span className={'field-sync-state ' + (d.sync_state === 'synced' ? 'synced' : 'pending')}>{d.sync_state === 'synced' ? 'Synced' : 'Pending'}</span></article>)}</div>}
            <div className="field-sync-help"><strong>How syncing works</strong><p>Records have a unique client reference so a retry does not create duplicates. The database still applies its existing role permissions. If access is denied, the draft stays on this device until your role is corrected.</p></div>
          </section>
        </div>
      </>}
      <footer>St. Monicah Teachers Training College · Fieldwork evidence · <a href="/workspace?module=college_practice_placements">Teaching practice register</a></footer>
    </section>
  </main>;
}
