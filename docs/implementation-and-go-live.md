# Implementation and go-live checklist

## Current implementation snapshot

Verified in source/database during the October 22, 2026 implementation review:
- All 60 public application tables have row-level security enabled; the audit found no public table with RLS disabled or RLS enabled without policies.
- Audit triggers, inventory movement enforcement, leave/payroll schema, student account linkage, marks entry/approval RPCs and scoped lecturer/HOD access were added to the connected Supabase project.
- Reports, inventory, communications and private student portal have dedicated routes.
- GitHub Actions runs the Next.js production build. Check the latest run after every commit; an older READY deployment does not prove the latest commit is live.

## Staff and student access setup
1. Assign the least-privilege role. Do not grant Super Administrator rights for routine work.
2. For student role, link exactly one college_students record. The portal intentionally shows no student information until this link exists.
3. For lecturer role, link the correct college_staff record in Roles & Access and assign the lecturer to their course units.
4. For HOD role, fill in the department on the profile and ensure each programme uses the matching department label. Comparisons are case-insensitive after trimming whitespace.
5. Test access with separate test accounts before sharing accounts with real staff or students.

## Academic results approval flow
1. Create an assessment under the correct course unit and academic period. Set a positive maximum mark.
2. Open the assessment for mark entry.
3. Save each student's mark through Results & Grading. The database checks maximum score, active student, programme match, lecturer assignment and HOD department; corrections reset previous approval.
4. Submit the assessment.
5. An authorized Principal, Registrar, Super Administrator or appropriately scoped HOD approves results.
6. Verify the student sees only approved marks in the Student Portal.
7. Verify direct writes to college_results and attempts to bypass the approval status are rejected.

## Inventory
- Create an item with a unit of measure, reorder level and cost.
- Record the opening quantity as a stock-in movement. Never edit the on-hand quantity directly.
- Record receipts/issues/adjustments with a reference such as LPO, delivery note or issue slip.
- Confirm a stock issue larger than available quantity is rejected without altering the balance.
- Treat movement records as append-only; correct past errors using a documented adjustment.

## Communications
- In-app announcements are saved and available to linked student accounts according to audience.
- SMS/email can be drafted or queued, but is not delivered until a provider, approved sender and delivery result are configured. A queue row must not be treated as proof of delivery.
- Before enabling a provider, test delivery failures, duplicate prevention, contact accuracy, consent and audit history.

## Finance and payroll limitations
- Outstanding-fee reports are estimates based on visible posted charges and visible payments; reconcile against official finance statements before treating them as final ledger totals.
- Do not enable live M-Pesa/bank callbacks until merchant credentials, callback validation, idempotency, reconciliation and refunds are tested.
- Payroll entries track base pay, allowances, overtime, deductions and net total. They are not yet a certified payroll-calculation engine: statutory PAYE, NSSF, SHIF, housing levy, payslip delivery, approval and bank integration need Kenya-specific review before live use.

## Security, privacy and operations
- Keep SUPABASE_SERVICE_ROLE_KEY server-only and encrypted. Never expose it in client code, a NEXT_PUBLIC variable or Git.
- Re-test Supabase row-level security any time a role/table is added. Test permitted and forbidden reads/writes with different authenticated users; UI hiding alone is not a security boundary.
- Enable MFA for privileged accounts in Supabase Auth and verify recovery methods. MFA enforcement was not verified as required during this implementation pass.
- Confirm Supabase backup/PITR entitlements, configure periodic exports to a separate protected location and perform a test restore into a non-production project. A backup is not proven usable until it has been restored.
- Add a staging deployment/project before risky schema or finance changes. Keep test data synthetic and document rollback steps.
- Adopt the Kenya Data Protection Act/ODPC guidance for collection, retention, access/export requests and handling of student photos, identity/KCSE details, contacts, attendance and results. Obtain institutional/legal review for the privacy notice and retention schedule.
- Test printouts on A4 and any thermal printer the college uses. Test responsive layouts on phone/tablet/desktop and do keyboard-only checks before claiming full WCAG conformance.

## Manual acceptance checklist
- [ ] Super Administrator can log in; wrong password is rejected.
- [ ] Existing staff roles can log in with their own emails; public registration remains disabled.
- [ ] Password recovery email redirects to /update-password and the new password works.
- [ ] Inactive accounts cannot access privileged records.
- [ ] Student A cannot read Student B's profile, payments, charges, attendance, results or private announcements.
- [ ] Lecturer can see assigned units/students only; an unrelated lecturer cannot.
- [ ] HOD access is limited to the department assigned to the profile.
- [ ] Marks above the maximum, marks for an unregistered programme and direct result-row edits are rejected.
- [ ] Unapproved marks are hidden from students; approved marks show assessment title and score.
- [ ] Excess stock issue is rejected without corrupting quantity-on-hand.
- [ ] Communications says queued—not delivered—when SMS/email is not configured.
- [ ] Fee and attendance reports reconcile against source records; CSV exports open correctly.
- [ ] Audit log identifies actor, time, table and changed field names without duplicating sensitive values.
- [ ] Restore a recent database backup into a test project and verify students, fees, attendance and academic records.
- [ ] Latest GitHub Actions build succeeds and latest Vercel production deployment is READY before announcing release.
