# Academic foundation and connected college ERP rollout

This plan applies to the St. Monicah Teachers Training College ERP only.

## Non-negotiable safeguards
- Preserve existing student, finance, attendance, and academic records.
- Do not fabricate course units, programme names, KNEC requirements, pass marks, or official results.
- Keep internal assessment marks separate from official examination outcomes.
- Treat a certificate as a draft until the result has been verified, clearance is confirmed, and an authorized officer approves issuance.
- Keep student-facing data private and enforce permissions in the database, not only in the UI.
- Never describe an SMS, email, bank import, or M-Pesa payment as completed unless a provider response has confirmed it.

## Phase 1 — Curriculum and registration
- Inventory the existing seven programme records and their exact official names.
- Configure curriculum versions by programme, year of study, academic period, and teaching block/semester where applicable.
- Record unit code, title, credits/contact hours where supplied, required/elective status, and effective dates.
- Register each student against the curriculum version applicable to their intake.
- Detect missing, duplicate, inactive, and unapproved units before opening registration.
- Do not seed guessed units. Obtain and record the college-approved curriculum source before publishing units.

## Phase 2 — Assessments and official results
- Support coursework, tests, practical work, school-based assessments, teaching practice, and official examination outcomes as distinct assessment types.
- Validate marks against assessment maximums and student unit registration.
- Provide bulk entry, missing-mark reports, moderation, submission, approval, and printable result slips.
- Keep drafts and unapproved marks out of the student portal.
- Store official examination body, examination name/session, candidate/index number, reference, verification state, verifier, and verification timestamp.
- Only apply a pass/fail rule when the applicable official rule is documented and approved; otherwise record the official outcome without deriving one.

## Phase 3 — Teaching practice
- Track placement school, mentor, supervisor, placement dates, scheduled visits, lesson observations, rubric scores, student reflections, and final sign-off.
- Flag missed visits, overdue assessments, and missing clearance.
- Restrict sensitive placement notes to authorized academic staff.

## Phase 4 — Clearance and graduation
- Build a student-by-student checklist for required units/results, teaching practice, library, finance, and other college-approved requirements.
- Show which source records support each clearance item and who confirmed it.
- Prevent certificate approval/issuance unless the official result is verified as passed and all required clearance is complete.
- Use unique certificate numbers and retain approval, issue, reprint, and revocation history.
- Make verification codes/QR codes resolve to a minimal verification page without exposing private student data.

## Phase 5 — Student self-service and services
- Provide secure access to registered units, timetable, attendance, approved results, exam status, fee ledger/balance, notices, placement information, registration forms, and receipts.
- Add library catalogue, circulation, overdue alerts, digital resources, and graduation-linked library clearance.
- Add student risk flags for repeated absence, missing assessments, incomplete placement, outstanding fees, and delayed official results; require authorized follow-up and resolution notes.
- Add alumni/employment outcomes and employer feedback with consent and access controls.

## Phase 6 — Finance, records, and operations
- Add duplicate-payment detection, bank/M-Pesa reconciliation, credit notes, discount approval, budget-versus-actual, and end-of-day summaries only with reliable source records and audit history.
- Treat integrations as inactive until credentials, callback validation, idempotency, reconciliation, and failure handling have been tested.
- Add searchable secure archives for admission evidence, result evidence, receipts, certificates, and graduation lists.
- Consider staff workload, development, appraisal, leave, accommodation, welfare, and incident tracking with role-specific permissions.

## Release gates
- Take and verify a restorable backup before database changes.
- Apply schema changes as reviewed migrations; avoid destructive alterations and guessed column/table names.
- Test with synthetic records and accounts for each role.
- Test both allowed and denied reads/writes under row-level security.
- Run production build and inspect the latest deployment rather than relying on an older successful deployment.
- Test print/PDF output and responsive behavior on desktop, tablet, and phone.
- Confirm the latest build, database checks, and acceptance checklist before announcing the feature as live.
