'use client';

type Props = { active?: 'overview'|'students'|'academics'|'attendance'|'finance'|'people'|'admissions'|'communication'|'passports'|'roles'|'reports'|'portal' };
const academics = [
  ['Programmes','college_programmes'],['Academic periods','college_academic_periods'],
  ['Units','college_units'],['Timetables','college_timetable_sessions'],
  ['Attendance','college_attendance'],['Assessments','college_assessments'],
  ['Teaching practice','college_practice_placements'],
] as const;
const more = [
  ['Student welfare & support','college_student_welfare_cases'],
  ['Alumni & employment tracking','college_alumni_records'],
  ['Teaching practice partners','college_practice_partners'],
  ['Settings & access','college_profiles'],
] as const;

export default function ErpNavigation({ active='overview' }: Props) {
  const financeActive = active === 'finance';
  const academicsActive = active === 'academics';
  const isActive = (key:string) => active === key;
  return <>
    <nav className="workspace-topnav" aria-label="Main navigation">
      <a className={'topnav-link '+(isActive('overview')?'active':'')} href="/">⌂ <span>Home</span></a>
      <details className="topnav-dropdown"><summary className={isActive('students')||isActive('passports')?'nav-current':''}>♙ <span>Students</span> ⌄</summary><div className="topnav-menu"><a className={isActive('students')?'active':''} href="/workspace?module=college_students">Student records &amp; registration</a><a className={isActive('passports')?'active':''} href="/passports">Passport Studio</a></div></details>
      <details className="topnav-dropdown"><summary className={(academicsActive||active==='attendance')?'nav-current':''}>▤ <span>Academics</span> ⌄</summary><div className="topnav-menu">{academics.map(([label,key])=>key==='college_attendance'?<a key={key} className={active==='attendance'?'active':''} href="/attendance">✓ QR attendance &amp; daily register</a>:key==='college_timetable_sessions'?<a key={key} href="/timetable">{label} · Offline</a>:<a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details>
      <details className="topnav-dropdown"><summary className={financeActive?'nav-current':''}>▦ <span>Finance</span> ⌄</summary><div className="topnav-menu"><a className={financeActive?'active':''} href="/workspace?module=college_payments">Finance dashboard</a><a href="/workspace?module=college_payments">Finance reports &amp; balances</a><a href="/workspace?module=college_bank_accounts">Bank accounts &amp; M-Pesa</a><a href="/workspace?module=college_fee_heads">Fee heads</a><a href="/workspace?module=college_fee_structures">Fee structures</a><a href="/workspace?module=college_fee_charges">Fee charges</a><a href="/finance/receipts">Payments &amp; receipts</a></div></details>
      <details className="topnav-dropdown"><summary className={isActive('people')?'nav-current':''}>♧ <span>HR &amp; Staff</span> ⌄</summary><div className="topnav-menu"><a className={isActive('people')?'active':''} href="/workspace?module=college_staff">Staff records &amp; HR</a><a href="/workspace?module=college_staff_appraisals">Staff appraisals</a></div></details>
      <a className={'topnav-link '+(isActive('admissions')?'active':'')} href="/admissions">♙ <span>Admissions</span></a>
      <a className={'topnav-link '+(isActive('academics')?'active':'')} href="/timetable">▦ <span>Timetable</span></a>
      <a className={'topnav-link '+(isActive('academics')?'active':'')} href="/field-companion">⌁ <span>Field Companion</span></a>
      <a className={'topnav-link '+(isActive('communication')?'active':'')} href="/communications">✉ <span>Messages</span></a>
      <details className="topnav-dropdown"><summary className={isActive('passports')?'nav-current':''}>••• <span>More</span> ⌄</summary><div className="topnav-menu"><a className={active==='attendance'?'active':''} href="/attendance">QR Attendance &amp; Daily Register</a><a href="/results">Results &amp; grading</a><a href="/timetable">Offline timetable</a><a href="/field-companion">Offline Field Companion</a><a href="/workspace?module=college_units">Curriculum &amp; units</a><a href="/workspace?module=college_staff_development">Staff development &amp; training</a><a href="/workspace?module=college_student_welfare_cases">Student welfare &amp; support</a><a href="/exam-entry">Examinations &amp; Result Entry</a><a href="/graduation">Graduation &amp; Certificates</a><a className={active==='roles'?'active':''} href="/roles">Roles &amp; Access</a><a href="/finance/receipts">Bank payments &amp; receipts</a><a className={active==='reports'?'active':''} href="/reports">Management reports dashboard</a><a href="/inventory">Stock movement register</a><a href="/portal">Student self-service portal</a><a href="/parent-portal">Parent / sponsor portal</a><a href="/learning">Learning center</a><a href="/services">Learning, compliance & automation</a><a href="/apply" target="_blank">Public application form ↗</a>{more.map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details>
    </nav>
    <details className="workspace-mobile-menu"><summary><span aria-hidden="true">☰</span> Menu</summary><div className="workspace-mobile-panel">
      <a className={isActive('overview')?'active':''} href="/">Overview</a>
      <p>STUDENTS</p><a className={isActive('students')?'active':''} href="/workspace?module=college_students">Student records &amp; registration</a><a className={isActive('passports')?'active':''} href="/passports">Passport Studio</a>
      <p>ACADEMICS</p>{academics.map(([label,key])=>key==='college_attendance'?<a key={key} className={active==='attendance'?'active':''} href="/attendance">QR attendance &amp; daily register</a>:<a key={key} href={'/workspace?module='+key}>{label}</a>)}<a href="/results">Results &amp; grading</a><a href="/exam-entry">Examinations &amp; Result Entry</a><a href="/graduation">Graduation &amp; Certificates</a>
      <p>FINANCE</p><a className={financeActive?'active':''} href="/workspace?module=college_payments">Finance dashboard &amp; reports</a><a href="/workspace?module=college_bank_accounts">Bank accounts &amp; M-Pesa</a><a href="/workspace?module=college_fee_heads">Fee heads</a><a href="/workspace?module=college_fee_structures">Fee structures</a><a href="/workspace?module=college_fee_charges">Fee charges</a><a href="/finance/receipts">Payments &amp; receipts</a>
      <p>HR &amp; STAFF</p><a href="/workspace?module=college_staff">Staff records &amp; HR</a><a href="/workspace?module=college_staff_leave_requests">Staff leave</a><a href="/workspace?module=college_payroll_periods">Payroll periods</a><a href="/workspace?module=college_payroll_entries">Payroll entries</a><a href="/workspace?module=college_staff_development">Staff development &amp; training</a><a href="/workspace?module=college_staff_appraisals">Staff appraisals</a><p>PEOPLE &amp; SERVICES</p><a href="/admissions">Admissions Desk</a><a href="/communications">Communications</a><a href="/field-companion">Offline Field Companion</a><a className={active==='reports'?'active':''} href="/reports">Management reports</a><a href="/inventory">Stock movement register</a><a href="/portal">Student self-service portal</a><a href="/parent-portal">Parent / sponsor portal</a><a className={active==='attendance'?'active':''} href="/attendance">QR attendance &amp; daily register</a><a href="/apply" target="_blank">Public application form ↗</a>
      <p>MORE MODULES</p>{more.filter(([,key])=>!['college_payments','college_bank_accounts','college_fee_structures','college_fee_charges','college_fee_heads'].includes(key)).map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}
    </div></details>
  </>;
}
