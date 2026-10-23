'use client';

import ErpNavigation from '@/components/ErpNavigation';

export default function AcademicsPage() {
  return (
    <main className="academics-hub-page">
      <ErpNavigation active="academics" />
      <section className="academics-hub-content">
        <p className="eyebrow">ACADEMIC MANAGEMENT</p>
        <h1>Academics</h1>
        <p className="muted">Manage programmes, academic periods, units, timetables, attendance and assessments from the subpage menu above.</p>
        <div className="academics-hub-panel">
          <span className="academics-hub-mark" aria-hidden="true">AC</span>
          <div>
            <h2>Your academic workspace</h2>
            <p>Choose a subpage in the horizontal row directly below the main menu. The menu stays visible as you move between the college’s academic tools.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
