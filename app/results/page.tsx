'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; full_name: string; role: string; active: boolean };
type Student = { id: string; admission_number: string; first_name: string; middle_name?: string | null; last_name: string; programme_id: string; status: string };
type Unit = { id: string; programme_id: string; unit_code: string; unit_title: string; term_number?: number | null; active: boolean };
type Period = { id: string; academic_year: string; term_name: string; starts_on: string; ends_on: string; status: string };
type Assessment = { id: string; unit_id: string; academic_period_id: string; title: string; assessment_type: string; max_score: number; assessment_date?: string | null; status: string };
type Result = { id: string; assessment_id: string; student_id: string; score: number; lecturer_comment?: string | null; approved_by?: string | null; approved_at?: string | null; created_at: string };
const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const entryRoles = ['super_admin','principal','registrar','hod','lecturer'];
const approvalRoles = ['super_admin','principal','registrar','hod'];
function studentName(s: Student) { return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '); }
function statusLabel(status: string) { return String(status || 'draft').replaceAll('_',' ').replace(/\b\w/g, x => x.toUpperCase()); }

export default function ResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
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
      if (p.role === 'student') { router.replace('/portal'); return; }
      setProfile(p as Profile);
      if (!entryRoles.includes(p.role)) {
        setError('Your role does not have permission to manage academic results.');
        return;
      }
      const [studentResult, unitResult, periodResult, assessmentResult, resultsResult] = await Promise.all([
        db.from('college_students').select('id,admission_number,first_name,middle_name,last_name,programme_id,status').eq('status','active').order('last_name').limit(3000),
        db.from('college_units').select('id,programme_id,unit_code,unit_title,term_number,active').eq('active',true).order('unit_title').limit(1500),
        db.from('college_academic_periods').select('id,academic_year,term_name,starts_on,ends_on,status').order('academic_year',{ascending:false}).limit(200),
        db.from('college_assessments').select('id,unit_id,academic_period_id,title,assessment_type,max_score,assessment_date,status').order('assessment_date',{ascending:false}).limit(1000),
        db.from('college_results').select('id,assessment_id,student_id,score,lecturer_comment,approved_by,approved_at,created_at').order('created_at',{ascending:false}).limit(10000)
      ]);
      for (const result of [studentResult,unitResult,periodResult,assessmentResult,resultsResult]) if (result.error) throw result.error;
      const assessmentRows = (assessmentResult.data || []) as Assessment[];
      setStudents((studentResult.data || []) as Student[]);
      setUnits((unitResult.data || []) as Unit[]);
      setPeriods((periodResult.data || []) as Period[]);
      setAssessments(assessmentRows);
      setResults((resultsResult.data || []) as Result[]);
      setSelectedAssessmentId(current => assessmentRows.some(a => a.id === current) ? current : assessmentRows[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load results. Check your role and database policies.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const assessment = assessments.find(a => a.id === selectedAssessmentId) || null;
  const unit = units.find(u => u.id === assessment?.unit_id) || null;
  const period = periods.find(p => p.id === assessment?.academic_period_id);
  const resultRows = results.filter(r => r.assessment_id === selectedAssessmentId);
  const studentMap = useMemo(() => new Map(students.map(s => [s.id,s])), [students]);
  const eligibleStudents = useMemo(() => {
    if (!unit) return [];
    return students.filter(s => s.programme_id === unit.programme_id);
  }, [students, unit]);
  const visibleResults = resultRows.filter(r => {
    const s = studentMap.get(r.student_id);
    return !search || [s ? studentName(s) : '', s?.admission_number || '', r.lecturer_comment || ''].join(' ').toLowerCase().includes(search.toLowerCase());
  });
  const approvedCount = resultRows.filter(r => r.approved_at).length;
  const pendingCount = resultRows.length - approvedCount;
  const average = resultRows.length ? resultRows.reduce((sum,r) => sum + Number(r.score || 0),0) / resultRows.length : null;

  async function openForMarks() {
    if (!assessment) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await createClient().from('college_assessments')
        .update({ status: 'open' }).eq('id',assessment.id).eq('status','draft');
      if (updateError) throw updateError;
      setNotice('Assessment opened for mark entry. The database will enforce the assessment maximum and programme match.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this assessment.'); }
    finally { setSaving(false); }
  }

  async function saveResult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assessment || !studentId) { setError('Choose an assessment and student first.'); return; }
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore) || score.trim() === '' || numericScore < 0 || numericScore > Number(assessment.max_score)) {
      setError('Enter a score from 0 to ' + assessment.max_score + '.'); return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: saveError } = await createClient().rpc('save_college_assessment_result', {
        p_assessment_id: assessment.id,
        p_student_id: studentId,
        p_score: numericScore,
        p_lecturer_comment: comment.trim() || null
      });
      if (saveError) throw saveError;
      setNotice('Mark saved as pending approval. Saving a correction automatically clears any earlier approval for that mark.');
      setScore(''); setComment(''); setStudentId('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Mark could not be saved. Check the assessment status and student programme.'); }
    finally { setSaving(false); }
  }

  async function submitForApproval() {
    if (!assessment || !resultRows.length) { setError('Enter at least one mark before submitting this assessment.'); return; }
    if (!confirm('Submit ' + resultRows.length + ' mark record(s) for approval? Marks will be locked until an authorized user reopens the assessment.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await createClient().from('college_assessments')
        .update({ status: 'submitted' }).eq('id',assessment.id).eq('status','open');
      if (updateError) throw updateError;
      setNotice('Assessment submitted for approval.'); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Assessment could not be submitted.'); }
    finally { setSaving(false); }
  }

  async function approveResults() {
    if (!assessment) return;
    if (!confirm('Approve all pending marks for "' + assessment.title + '"? Students will be able to see their approved marks in the Student Portal.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const { data, error: approvalError } = await createClient().rpc('approve_college_assessment_results', { p_assessment_id: assessment.id });
      if (approvalError) throw approvalError;
      setNotice(String(data || 0) + ' result record(s) approved. Approved results are now visible in the linked Student Portals.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Approval failed. Check the assessment status and approver role.'); }
    finally { setSaving(false); }
  }

  async function signOut() { await createClient().auth.signOut(); router.replace('/login'); }
  const cardStyle = { background:'#fff', border:'1px solid #ece8eb', borderRadius:14, padding:'18px 20px' };

  return <main className="shell">
    <section className="workspace-topbar no-print"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest"/><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="academics"/><div className="topbar-user"><span>{profile?.full_name || 'College user'}<small>{profile?.role || ''}</small></span><button className="quiet-button" onClick={signOut}>Sign out</button></div></section>
    <section className="content results-content">
      <header className="workspace-record-header no-print"><div><p className="eyebrow">ACADEMICS / MARKS &amp; APPROVAL</p><h1>Results &amp; grading</h1><p className="muted">Enter student marks, submit an assessment and require an authorized academic approver before results are released.</p></div><div className="toolbar"><button className="secondary-button" onClick={() => void load()} disabled={loading || saving}>Refresh</button><button className="secondary-button" onClick={() => window.print()}>Print marks register</button></div></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {loading ? <p className="empty-state">Loading assessment and student records…</p> : profile && entryRoles.includes(profile.role) && <>
        <section className="results-kpis"><article style={cardStyle}><span>Assessments available</span><strong>{assessments.length}</strong><small>Across available course units</small></article><article style={cardStyle}><span>Marks on assessment</span><strong>{resultRows.length}</strong><small>Submitted student records</small></article><article style={cardStyle}><span>Awaiting approval</span><strong>{pendingCount}</strong><small>Marks not yet approved</small></article><article style={cardStyle}><span>Average score</span><strong>{average === null || !assessment ? '—' : average.toFixed(1) + ' / ' + assessment.max_score}</strong><small>Current assessment, before normalization</small></article></section>
        <section className="results-workspace">
          <article className="results-panel">
            <div className="section-head"><div><h2>Assessment workflow</h2><p className="muted">Choose an assessment to enter or review marks.</p></div></div>
            <label>Assessment<select className="search-input results-select" value={selectedAssessmentId} onChange={e => { setSelectedAssessmentId(e.target.value); setStudentId(''); setScore(''); setComment(''); setNotice(''); setError(''); }}><option value="">Choose assessment</option>{assessments.map(a => { const u=units.find(x=>x.id===a.unit_id); return <option key={a.id} value={a.id}>{a.title} · {u ? u.unit_code+' — '+u.unit_title : 'Unit not set'} · {statusLabel(a.status)}</option>; })}</select></label>
            {assessment ? <div className="assessment-meta"><div><small>Course unit</small><strong>{unit ? unit.unit_code+' — '+unit.unit_title : 'Unit not linked'}</strong></div><div><small>Academic period</small><strong>{period ? period.academic_year+' · '+period.term_name : 'Not set'}</strong></div><div><small>Maximum score</small><strong>{assessment.max_score}</strong></div><div><small>Status</small><strong className={'assessment-status assessment-'+assessment.status}>{statusLabel(assessment.status)}</strong></div></div> : <p className="empty-state">No assessments are available. Create one under Academics → Assessments first.</p>}
            {assessment?.status === 'draft' && <div className="results-action-row"><p>Open the assessment when the paper is ready and the maximum score is verified.</p><button className="primary-button" disabled={saving} onClick={() => void openForMarks()}>{saving ? 'Updating…' : 'Open for marks entry'}</button></div>}
            {assessment?.status === 'open' && <form className="record-form results-entry-form" onSubmit={saveResult}>
              <h2>Enter or correct a mark</h2><div className="form-grid">
                <label>Student<select value={studentId} onChange={e => { const value=e.target.value; setStudentId(value); const existing=resultRows.find(r=>r.student_id===value); setScore(existing ? String(existing.score) : ''); setComment(existing?.lecturer_comment || ''); }} required><option value="">Choose a student in this programme</option>{eligibleStudents.map(s=><option key={s.id} value={s.id}>{studentName(s)} · {s.admission_number}</option>)}</select></label>
                <label>Score (0–{assessment.max_score})<input type="number" min="0" max={assessment.max_score} step="0.01" value={score} onChange={e=>setScore(e.target.value)} required/></label>
                <label className="results-comment-field">Lecturer comment (optional)<textarea rows={2} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Feedback for the student"/></label>
              </div><button className="primary-button" disabled={saving || !eligibleStudents.length}>{saving ? 'Saving mark…' : 'Save mark as pending approval'}</button><p className="muted">The database verifies the score range, assessment status, active student and programme match. Corrections clear previous approval.</p>
            </form>}
            {assessment?.status === 'open' && <div className="results-action-row"><p>Review the register and submit it for a separate approval step when ready.</p><button className="secondary-button" disabled={saving || resultRows.length===0} onClick={() => void submitForApproval()}>{saving ? 'Submitting…' : 'Submit for approval'}</button></div>}
            {assessment?.status === 'submitted' && <div className="results-approval-banner"><div><strong>Submitted for approval</strong><p>{resultRows.length} mark records are ready for an authorized approver. Students cannot see unapproved marks.</p></div>{approvalRoles.includes(profile?.role || '') && <button className="primary-button" disabled={saving || pendingCount===0} onClick={() => void approveResults()}>{saving ? 'Approving…' : 'Approve results'}</button>}</div>}
            {assessment?.status === 'approved' && <div className="results-approval-banner results-approved-banner"><div><strong>Assessment approved</strong><p>{approvedCount} approved result records are released to linked Student Portals. To correct marks, an authorized academic user must reopen the assessment before editing.</p></div><span className="assessment-status assessment-approved">Approved</span></div>}
          </article>
          <article className="results-panel"><div className="section-head"><div><h2>Marks register</h2><p className="muted">{resultRows.length} mark record(s) on selected assessment</p></div><input className="search-input no-print" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student or admission no."/></div>
            {visibleResults.length ? <div className="table-wrap"><table className="records-table"><thead><tr><th>Student / admission no.</th><th>Score</th><th>Percentage</th><th>Lecturer comment</th><th>Approval status</th></tr></thead><tbody>{visibleResults.map(r=>{const s=studentMap.get(r.student_id);const pct=assessment&&Number(assessment.max_score)>0?Number(r.score)/Number(assessment.max_score)*100:0;return <tr key={r.id}><td><strong>{s?studentName(s):'Student record'}</strong><small className="muted" style={{display:'block'}}>{s?.admission_number || 'Admission number unavailable'}</small></td><td>{r.score} / {assessment?.max_score ?? '—'}</td><td>{pct.toFixed(1)}%</td><td>{r.lecturer_comment || '—'}</td><td>{r.approved_at ? 'Approved' : 'Pending approval'}</td></tr>;})}</tbody></table></div> : <p className="empty-state">No marks have been entered for this assessment yet.</p>}
          </article>
        </section>
      </>}
      <footer><span>ST. MONICAH · ACADEMIC RECORDS</span><span>Unapproved marks remain private to authorized academic staff.</span></footer>
    </section>
  </main>;
}
