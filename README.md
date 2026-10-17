# Saint Monica's Teachers Training College ERP

A separate ERP for Saint Monica's Teachers Training College, built independently of AIC Cathedral and Gilgil Hills systems.

## Stack
- Next.js App Router
- TypeScript
- Supabase (database and authentication)
- Vercel (deployment)

## College workflows planned
Admissions and student records; programmes and course registration; academic periods and timetables; attendance; assessments and results; teaching practice placements and partner schools; fees, invoices and payments; staff and HR; library; accommodation; procurement and inventory; communications; reports; audit logs and role-based access.

## Security principles
- Never commit environment files, service-role keys, passwords, or private credentials.
- Use Supabase Auth for sign-in and database row-level security for access control.
- Keep finance, student records, and audit data restricted by role.
- Demo data must be clearly labelled and must never be mistaken for real college records.

## Status
Initial repository setup. Supabase project and schema foundation exist; authentication, role-specific policies, live data workflows, and end-to-end verification remain in progress.
