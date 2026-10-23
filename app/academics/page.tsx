'use client';

import ErpNavigation from '@/components/ErpNavigation';

const sections = [
  { label: 'Programmes', href: '/workspace?module=college_programmes' },
  { label: 'Academic periods', href: '/workspace?module=college_academic_periods' },
  { label: 'Units', href: '/workspace?module=college_units' },
  { label: 'Timetables', href: '/timetable' },
  { label: 'QR Attendance', href: '/attendance' },
  { label: 'Assessments', href: '/workspace?module=college_assessments' },
  { label: 'Teaching Practice', href: '/workspace?module=college_practice_placements' },
];

export default function AcademicsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#f7f5f6', color: '#251b20' }}>
      <ErpNavigation active="academics" />
      <section style={{ maxWidth: 1240, margin: '0 auto', padding: '30px 22px' }}>
        <p style={{ margin: 0, color: '#7a5262', fontSize: 12, fontWeight: 700, letterSpacing: 2 }}>ACADEMIC MANAGEMENT</p>
        <h1 style={{ margin: '8px 0', fontSize: 30 }}>Academics</h1>
        <p style={{ margin: '0 0 24px', color: '#675d62' }}>Choose a section below. Each opens its own dedicated page.</p>
        <nav aria-label="Academic sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid #e1d7dc', paddingBottom: 14, marginBottom: 24 }}>
          {sections.map((section, index) => (
            <a key={section.label} href={section.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 42, padding: '0 16px', borderRadius: 8, background: index === 0 ? '#54162b' : '#fff', color: index === 0 ? '#fff' : '#54162b', border: '1px solid #e4d8de', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
              {section.label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {sections.map((section) => (
            <a key={section.label} href={section.href} style={{ display: 'block', padding: 20, background: '#fff', border: '1px solid #e8dfe3', borderRadius: 12, textDecoration: 'none', color: '#54162b', boxShadow: '0 2px 8px rgba(40,20,30,.04)' }}>
              <strong style={{ display: 'block', fontSize: 16, marginBottom: 8 }}>{section.label}</strong>
              <span style={{ color: '#756870', fontSize: 13 }}>Open {section.label.toLowerCase()} →</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
