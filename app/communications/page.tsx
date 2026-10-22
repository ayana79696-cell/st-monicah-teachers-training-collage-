'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; full_name: string; role: string; active: boolean };
type Programme = { id: string; title: string; code: string };
type StudentAccount = { id: string; full_name: string };
type MessageRow = {
  id: string; audience: string; subject: string; message_body: string; channel: string;
  status: string; created_at: string; programme_id?: string | null; recipient_profile_id?: string | null; delivered_at?: string | null;
  provider_error?: string | null;
};
const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const managers = ['super_admin', 'principal', 'registrar'];
const fieldStyle = { display: 'block', boxSizing: 'border-box' as const, width: '100%', padding: 11, margin: '7px 0 16px', border: '1px solid #d9cbd0', borderRadius: 8, background: '#fff', font: 'inherit' };

export default function CommunicationsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [audience, setAudience] = useState('all_students');
  const [programmeId, setProgrammeId] = useState('');
  const [recipientProfileId, setRecipientProfileId] = useState('');
  const [channel, setChannel] = useState('in_app');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: p, error: profileError } = await db.from('college_profiles')
        .select('id,full_name,role,active').eq('id', session.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!p?.active) { router.replace('/login'); return; }
      setProfile(p as Profile);
      if (!managers.includes(p.role)) {
        setError('Only the Super Administrator, Principal or Registrar can manage college-wide messages.');
        return;
      }
      const [programmeResult, messageResult] = await Promise.all([
        db.from('college_programmes').select('id,title,code').eq('active', true).order('title').limit(500),
        db.from('college_messages').select('id,audience,subject,message_body,channel,status,created_at,programme_id,recipient_profile_id,delivered_at,provider_error').order('created_at', { ascending: false }).limit(100)
      ]);
      if (programmeResult.error) throw programmeResult.error;
      if (messageResult.error) throw messageResult.error;
      setProgrammes((programmeResult.data || []) as Programme[]);
      setMessages((messageResult.data || []) as MessageRow[]);
      if (p.role === 'super_admin') {
        const { data: accounts, error: accountsError } = await db.from('college_profiles')
          .select('id,full_name').eq('role','student').eq('active',true).order('full_name').limit(3000);
        if (accountsError) throw accountsError;
        setStudentAccounts((accounts || []) as StudentAccount[]);
      } else setStudentAccounts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load communications.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function saveMessage(mode: 'draft' | 'queue' | 'publish') {
    if (!profile || !managers.includes(profile.role)) return;
    if (!subject.trim() || body.trim().length < 5) {
      setError('Add a subject and a message of at least five characters.'); return;
    }
    if (audience === 'programme' && !programmeId) {
      setError('Choose the programme that should receive this announcement.'); return;
    }
    if (audience === 'individual' && (!recipientProfileId || !studentAccounts.some(s=>s.id===recipientProfileId))) {
      setError('Choose an active student login for this individual announcement.'); return;
    }
    if (mode === 'publish' && (channel !== 'in_app' || audience === 'staff')) {
      setError('In-app publishing is only enabled for student audiences. SMS/email and staff delivery still require an approved delivery integration.'); return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const db = createClient();
      const status = mode === 'draft' ? 'draft' : mode === 'publish' ? 'sent' : 'queued';
      const payload = {
        audience, subject: subject.trim(), message_body: body.trim(), channel, status,
        created_by: profile.id,
        programme_id: audience === 'programme' ? programmeId : null,
        recipient_profile_id: audience === 'individual' ? recipientProfileId : null,
        delivered_at: status === 'sent' ? new Date().toISOString() : null,
        provider_error: mode === 'queue' && channel !== 'in_app'
          ? 'Awaiting provider configuration; this queued item has not been delivered.'
          : null
      };
      const { data: savedMessage, error: insertError } = await db.from('college_messages').insert(payload).select('id').single();
      if (insertError) throw insertError;
      if (mode === 'queue' && channel !== 'in_app' && savedMessage?.id) {
        const { data: { session } } = await db.auth.getSession();
        try {
          const response = await fetch('/api/communications/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}) }, body: JSON.stringify({ message_id: savedMessage.id }) });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) {
            const issue = String(result?.error || 'External provider did not accept the message.');
            await db.from('college_messages').update({ provider_error: issue, status: 'queued', delivered_at: null }).eq('id', savedMessage.id);
            setNotice('Saved to the queue, but not sent: ' + issue);
          } else {
            setNotice(String(result.note || ('Provider accepted ' + result.accepted + ' recipient(s). Final delivery still needs a delivery report.')));
          }
        } catch (sendError) {
          const issue = sendError instanceof Error ? sendError.message : 'Could not reach the delivery service.';
          await db.from('college_messages').update({ provider_error: issue, status: 'queued', delivered_at: null }).eq('id', savedMessage.id);
          setNotice('Saved to the queue, but not sent: ' + issue);
        }
      } else {
        setNotice(mode === 'draft'
          ? 'Draft saved to the college database.'
          : mode === 'publish'
            ? 'In-app announcement published. Linked student accounts can view it in the Student Portal.'
            : 'Message queued.');
      }
      setSubject(''); setBody(''); setRecipientProfileId(''); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this message. Check the college role and database permissions.');
    } finally { setSaving(false); }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
  }

  const audienceLabel = (v: string) => ({ all_students: 'All students', programme: 'Students by programme', staff: 'College staff', individual: 'Individual student' }[v] || v);
  const statusLabel = (v: string) => v === 'sent' ? 'Published in app' : v === 'queued' ? 'Queued — not delivered' : v === 'failed' ? 'Failed' : 'Draft';
  const actionLabel = channel === 'in_app' ? 'Publish in-app' : 'Queue for integration';

  return <main className="shell">
    <section className="workspace-topbar no-print">
      <a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest" /><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a>
      <ErpNavigation active="communication" />
      <div className="topbar-user"><span>{profile?.full_name || 'College user'}<small>{profile?.role || ''}</small></span><button className="quiet-button" onClick={signOut}>Sign out</button></div>
    </section>
    <section className="content communications-content">
      <header className="workspace-record-header"><div><p className="eyebrow">COLLEGE OPERATIONS / COMMUNICATION</p><h1>Communications</h1><p className="muted">Create announcements, save drafts and maintain a delivery queue for later integration.</p></div><div className="status"><i />Message centre</div></header>
      <section className="module-hero"><div className="module-hero-copy"><span className="module-hero-eyebrow">ANNOUNCEMENTS • NOTICES • DELIVERY QUEUE</span><h2>Keep the college connected.</h2><p>Announcements are saved as records with an audience, channel, creator and status. External SMS and email are clearly marked as pending until a provider is configured.</p><span className="module-hero-tags">Database-backed drafts • In-app student announcements • Queue history</span></div><div className="module-hero-orb"><span>✉</span></div></section>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {profile && managers.includes(profile.role) && <div className="communications-grid">
        <section className="communications-panel">
          <h2>Compose message</h2>
          <p className="muted">Select a target group and channel, then save or publish.</p>
          <label>Audience<select value={audience} onChange={e => setAudience(e.target.value)} style={fieldStyle}>
            <option value="all_students">All students</option><option value="programme">Students by programme</option>{profile.role==='super_admin'&&<option value="individual">One student (private announcement)</option>}<option value="staff">College staff (queue only)</option>
          </select></label>
          {audience === 'individual' && <label>Student account<select value={recipientProfileId} onChange={e=>setRecipientProfileId(e.target.value)} required style={fieldStyle}><option value="">Choose active student account</option>{studentAccounts.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label>}
          {audience === 'programme' && <label>Programme<select value={programmeId} onChange={e => setProgrammeId(e.target.value)} required style={fieldStyle}><option value="">Choose programme</option>{programmes.map(p => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}</select></label>}
          <label>Channel<select value={channel} onChange={e => setChannel(e.target.value)} style={fieldStyle}><option value="in_app">In-app student portal</option><option value="sms">SMS (provider required)</option><option value="email">Email (provider required)</option></select></label>
          <label>Subject<input maxLength={180} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Announcement subject" style={fieldStyle} required /></label>
          <label>Message<textarea maxLength={10000} value={body} onChange={e => setBody(e.target.value)} placeholder="Write clear information for your selected audience…" rows={6} style={{ ...fieldStyle, resize: 'vertical' }} required /></label>
          <div className="toolbar">
            <button className="secondary-button" disabled={saving} onClick={() => void saveMessage('draft')}>{saving ? 'Saving…' : 'Save draft'}</button>
            {channel === 'in_app' && audience !== 'staff'
              ? <button className="primary-button" disabled={saving} onClick={() => void saveMessage('publish')}>{saving ? 'Saving…' : 'Publish in-app'}</button>
              : <button className="primary-button" disabled={saving} onClick={() => void saveMessage('queue')}>{saving ? 'Saving…' : actionLabel}</button>}
          </div>
          <p className="communications-disclaimer">Publishing in-app makes the announcement available to linked student accounts through the Student Portal. SMS/email records can be queued, but delivery is not claimed until an approved provider is configured and a delivery result is recorded.</p>
        </section>
        <section className="communications-panel">
          <div className="section-head"><div><h2>Message history</h2><p className="muted">Latest 100 records</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
          {loading ? <p className="empty-state">Loading message history…</p> : messages.length === 0 ? <p className="empty-state">No messages have been created yet.</p> :
            <div className="table-wrap"><table className="records-table"><thead><tr><th>Created</th><th>Subject / audience</th><th>Channel</th><th>Status</th></tr></thead><tbody>
              {messages.map(m => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</td><td><strong>{m.subject}</strong><small className="muted" style={{ display: 'block', marginTop: 5 }}>{audienceLabel(m.audience)}{m.programme_id ? ' · ' + (programmes.find(p => p.id === m.programme_id)?.title || 'Programme') : ''}{m.recipient_profile_id ? ' · ' + (studentAccounts.find(s=>s.id===m.recipient_profile_id)?.full_name || 'Student account') : ''}</small><details style={{ marginTop: 5 }}><summary>View message</summary><p style={{ whiteSpace: 'pre-wrap', maxWidth: 360 }}>{m.message_body}</p></details></td><td>{m.channel.toUpperCase()}</td><td><span className={m.status === 'sent' ? 'message-status message-status-live' : 'message-status'}>{statusLabel(m.status)}</span>{m.provider_error && <small style={{ display: 'block', maxWidth: 230, marginTop: 5 }}>{m.provider_error}</small>}</td></tr>)}
            </tbody></table></div>}
        </section>
      </div>}
      <footer><span>ST. MONICAH · COLLEGE MANAGEMENT</span><span>Messages are recorded with an audit trail.</span></footer>
    </section>
  </main>;
}
