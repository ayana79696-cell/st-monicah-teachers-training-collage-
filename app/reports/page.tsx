'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Row = Record<string, any>;
type Profile = { id: string; full_name: string; role: string; active: boolean };
const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const financialRoles = ['super_admin', 'principal', 'finance'];
const attendanceRoles = ['super_admin', 'principal', 'registrar', 'hod', 'lecturer', 'practice_supervisor'];
const admissionsRoles = ['super_admin', 'principal', 'registrar'];
const staffRoles = ['super_admin', 'principal', 'registrar', 'hod', 'hr'];
const stockRoles = ['super_admin', 'principal', 'finance', 'registrar', 'procurement_officer', 'ict_admin'];
const academicRoles = ['super_admin','principal','registrar','hod','lecturer'];

function money(value: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(value || 0);
}
function monthKey(value: string | Date) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit' }).format(d);
}
function csvEscape(value: unknown) { return '"' + String(value ?? '').replace(/"/g, '""') + '"'; }

export default function ReportsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<Row[]>([]);
  const [programmes, setProgrammes] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [charges, setCharges] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [staff, setStaff] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<Row[]>([]);
  const [resultRows, setResultRows] = useState<Row[]>([]);
  const [assessmentRows, setAssessmentRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [partialNotes, setPartialNotes] = useState<string[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    setLoading(!isRefresh); setRefreshing(isRefresh); setError(''); setPartialNotes([]);
    try {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: p, error: pe } = await db.from('college_profiles')
        .select('id,full_name,role,active').eq('id', session.user.id).maybeSingle();
      if (pe) throw pe;
      if (!p?.active) { router.replace('/login'); return; }
      setProfile(p as Profile);
      if (p.role === 'student') { router.replace('/portal'); return; }

      const notes: string[] = [];
      async function getRows(label: string, query: PromiseLike<any>): Promise<Row[]> {
        try {
          const result = await query;
          if (result.error) { notes.push(label + ': ' + result.error.message); return []; }
          return (result.data || []) as Row[];
        } catch (e) {
          notes.push(label + ': ' + (e instanceof Error ? e.message : 'unavailable'));
          return [];
        }
      }
      const studentQuery = db.from('college_students').select('id,status,intake,intake_year,programme_id,created_at').order('created_at', { ascending: false }).limit(2500);
      const programmeQuery = db.from('college_programmes').select('id,title,code,active').order('title').limit(500);
      const tasks: Promise<any>[] = [
        getRows('Students', studentQuery),
        getRows('Programmes', programmeQuery)
      ];
      const idx: Record<string, number> = { students: 0, programmes: 1 };
      if (financialRoles.includes(p.role)) {
        idx.payments = tasks.length;
        tasks.push(getRows('Payments', db.from('college_payments').select('student_id,amount_kes,paid_at,payment_method').order('paid_at', { ascending: false }).limit(5000)));
        idx.charges = tasks.length;
        tasks.push(getRows('Fee charges', db.from('college_fee_charges').select('student_id,amount_kes,discount_kes,charge_status,due_date').limit(5000)));
      }
      if (attendanceRoles.includes(p.role)) {
        idx.attendance = tasks.length;
        tasks.push(getRows('Attendance', db.from('college_attendance').select('student_id,session_date,status').order('session_date', { ascending: false }).limit(5000)));
      }
      if (admissionsRoles.includes(p.role)) {
        idx.applications = tasks.length;
        tasks.push(getRows('Applications', db.from('college_admissions_applications').select('id,status,created_at').order('created_at', { ascending: false }).limit(2000)));
      }
      if (staffRoles.includes(p.role)) {
        idx.staff = tasks.length;
        tasks.push(getRows('Staff', db.from('college_staff').select('id,employment_status,department').limit(2000)));
      }
      if (['super_admin','principal','registrar','hod','practice_supervisor'].includes(p.role)) {
        idx.placements = tasks.length;
        tasks.push(getRows('Teaching practice', db.from('college_practice_placements').select('id,status,approval_status,starts_on,ends_on').limit(2500)));
      }
      if (stockRoles.includes(p.role)) {
        idx.inventory = tasks.length;
        tasks.push(getRows('Inventory', db.from('college_inventory_items').select('id,item_name,category,quantity_on_hand,reorder_level,active').eq('active', true).order('item_name').limit(2000)));
      }
      if (academicRoles.includes(p.role)) {
        idx.results = tasks.length;
        tasks.push(getRows('Assessment results', db.from('college_results').select('id,assessment_id,score,approved_at,created_at').order('created_at', { ascending: false }).limit(10000)));
        idx.assessments = tasks.length;
        tasks.push(getRows('Assessments', db.from('college_assessments').select('id,title,status,max_score,assessment_type').order('created_at', { ascending: false }).limit(1500)));
      }
      const result = await Promise.all(tasks);
      setStudents(result[idx.students] || []); setProgrammes(result[idx.programmes] || []);
      setPayments(result[idx.payments] || []); setCharges(result[idx.charges] || []);
      setAttendance(result[idx.attendance] || []); setApplications(result[idx.applications] || []);
      setStaff(result[idx.staff] || []); setPlacements(result[idx.placements] || []); setInventory(result[idx.inventory] || []); setResultRows(result[idx.results] || []); setAssessmentRows(result[idx.assessments] || []);
      setPartialNotes(notes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load management reports.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    students.forEach(s => map.set(String(s.status || 'unknown'), (map.get(String(s.status || 'unknown')) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [students]);
  const programmeCounts = useMemo(() => {
    const programmeMap = new Map(programmes.map(p => [p.id, p.title || p.code || 'Programme']));
    const map = new Map<string, number>();
    students.forEach(s => {
      const label = programmeMap.get(s.programme_id) || 'Unassigned';
      map.set(label, (map.get(label) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [students, programmes]);
  const monthlyPayments = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKey(d), label: d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit', timeZone: 'Africa/Nairobi' }), amount: 0 };
    });
    const bucket = new Map(months.map(m => [m.key, m]));
    payments.forEach(p => {
      const key = monthKey(p.paid_at || p.created_at);
      const month = bucket.get(key);
      if (month) month.amount += Number(p.amount_kes || 0);
    });
    return months;
  }, [payments]);
  const dailyAttendance = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (13 - i));
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      return { key, label: d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }), present: 0, absent: 0 };
    });
    const bucket = new Map(days.map(d => [d.key, d]));
    attendance.forEach(a => {
      const d = bucket.get(String(a.session_date || '').slice(0, 10));
      if (!d) return;
      if (a.status === 'present' || a.status === 'late') d.present += 1;
      else if (a.status === 'absent') d.absent += 1;
    });
    return days;
  }, [attendance]);

  const currentMonth = monthKey(new Date());
  const paymentsThisMonth = payments.filter(p => monthKey(p.paid_at || p.created_at) === currentMonth).reduce((n, p) => n + Number(p.amount_kes || 0), 0);
  const postedCharges = charges.filter(c => c.charge_status === 'posted').reduce((n, c) => n + Math.max(0, Number(c.amount_kes || 0) - Number(c.discount_kes || 0)), 0);
  const allPaid = payments.reduce((n, p) => n + Number(p.amount_kes || 0), 0);
  const outstanding = Math.max(0, postedCharges - allPaid);
  const present = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const countedAttendance = attendance.filter(a => ['present', 'late', 'absent', 'excused'].includes(a.status)).length;
  const attendanceRate = countedAttendance ? Math.round((present / countedAttendance) * 100) : 0;
  const waitingApplications = applications.filter(a => ['pending', 'under_review', 'incomplete'].includes(a.status)).length;
  const lowStock = inventory.filter(i => Number(i.quantity_on_hand || 0) <= Number(i.reorder_level || 0));
  const submittedAssessments = assessmentRows.filter(a => a.status === 'submitted').length;
  const resultsAwaitingApproval = resultRows.filter(r => !r.approved_at).length;
  const averageScoreRate = resultRows.length ? Math.round(resultRows.reduce((sum,r) => { const a = assessmentRows.find(x => x.id === r.assessment_id); return sum + (Number(a?.max_score || 0) > 0 ? Number(r.score || 0) / Number(a?.max_score) * 100 : 0); }, 0) / resultRows.length) : null;

  function exportSummary() {
    const lines = [
      ['Report', 'Value'],
      ['Generated (Africa/Nairobi)', new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })],
      ['Student records in loaded report', students.length],
      ['Active students in loaded report', students.filter(s => s.status === 'active').length],
      ['Programmes', programmes.length],
      ['Staff records', staff.length],
      ['Applications awaiting review', waitingApplications],
      ['Attendance rate in loaded register sample', attendanceRate + '%'],
      ['Payments collected this month (KES)', paymentsThisMonth],
      ['All loaded payments (KES)', allPaid],
      ['Posted fee charges less discounts (KES)', postedCharges],
      ['Estimated outstanding balance (KES)', outstanding],
      ['Teaching practice placements', placements.length],
      ['Low-stock inventory items', lowStock.length],
      ['Assessments submitted for approval', submittedAssessments],
      ['Marks awaiting approval', resultsAwaitingApproval],
      ['Average score rate (%)', averageScoreRate === null ? 'Not available' : averageScoreRate]
    ];
    const csv = lines.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'st-monicah-management-summary.csv'; a.click(); URL.revokeObjectURL(url);
  }
  async function signOut() { await createClient().auth.signOut(); router.replace('/login'); }

  const cardStyle = { background: '#fff', border: '1px solid #ece8eb', borderRadius: 14, padding: '18px 20px' };
  const chartStyle = { ...cardStyle, minWidth: 0 as const };
  function BarRows({ rows, moneyValues = false }: { rows: { label: string; value: number }[]; moneyValues?: boolean }) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>{rows.length ? rows.map(r => <div key={r.label}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, marginBottom: 6 }}><span>{r.label}</span><strong>{moneyValues ? money(r.value) : r.value.toLocaleString('en-KE')}</strong></div>
      <div style={{ height: 8, background: '#f3edf0', borderRadius: 50, overflow: 'hidden' }}><div style={{ height: '100%', width: Math.max(2, (r.value / max) * 100) + '%', background: 'linear-gradient(90deg,#641c35,#c6a45b)', borderRadius: 50 }} /></div>
    </div>) : <p className="empty-state">No report data available for this role or period.</p>}</div>;
  }

  return <main className="shell">
    <section className="workspace-topbar no-print"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest" /><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="reports" /><div className="topbar-user"><span>{profile?.full_name || 'College user'}<small>{profile?.role || ''}</small></span><button className="quiet-button" onClick={signOut}>Sign out</button></div></section>
    <section className="content reports-content">
      <header className="workspace-record-header no-print"><div><p className="eyebrow">MANAGEMENT INTELLIGENCE / REPORTING</p><h1>Reports &amp; analytics</h1><p className="muted">A role-aware overview of admissions, students, attendance, finance, staffing, teaching practice and stock.</p></div><div className="toolbar"><button className="secondary-button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh data'}</button><button className="primary-button" onClick={exportSummary}>Download CSV summary</button><button className="secondary-button" onClick={() => window.print()}>Print report</button></div></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      {partialNotes.length > 0 && <div className="reports-note"><strong>Some report sections were unavailable.</strong><p>The report continues with the information your role may access. Ask the Super Administrator to review policies if an expected section is missing.</p></div>}
      {loading ? <p className="empty-state">Loading live college data…</p> : <>
        <section className="reports-kpis">
          <article style={cardStyle}><span>Students in report</span><strong>{students.length.toLocaleString('en-KE')}</strong><small>Records available to your role</small></article>
          <article style={cardStyle}><span>Active students</span><strong>{students.filter(s => s.status === 'active').length.toLocaleString('en-KE')}</strong><small>{students.filter(s => s.status === 'applicant').length} recorded as applicants</small></article>
          <article style={cardStyle}><span>Programmes</span><strong>{programmes.length.toLocaleString('en-KE')}</strong><small>{programmes.filter(p => p.active !== false).length} active</small></article>
          {financialRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Collected this month</span><strong>{money(paymentsThisMonth)}</strong><small>Based on visible payment records</small></article>}
          {financialRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Estimated unpaid balance</span><strong>{money(outstanding)}</strong><small>Posted charges less discounts and all visible payments</small></article>}
          {attendanceRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Attendance rate</span><strong>{countedAttendance ? attendanceRate + '%' : '—'}</strong><small>Based on visible attendance entries</small></article>}
          {admissionsRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Applications to review</span><strong>{waitingApplications}</strong><small>Pending, under review or incomplete</small></article>}
          {staffRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Staff records</span><strong>{staff.length.toLocaleString('en-KE')}</strong><small>{staff.filter(s => s.employment_status === 'active').length} marked active</small></article>}
          {academicRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Assessments awaiting approval</span><strong>{submittedAssessments}</strong><small>{resultsAwaitingApproval} individual marks currently pending approval</small></article>}
          {academicRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Average score rate</span><strong>{averageScoreRate === null ? '—' : averageScoreRate + '%'}</strong><small>Based on marks visible to your role</small></article>}
          {stockRoles.includes(profile?.role || '') && <article style={cardStyle}><span>Low-stock items</span><strong>{lowStock.length}</strong><small>Active items at or below reorder level</small></article>}
        </section>
        <section className="reports-grid">
          <article style={chartStyle}><div className="section-head"><div><h2>Student status</h2><p className="muted">Record distribution</p></div></div><BarRows rows={statusCounts.map(([label, value]) => ({ label: label.replaceAll('_', ' '), value }))} /></article>
          <article style={chartStyle}><div className="section-head"><div><h2>Students by programme</h2><p className="muted">Top programme counts</p></div></div><BarRows rows={programmeCounts.map(([label, value]) => ({ label, value }))} /></article>
          {financialRoles.includes(profile?.role || '') && <article style={chartStyle}><div className="section-head"><div><h2>Payments collected</h2><p className="muted">Last six calendar months</p></div></div><BarRows moneyValues rows={monthlyPayments.map(m => ({ label: m.label, value: Math.round(m.amount) }))} /></article>}
          {attendanceRoles.includes(profile?.role || '') && <article style={chartStyle}><div className="section-head"><div><h2>Attendance activity</h2><p className="muted">Last 14 days; present/late versus absent</p></div></div><div className="reports-daily-chart">{dailyAttendance.map(d => <div key={d.key} title={d.label + ': ' + d.present + ' present/late, ' + d.absent + ' absent'}><div className="reports-daily-bars"><span style={{ height: Math.max(2, Math.min(100, d.present * 8)) + '%' }} /><span style={{ height: Math.max(2, Math.min(100, d.absent * 8)) + '%', background: '#c6a45b' }} /></div><small>{d.label}</small></div>)}</div></article>}
          {academicRoles.includes(profile?.role || '') && <article style={chartStyle}><div className="section-head"><div><h2>Results &amp; approval status</h2><p className="muted">Assessment workflow at a glance</p></div><a href="/results">Open results →</a></div><BarRows rows={['draft','open','submitted','approved'].map(status => ({ label: status.replaceAll('_',' '), value: assessmentRows.filter(a => a.status === status).length }))} /><p className="muted" style={{marginTop:16}}>Marks awaiting approval: <strong>{resultsAwaitingApproval}</strong></p></article>}
          {stockRoles.includes(profile?.role || '') && <article style={chartStyle}><div className="section-head"><div><h2>Reorder watch</h2><p className="muted">Stock at or below minimum</p></div><a href="/inventory">Open inventory →</a></div>{lowStock.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Item</th><th>On hand</th><th>Reorder level</th></tr></thead><tbody>{lowStock.slice(0, 20).map(i => <tr key={i.id}><td>{i.item_name}<small className="muted" style={{ display: 'block' }}>{i.category}</small></td><td><strong>{i.quantity_on_hand}</strong></td><td>{i.reorder_level}</td></tr>)}</tbody></table></div> : <p className="empty-state">No active items at or below reorder level.</p>}</article>}
          {admissionsRoles.includes(profile?.role || '') && <article style={chartStyle}><div className="section-head"><div><h2>Admissions pipeline</h2><p className="muted">Applications by stage</p></div><a href="/admissions">Open admissions →</a></div><BarRows rows={[...new Set(applications.map(a => String(a.status || 'unknown')))].map(s => ({ label: s.replaceAll('_', ' '), value: applications.filter(a => String(a.status || 'unknown') === s).length }))} /></article>}
        </section>
        {partialNotes.length > 0 && <details className="reports-tech-note"><summary>Sections skipped because of data permissions or query errors</summary><ul>{partialNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>}
      </>}
      <footer><span>ST. MONICAH · COLLEGE MANAGEMENT</span><span>Figures reflect records visible to your role and selected data limits.</span></footer>
    </section>
  </main>;
}
