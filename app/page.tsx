const modules = [
  ['Admissions', 'Applications, admission decisions and enrolment'],
  ['Students & Programmes', 'Student profiles, DSTE and approved programmes'],
  ['Courses & Timetables', 'Course registration, units and class schedules'],
  ['Attendance', 'Student and staff attendance records'],
  ['Examinations & Results', 'Assessments, marks and academic reports'],
  ['Teaching Practice', 'Partner schools, placements and supervision'],
  ['Finance', 'Fee structures, invoices, payments and balances'],
  ['Human Resources', 'Staff records, contracts and administration'],
  ['Library', 'Catalogue, lending and returns'],
  ['Accommodation', 'Hostel rooms and student allocations'],
  ['Procurement & Stock', 'Requests, suppliers and inventory'],
  ['Communications', 'College announcements and messages'],
  ['Reports & Audit', 'Operational reports and accountable activity'],
  ['Settings & Access', 'Academic years, profiles and permissions'],
];

export default function Home() {
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="crest">SM</div><div><strong>SAINT MONICA'S</strong><span>TEACHERS TRAINING COLLEGE</span></div></div>
      <p className="nav-label">COLLEGE WORKSPACE</p>
      <a className="nav active" href="#overview">▦ &nbsp; Overview</a>
      {modules.map(([name]) => <a className="nav" href="#modules" key={name}>{name}</a>)}
      <div className="sidebar-foot">College ERP <span>Foundation build</span></div>
    </aside>
    <section className="content" id="overview">
      <header><div><p className="eyebrow">SAINT MONICA'S · COLLEGE MANAGEMENT</p><h1>College overview</h1><p className="muted">A single workspace for academic and administrative operations.</p></div><div className="status"><i /> Setup in progress</div></header>
      <section className="welcome"><div><p className="eyebrow light">WELCOME TO YOUR WORKSPACE</p><h2>Learning. Teaching. Growing.</h2><p>Manage programmes, students, teaching practice and college services from one place.</p></div><div className="seal">SM<span>STTC</span></div></section>
      <div className="section-head"><div><h2>College modules</h2><p className="muted">Module structure for the college ERP</p></div><span className="count">{modules.length} MODULES</span></div>
      <div className="module-grid" id="modules">{modules.map(([name,desc],i)=><article className="module" key={name}><div className="module-top"><span className="module-icon">{['AD','ST','AC','AT','EX','TP','FN','HR','LB','AC','PR','CM','RP','SA'][i]}</span><span className="arrow">↗</span></div><h3>{name}</h3><p>{desc}</p><span className="module-state">Integration pending</span></article>)}</div>
      <footer>Saint Monica's Teachers Training College <span>Secure live-data integration is the next stage.</span></footer>
    </section>
  </main>;
}
