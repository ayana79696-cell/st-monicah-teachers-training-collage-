'use client';

type Props = { active?: 'overview'|'students'|'academics'|'attendance'|'finance'|'people'|'admissions'|'communication'|'passports'|'roles'|'reports'|'portal' };
const academics = [
  ['Programmes','college_programmes'],['Academic periods','college_academic_periods'],
  ['Units','college_units'],['Timetables','college_timetable_sessions'],
  ['Attendance','college_attendance'],['Assessments','college_assessments'],
  ['Teaching practice','college_practice_placements'],
] as const;
const more = [
  ['Finance reports & balances','college_payments'],['Bank accounts & M-Pesa','college_bank_accounts'],
  ['Fee heads','college_fee_heads'],['Fee structures','college_fee_structures'],['Fee charges','college_fee_charges'],
  ['Library','college_library_items'],['Accommodation','college_hostel_rooms'],
  ['Procurement','college_procurement_requests'],['Teaching practice partners','college_practice_partners'],
  ['Reports & audit','college_audit_log'],['Staff leave','college_staff_leave_requests'],['Payroll periods','college_payroll_periods'],['Payroll entries','college_payroll_entries'],['Settings & access','college_profiles'],
] as const;

export default function ErpNavigation({ active='overview' }: Props) {
  const financeActive = active === 'finance';
  const academicsActive = active === 'academics';
  const isActive = (key:string) => active === key;
  return <>
    <nav className="workspace-topnav" aria-label="Main navigation">
      <a className={'topnav-link '+(isActive('overview')?'active':'')} href="/">⌂ <span>Home</span></a>
      <a className={'topnav-link '+(isActive('students')?'active':'')} href="/workspace?module=college_students">♙ <span>Students</span></a>
      <details className="topnav-dropdown"><summary className={(academicsActive||active==='attendance')?'nav-current':''}>▤ <span>Academics</span> ⌄</summary><div className="topnav-menu">{academics.map(([label,key])=>key==='college_attendance'?<a key={key} className={active==='attendance'?'active':''} href="/attendance">✓ QR attendance &amp; daily register</a>:<a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details>
      <a className={'topnav-link '+(financeActive?'active':'')} href="/workspace?module=college_payments">▦ <span>Finance</span></a>
      <a className={'topnav-link '+(isActive('people')?'active':'')} href="/workspace?module=college_staff">♧ <span>HR &amp; Staff</span></a>
      <a className={'topnav-link '+(isActive('admissions')?'active':'')} href="/admissions">♙ <span>Admissions</span></a>
      <a className={'topnav-link '+(isActive('communication')?'active':'')} href="/communications">✉ <span>Messages</span></a>
      <details className="topnav-dropdown"><summary className={isActive('passports')?'nav-current':''}>••• <span>More</span> ⌄</summary><div className="topnav-menu"><a className={active==='attendance'?'active':''} href="/attendance">QR Attendance &amp; Daily Register</a><a href="/results">Results &amp; grading</a><a href="/passports">Passport Studio</a><a className={active==='roles'?'active':''} href="/roles">Roles &amp; Access</a><a href="/finance/receipts">Bank payments &amp; receipts</a><a className={active==='reports'?'active':''} href="/reports">Management reports dashboard</a><a href="/inventory">Stock movement register</a><a href="/portal">Student self-service portal</a><a href="/parent-portal">Parent &amp; sponsor portal</a><a href="/parent-links">Parent–student links</a><a href="/learning">E-learning &amp; assignments</a><a href="/operations">Workflow &amp; alerts</a><a href="/quality">Quality &amp; compliance</a><a href="/graduation">Progression &amp; graduation</a><a href="/finance/reconciliation">Payment reconciliation</a><a href="/security">Security &amp; recovery</a><a href="/ai-assistant">AI admin assistant</a><a href="/integrations">Integration Center</a><a href="/payments/mpesa">M-Pesa STK Push</a><a href="/apply" target="_blank">Public application form ↗</a>{more.map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}</div></details>
    </nav>
    <details className="workspace-mobile-menu"><summary><span aria-hidden="true">☰</span> Menu</summary><div className="workspace-mobile-panel">
      <a className={isActive('overview')?'active':''} href="/">Overview</a>
      <a className={isActive('students')?'active':''} href="/workspace?module=college_students">Students</a>
      <p>ACADEMICS</p>{academics.map(([label,key])=>key==='college_attendance'?<a key={key} className={active==='attendance'?'active':''} href="/attendance">QR attendance &amp; daily register</a>:<a key={key} href={'/workspace?module='+key}>{label}</a>)}<a href="/results">Results &amp; grading</a>
      <p>FINANCE</p><a className={financeActive?'active':''} href="/workspace?module=college_payments">Finance dashboard</a><a href="/workspace?module=college_bank_accounts">Bank &amp; M-Pesa</a><a href="/workspace?module=college_fee_structures">Fees &amp; Charges</a><a href="/finance/receipts">Bank payments &amp; receipts</a>
      <p>PEOPLE &amp; SERVICES</p><a href="/workspace?module=college_staff">HR &amp; Staff</a><a href="/admissions">Admissions Desk</a><a href="/communications">Communications</a><a className={active==='reports'?'active':''} href="/reports">Management reports</a><a href="/inventory">Stock movement register</a><a href="/portal">Student self-service portal</a><a href="/parent-portal">Parent &amp; sponsor portal</a><a href="/parent-links">Parent–student links</a><a href="/learning">E-learning &amp; assignments</a><a href="/operations">Workflow &amp; alerts</a><a href="/quality">Quality &amp; compliance</a><a href="/graduation">Progression &amp; graduation</a><a href="/finance/reconciliation">Payment reconciliation</a><a href="/security">Security &amp; recovery</a><a href="/ai-assistant">AI assistant</a><a href="/integrations">Integration Center</a><a href="/payments/mpesa">M-Pesa STK Push</a><a className={active==='attendance'?'active':''} href="/attendance">QR attendance &amp; daily register</a><a href="/passports">Passport Studio</a><a href="/apply" target="_blank">Public application form ↗</a>
      <p>MORE MODULES</p>{more.filter(([,key])=>!['college_payments','college_bank_accounts','college_fee_structures','college_fee_charges','college_fee_heads'].includes(key)).map(([label,key])=><a key={key} href={'/workspace?module='+key}>{label}</a>)}
    </div></details>
  </>;
}
