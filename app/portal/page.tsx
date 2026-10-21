'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; full_name: string; role: string; active: boolean; student_id?: string | null };
type Row = Record<string, any>;
const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
function money(n: number) { return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n || 0); }

export default function StudentPortalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [student, setStudent] = useState<Row | null>(null);
  const [programmeTitle, setProgrammeTitle] = useState('');
  const [payments, setPayments] = useState<Row[]>([]);
  const [charges, setCharges] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [messages, setMessages] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: p, error: pError } = await db.from('college_profiles')
        .select('id,full_name,role,active,student_id').eq('id', session.user.id).maybeSingle();
      if (pError) throw pError;
      if (!p?.active) { router.replace('/login'); return; }
      if (p.role !== 'student') { router.replace('/'); return; }
      setProfile(p as Profile);
      if (!p.student_id) return;
      const { data: studentRow, error: studentError } = await db.from('college_students')
        .select('id,admission_number,first_name,middle_name,last_name,programme_id,study_mode,intake,intake_year,status')
        .eq('id', p.student_id).maybeSingle();
      if (studentError) throw studentError;
      if (!studentRow) { setError('Your account is linked to a student record that is no longer available. Contact the Registrar.'); return; }
      setStudent(studentRow);
      const [programmeResult, paymentResult, chargeResult, attendanceResult, resultResult, messageResult] = await Promise.all([
        db.from('college_programmes').select('id,title,code').eq('id', studentRow.programme_id).maybeSingle(),
        db.from('college_payments').select('amount_kes,payment_method,reference_number,bank_name,paid_at,created_at').eq('student_id', p.student_id).order('paid_at', {ascending:false}).limit(100),
        db.from('college_fee_charges').select('description,amount_kes,discount_kes,due_date,charge_status,created_at').eq('student_id', p.student_id).order('created_at', {ascending:false}).limit(100),
        db.from('college_attendance').select('session_date,status,unit_id').eq('student_id', p.student_id).order('session_date', {ascending:false}).limit(150),
        db.from('college_results').select('assessment_id,score,lecturer_comment,approved_at,created_at').eq('student_id', p.student_id).order('created_at', {ascending:false}).limit(100),
        db.from('college_messages').select('id,subject,message_body,channel,created_at').eq('status','sent').eq('channel','in_app').order('created_at', {ascending:false}).limit(100)
      ]);
      if (programmeResult.data) setProgrammeTitle([programmeResult.data.code, programmeResult.data.title].filter(Boolean).join(' — '));
      setPayments(paymentResult.error ? [] : (paymentResult.data || []) as Row[]);
      setCharges(chargeResult.error ? [] : (chargeResult.data || []) as Row[]);
      setAttendance(attendanceResult.error ? [] : (attendanceResult.data || []) as Row[]);
      setResults(resultResult.error ? [] : (resultResult.data || []) as Row[]);
      setMessages(messageResult.error ? [] : (messageResult.data || []) as Row[]);
      const skipped = [paymentResult, chargeResult, attendanceResult, resultResult, messageResult].filter(x => x.error);
      if (skipped.length) setError('Some portal sections are temporarily unavailable due to database access policies. Your other visible records are shown; contact the college administrator if this persists.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open your student portal.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  async function signOut() { await createClient().auth.signOut(); router.replace('/login'); }

  const postedCharges = charges.filter(c => c.charge_status === 'posted').reduce((n,c) => n + Math.max(0,Number(c.amount_kes || 0) - Number(c.discount_kes || 0)),0);
  const totalPaid = payments.reduce((n,p) => n + Number(p.amount_kes || 0),0);
  const balance = Math.max(0, postedCharges - totalPaid);
  const countedAttendance = attendance.filter(a => ['present','late','absent','excused'].includes(a.status));
  const attendanceRate = countedAttendance.length ? Math.round((countedAttendance.filter(a => ['present','late'].includes(a.status)).length / countedAttendance.length) * 100) : null;

  const card = { background:'#fff', border:'1px solid #ece8eb', borderRadius:14, padding:'18px 20px' };
  return <main className="student-portal-shell">
    <header className="student-portal-header no-print"><a href="/portal" className="student-portal-brand"><img src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>STUDENT PORTAL</small></span></a><div className="student-portal-user"><span>{profile?.full_name || 'Student'}<small>{student?.admission_number || 'Student self-service'}</small></span><button className="secondary-button" onClick={signOut}>Sign out</button></div></header>
    <section className="student-portal-main">
      <div className="student-portal-welcome"><div><p className="eyebrow">YOUR COLLEGE ACCOUNT</p><h1>Welcome{student?.first_name ? ', ' + student.first_name : ''}</h1><p>View your registration information, fee records, attendance, approved results and college announcements.</p></div><div className="student-portal-seal">SM<span>COLLEGE</span></div></div>
      {error && <p className="error-message" role="status">{error}</p>}
      {loading ? <p className="empty-state">Loading your records securely…</p> : profile && !profile.student_id ? <section className="student-portal-panel"><h2>Student record not linked yet</h2><p>Your login is active, but it has not been linked to your student record. Please contact the college Registrar or Super Administrator and ask them to link your account from Roles &amp; Access. No other student's information is shown.</p></section> : student && <>
        <section className="student-portal-kpis"><article style={card}><span>Fee balance (estimate)</span><strong>{money(balance)}</strong><small>Based on visible posted charges and payment records</small></article><article style={card}><span>Total recorded payments</span><strong>{money(totalPaid)}</strong><small>{payments.length} payment record(s) shown</small></article><article style={card}><span>Attendance rate</span><strong>{attendanceRate === null ? '—' : attendanceRate + '%'}</strong><small>{countedAttendance.length} attendance records shown</small></article><article style={card}><span>Approved results</span><strong>{results.filter(r => r.approved_at).length}</strong><small>Approved assessment results visible</small></article></section>
        <section className="student-portal-grid">
          <article className="student-portal-panel"><div className="section-head"><div><h2>My student details</h2><p className="muted">Registration information</p></div></div><dl className="student-details"><dt>Admission number</dt><dd>{student.admission_number || '—'}</dd><dt>Programme</dt><dd>{programmeTitle || 'Pending programme record'}</dd><dt>Study mode</dt><dd>{String(student.study_mode || '—').replaceAll('_',' ')}</dd><dt>Intake</dt><dd>{[student.intake, student.intake_year].filter(Boolean).join(' ') || '—'}</dd><dt>Student status</dt><dd>{student.status || '—'}</dd></dl></article>
          <article className="student-portal-panel"><div className="section-head"><div><h2>Fee charges</h2><p className="muted">Posted items that contribute to the balance</p></div></div>{charges.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Charge</th><th>Status</th><th>Amount</th><th>Due date</th></tr></thead><tbody>{charges.map((c,i)=><tr key={i}><td>{c.description || 'College charge'}</td><td>{String(c.charge_status || '—').replaceAll('_',' ')}</td><td>{money(Math.max(0,Number(c.amount_kes || 0)-Number(c.discount_kes || 0)))}</td><td>{c.due_date || '—'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No visible fee charges.</p>}</article>
          <article className="student-portal-panel"><div className="section-head"><div><h2>Payment history</h2><p className="muted">Latest transactions</p></div></div>{payments.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{payments.map((p,i)=><tr key={i}><td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-KE',{timeZone:'Africa/Nairobi'}) : '—'}</td><td>{String(p.payment_method || '—').replaceAll('_',' ')}</td><td>{p.reference_number || '—'}</td><td>{money(Number(p.amount_kes || 0))}</td></tr>)}</tbody></table></div> : <p className="empty-state">No visible payments.</p>}</article>
          <article className="student-portal-panel"><div className="section-head"><div><h2>Attendance</h2><p className="muted">Most recent attendance entries</p></div></div>{attendance.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Date</th><th>Status</th><th>Record type</th></tr></thead><tbody>{attendance.slice(0,50).map((a,i)=><tr key={i}><td>{a.session_date || '—'}</td><td>{a.status || '—'}</td><td>{a.unit_id ? 'Unit session' : 'Daily register'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No visible attendance records.</p>}</article>
          <article className="student-portal-panel"><div className="section-head"><div><h2>Assessment results</h2><p className="muted">Results are identified as approved when a lecturer/approver has approved them.</p></div></div>{results.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Assessment reference</th><th>Score</th><th>Status</th><th>Comment</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><td>{String(r.assessment_id || '').slice(0,8) || 'Assessment'}</td><td>{r.score ?? '—'}</td><td>{r.approved_at ? 'Approved' : 'Pending approval'}</td><td>{r.lecturer_comment || '—'}</td></tr>)}</tbody></table></div> : <p className="empty-state">No visible results yet.</p>}</article>
          <article className="student-portal-panel"><div className="section-head"><div><h2>College announcements</h2><p className="muted">Published in-app notices</p></div></div>{messages.length ? messages.map(m=><div className="portal-message" key={m.id}><small>{new Date(m.created_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</small><h3>{m.subject}</h3><p>{m.message_body}</p></div>) : <p className="empty-state">No announcements are available for your account at this time.</p>}</article>
        </section>
      </>}
      <footer><span>ST. MONICAH TEACHERS TRAINING COLLEGE</span><span>Access is limited to your linked student record.</span></footer>
    </section>
  </main>;
}
