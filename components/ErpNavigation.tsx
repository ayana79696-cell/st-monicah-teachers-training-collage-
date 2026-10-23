'use client';

type Props = { active?: 'overview'|'students'|'academics'|'attendance'|'finance'|'people'|'admissions'|'communication'|'passports'|'roles'|'reports'|'portal' };
const academics = [
  ['Programmes','college_programmes'],['Academic periods','college_academic_periods'],
  ['Units','college_units'],['Timetables','college_timetable_sessions'],
  ['Attendance','college_attendance'],['Assessments','college_assessments'],
  ['Teaching practice','college_practice_placements'],
] as const;

export default function ErpNavigation({ active='overview' }: Props) {
  const financeActive = active === 'finance';
  const academicsActive = active === 'academics';
  const isActive = (key:string) => active === key;
  return <>
    <nav className="workspace-topnav" aria-label="Main navigation">
      <a className={'topnav-link '+(isActive('overview')?'active':'')} href="/">⌂ <span>Home</span></a>
      <a className={'topnav-link '+(isActive('students')?'active':'')} href="/workspace?module=college_students">♙ <span>Students</span></a>
      <a className={'topnav-link '+(academicsActive?'active':'')} href="/academics">▤ <span>Academics</span></a>
      <a className={'topnav-link '+(financeActive?'active':'')} href="/workspace?module=college_payments">▦ <span>Finance</span></a>
      <a className={'topnav-link '+(isActive('people')?'active':'')} href="/workspace?module=college_staff">♧ <span>HR &amp; Staff</span></a>
      <a className={'topnav-link '+(isActive('admissions')?'active':'')} href="/admissions">♙ <span>Admissions</span></a>
      <a className="topnav-link" href="/workspace?module=college_procurement_requests">▣ <span>Procurement &amp; Stock</span></a>
      <a className="topnav-link" href="/exam-entry">▤ <span>Exams &amp; Results</span></a>
      <a className="topnav-link" href="/passports">▧ <span>Passport Studio</span></a>
      <a className="topnav-link" href="/timetable">▦ <span>Timetable</span></a>
      <a className="topnav-link" href="/field-companion">⌁ <span>Field Companion</span></a>
      <a className={'topnav-link '+(isActive('communication')?'active':'')} href="/communications">✉ <span>Messages</span></a>
      <a className={'topnav-link '+(isActive('roles')?'active':'')} href="/roles">⚙ <span>Roles</span></a>
      <a className={'topnav-link '+(isActive('reports')?'active':'')} href="/reports">▥ <span>Reports</span></a>
      <a className="topnav-link" href="/graduation">Graduation</a>
      <a className="topnav-link" href="/inventory">Stock Register</a>
      <a className="topnav-link" href="/portal">Student Portal</a>
      <a className="topnav-link" href="/parent-portal">Parent Portal</a>
    </nav>
    <details className="workspace-mobile-menu"><summary><span aria-hidden="true">☰</span> Menu</summary><div className="workspace-mobile-panel">
      <a href="/">Home</a><a href="/workspace?module=college_students">Students</a><a href="/academics">Academics</a><a href="/workspace?module=college_payments">Finance</a><a href="/workspace?module=college_staff">HR &amp; Staff</a><a href="/admissions">Admissions</a><a href="/workspace?module=college_procurement_requests">Procurement &amp; Stock</a><a href="/exam-entry">Exams &amp; Results</a><a href="/passports">Passport Studio</a><a href="/timetable">Timetable</a><a href="/field-companion">Field Companion</a><a href="/communications">Messages</a><a href="/roles">Roles &amp; Access</a><a href="/reports">Reports</a><a href="/graduation">Graduation &amp; Certificates</a><a href="/inventory">Stock Register</a><a href="/portal">Student Portal</a><a href="/parent-portal">Parent / Sponsor Portal</a><a href="/learning">Learning Center</a><a href="/services">Learning, compliance &amp; automation</a><a href="/apply" target="_blank">Public application form ↗</a>
    </div></details>
type Props = { active?: 'overview'|'students'|'academics'|'attendance'|'finance'|'people'|'admissions'|'communication'|'passports'|'roles'|'reports'|'portal' };
const academics = [
  ['Programmes','college_programmes'],['Academic periods','college_academic_periods'],
  ['Units','college_units'],['Timetables','college_timetable_sessions'],
  ['Attendance','college_attendance'],['Assessments','college_assessments'],
  ['Teaching practice','college_practice_placements'],
] as const;

export default function ErpNavigation({ active='overview' }: Props) {
  const financeActive = active === 'finance';
  const academicsActive = active === 'academics';
  const isActive = (key:string) => active === key;
  return <>
    <nav className="workspace-topnav" aria-label="Main navigation">
      <a className={'topnav-link '+(isActive('overview')?'active':'')} href="/">⌂ <span>Home</span></a>
      <a className={'topnav-link '+(isActive('students')?'active':'')} href="/workspace?module=college_students">♙ <span>Students</span></a>
      <a className={'topnav-link '+(academicsActive?'active':'')} href="/academics">▤ <span>Academics</span></a>
      <a className={'topnav-link '+(financeActive?'active':'')} href="/workspace?module=college_payments">▦ <span>Finance</span></a>
      <a className={'topnav-link '+(isActive('people')?'active':'')} href="/workspace?module=college_staff">♧ <span>HR &amp; Staff</span></a>
      <a className={'topnav-link '+(isActive('admissions')?'active':'')} href="/admissions">♙ <span>Admissions</span></a>
      <a className="topnav-link" href="/workspace?module=college_procurement_requests">▣ <span>Procurement &amp; Stock</span></a>
      <a className="topnav-link" href="/exam-entry">▤ <span>Exams &amp; Results</span></a>
      <a className="topnav-link" href="/passports">▧ <span>Passport Studio</span></a>
      <a className="topnav-link" href="/timetable">▦ <span>Timetable</span></a>
      <a className="topnav-link" href="/field-companion">⌁ <span>Field Companion</span></a>
      <a className={'topnav-link '+(isActive('communication')?'active':'')} href="/communications">✉ <span>Messages</span></a>
      <a className={'topnav-link '+(isActive('roles')?'active':'')} href="/roles">⚙ <span>Roles</span></a>
      <a className={'topnav-link '+(isActive('reports')?'active':'')} href="/reports">▥ <span>Reports</span></a>
      <a className="topnav-link" href="/graduation">Graduation</a>
      <a className="topnav-link" href="/inventory">Stock Register</a>
      <a className="topnav-link" href="/portal">Student Portal</a>
      <a className="topnav-link" href="/parent-portal">Parent Portal</a>
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
