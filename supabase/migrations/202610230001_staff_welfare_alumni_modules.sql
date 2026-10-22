-- St. Monicah ERP: staff development, student welfare and alumni tracking.
-- Safe additive migration: preserves all existing records and does not seed fictional people.
create table if not exists public.college_staff_development (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.college_staff(id) on delete restrict,
  activity_title text not null,
  activity_type text not null default 'professional_development',
  provider text,
  start_date date,
  end_date date,
  hours numeric(7,2),
  completion_status text not null default 'planned'
    check (completion_status in ('planned','in_progress','completed','cancelled')),
  evidence_reference text,
  reflection text,
  follow_up_action text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists college_staff_development_staff_idx
  on public.college_staff_development(staff_id, start_date desc);

create table if not exists public.college_staff_appraisals (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.college_staff(id) on delete restrict,
  review_period text not null,
  reviewer_id uuid references public.college_staff(id) on delete set null,
  review_date date,
  teaching_quality_score numeric(5,2),
  professional_conduct_score numeric(5,2),
  goals_and_delivery_score numeric(5,2),
  strengths text,
  improvement_areas text,
  agreed_goals text,
  support_plan text,
  status text not null default 'draft'
    check (status in ('draft','submitted','reviewed','acknowledged','closed')),
  staff_acknowledged_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, review_period)
);
create index if not exists college_staff_appraisals_staff_idx
  on public.college_staff_appraisals(staff_id, review_date desc);

create table if not exists public.college_student_welfare_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.college_students(id) on delete restrict,
  case_reference text unique,
  category text not null default 'general_support',
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  status text not null default 'open'
    check (status in ('open','in_progress','referred','resolved','closed')),
  reported_on date not null default current_date,
  assigned_to uuid references public.college_staff(id) on delete set null,
  summary text not null,
  action_taken text,
  referral_details text,
  follow_up_date date,
  resolved_on date,
  restricted_notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resolved_on is null or resolved_on >= reported_on)
);
create index if not exists college_student_welfare_student_idx
  on public.college_student_welfare_cases(student_id, reported_on desc);
create index if not exists college_student_welfare_followup_idx
  on public.college_student_welfare_cases(follow_up_date)
  where status in ('open','in_progress','referred');

create table if not exists public.college_alumni_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.college_students(id) on delete set null,
  graduate_name text not null,
  admission_number_snapshot text,
  programme_name_snapshot text,
  completion_year integer,
  graduation_year integer,
  personal_email text,
  phone text,
  county text,
  employment_status text not null default 'unknown'
    check (employment_status in ('unknown','seeking','employed','self_employed','further_study','not_seeking')),
  employer_name text,
  job_title text,
  employment_sector text,
  employment_county text,
  employment_start_date date,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  consent_to_contact boolean not null default false,
  last_contacted_on date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completion_year is null or completion_year between 1900 and 2200),
  check (graduation_year is null or graduation_year between 1900 and 2200)
);
create index if not exists college_alumni_employment_idx
  on public.college_alumni_records(employment_status, graduation_year desc);
create index if not exists college_alumni_student_idx
  on public.college_alumni_records(student_id);

-- These records are private college records. Only authenticated users with relevant
-- administrative/HR/student-affairs roles may access them; students do not get direct access.
alter table public.college_staff_development enable row level security;
alter table public.college_staff_appraisals enable row level security;
alter table public.college_student_welfare_cases enable row level security;
alter table public.college_alumni_records enable row level security;

drop policy if exists "college_staff_development_authorized" on public.college_staff_development;
create policy "college_staff_development_authorized" on public.college_staff_development
for all to authenticated
using (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','hr','registrar')))
with check (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','hr','registrar')));

drop policy if exists "college_staff_appraisals_authorized" on public.college_staff_appraisals;
create policy "college_staff_appraisals_authorized" on public.college_staff_appraisals
for all to authenticated
using (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','hr')))
with check (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','hr')));

drop policy if exists "college_student_welfare_authorized" on public.college_student_welfare_cases;
create policy "college_student_welfare_authorized" on public.college_student_welfare_cases
for all to authenticated
using (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','registrar','hr','hostel_manager')))
with check (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','registrar','hr','hostel_manager')));

drop policy if exists "college_alumni_records_authorized" on public.college_alumni_records;
create policy "college_alumni_records_authorized" on public.college_alumni_records
for all to authenticated
using (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','registrar','hr')))
with check (exists (select 1 from public.college_profiles p where p.id = auth.uid() and p.active = true and p.role in ('super_admin','principal','registrar','hr')));

grant select, insert, update, delete on public.college_staff_development to authenticated;
grant select, insert, update, delete on public.college_staff_appraisals to authenticated;
grant select, insert, update, delete on public.college_student_welfare_cases to authenticated;
grant select, insert, update, delete on public.college_alumni_records to authenticated;
