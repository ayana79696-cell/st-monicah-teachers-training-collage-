# St. Monicah Teachers Training College ERP

A role-based college management ERP for St. Monicah Teachers Training College, built independently with Next.js, Supabase and Vercel.

## Current system areas

- **Admissions & student records:** online application workflow, applicant review, registration records and passport/ID studio.
- **Academic administration:** programmes, academic periods, course units, timetables, assessments, marks entry and approval.
- **Teaching practice:** placements, partner schools and supervision records.
- **Attendance:** QR-based daily register and printable reports.
- **Finance:** fee structures and charges, payments, bank accounts, statements and receipts.
- **People & operations:** staff records, role/access management, staff leave requests, payroll-period/entry records, staff appraisals and professional-development tracking.
- **Student affairs & graduate outcomes:** restricted welfare/support cases with assigned follow-ups, plus alumni records and graduate employment outcomes with explicit contact-consent tracking.
- **Campus services:** library, hostel/accommodation, procurement and inventory stock ledger.
- **Communications:** saved drafts, in-app student announcements and explicit queued status for SMS/email awaiting provider configuration.
- **Reports & audit:** role-aware management dashboards/CSV summary and database-level audit logging on important records.
- **Student portal:** private, linked-record view of registration, fee records, attendance, approved marks and published in-app announcements.

## Technology
- Next.js App Router / TypeScript
- Supabase Auth and PostgreSQL with row-level security
- Vercel deployments from main
- GitHub Actions production build on pushes and pull requests

## First login and access management

There is no public sign-up. The existing Super Administrator signs in using the configured college account. Staff/student accounts must be provisioned by an authorized college administrator and assigned a role in Roles & Access. Student accounts must be linked to the correct student record. Lecturer accounts must be linked to their staff record, and HOD accounts need a department matching the programme department. Those links drive row-level permissions.

Password recovery uses Supabase Auth email links. Ensure the production site and /update-password URL are configured in Supabase Auth → URL Configuration (Site URL and Redirect URLs), and configure email delivery before relying on recovery links.

## Database migrations

SQL migration sources live in supabase/migrations/. Recent operational migrations provide audit triggers; stock movement ledger, staff leave/payroll tables, student-account mapping and message targeting; validated assessment marks entry with separate approval; lecturer/HOD-scoped academic RLS; and database-enforced result approval permissions.

Apply future migrations to the intended Supabase project in a controlled window. Take a backup first and verify each migration version after it runs.

## Required environment variables

Frontend (already configured in the connected Vercel project):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)

Needed only for server-side account invitations:
- SUPABASE_SERVICE_ROLE_KEY — store as an encrypted/sensitive Vercel environment variable. Never prefix it with NEXT_PUBLIC_, commit it to GitHub or expose it in browser code.

External services have separate secrets; never reuse the Supabase service role key for messaging or mobile-money providers.

## External integrations not yet live

The communications UI does not claim to send SMS/email until a provider is configured and a delivery response is recorded. Payment collection remains the existing ledger until the institution configures and tests an approved bank/M-Pesa integration. Payroll is a preparation/recording workflow; it does not calculate legal statutory deductions or transmit payroll to a bank. No provider/payment credentials are stored in this repository.

See docs/implementation-and-go-live.md before inviting real users or relying on live finance/academic reports.
