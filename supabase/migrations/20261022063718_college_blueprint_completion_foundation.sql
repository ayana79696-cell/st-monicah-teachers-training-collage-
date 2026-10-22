-- Blueprint completion foundations: e-learning, parent access, unit registration,
-- graduation clearance, compliance records, configurable rules, early warnings and finance imports.

alter table public.college_profiles drop constraint if exists college_profiles_role_check;
alter table public.college_profiles add constraint college_profiles_role_check
  check (role = any (array['super_admin','principal','registrar','hod','lecturer','finance','librarian','hostel_manager','student','parent','practice_supervisor','hr','procurement_officer','ict_admin']::text[]));

create or replace function public.college_blueprint_has_role(p_roles text[])
returns boolean language sql stable security definer set search_path=public
as $fn$
  select exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active=true and p.role=any(p_roles));
$fn$;
revoke all on function public.college_blueprint_has_role(text[]) from public,anon;
grant execute on function public.college_blueprint_has_role(text[]) to authenticated;

create table if not exists public.college_learning_resources(
 id uuid primary key default gen_random_uuid(),
 unit_id uuid references public.college_units(id) on delete set null,
 title text not null check(length(trim(title)) between 2 and 200),
 description text,
 resource_type text not null default 'document' check(resource_type in ('document','link','video','reading','presentation','other')),
 resource_url text,
 is_published boolean not null default false,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.college_learning_assignments(
 id uuid primary key default gen_random_uuid(),
 unit_id uuid not null references public.college_units(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 200),
 instructions text not null,
 due_at timestamptz,
 max_score numeric not null default 100 check(max_score>0),
 status text not null default 'draft' check(status in ('draft','published','closed')),
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.college_learning_submissions(
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.college_learning_assignments(id) on delete cascade,
 student_id uuid not null references public.college_students(id) on delete cascade,
 submission_text text,
 file_url text,
 submitted_at timestamptz not null default now(),
 status text not null default 'submitted' check(status in ('submitted','late','marked','returned')),
 score numeric,
 feedback text,
 marked_by uuid references public.college_profiles(id) on delete set null,
 marked_at timestamptz,
 unique(assignment_id,student_id),
 check(score is null or score>=0)
);
create table if not exists public.college_parent_links(
 id uuid primary key default gen_random_uuid(),
 parent_profile_id uuid not null references public.college_profiles(id) on delete cascade,
 student_id uuid not null references public.college_students(id) on delete cascade,
 relationship text not null default 'Parent/guardian',
 active boolean not null default true,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(parent_profile_id,student_id)
);
create table if not exists public.college_unit_registrations(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.college_students(id) on delete cascade,
 unit_id uuid not null references public.college_units(id) on delete restrict,
 academic_period_id uuid not null references public.college_academic_periods(id) on delete restrict,
 status text not null default 'registered' check(status in ('registered','completed','withdrawn','resit_required')),
 registered_at timestamptz not null default now(),
 completed_at timestamptz,
 registered_by uuid references public.college_profiles(id) on delete set null,
 notes text,
 unique(student_id,unit_id,academic_period_id)
);
alter table public.college_units add column if not exists prerequisite_unit_id uuid references public.college_units(id) on delete set null;

create table if not exists public.college_graduation_clearance(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.college_students(id) on delete cascade,
 academic_period_id uuid references public.college_academic_periods(id) on delete set null,
 clearance_area text not null check(clearance_area in ('academic','fees','teaching_practice','documents','other')),
 status text not null default 'pending' check(status in ('pending','cleared','blocked')),
 notes text,
 reviewed_by uuid references public.college_profiles(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(student_id,academic_period_id,clearance_area)
);
create table if not exists public.college_quality_records(
 id uuid primary key default gen_random_uuid(),
 record_type text not null check(record_type in ('accreditation','inspection','trainer_qualification','curriculum_review','policy','approval','evidence','other')),
 title text not null check(length(trim(title)) between 2 and 220),
 details text,
 reference_number text,
 owner_name text,
 issued_on date,
 expires_on date,
 status text not null default 'draft' check(status in ('draft','active','submitted','approved','expired','closed')),
 file_url text,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.college_workflow_rules(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 160),
 trigger_event text not null check(trigger_event in ('overdue_fees','attendance_absence','missing_marks','quality_expiry','admission_pending','manual')),
 threshold integer not null default 1 check(threshold between 1 and 365),
 reminder_hours integer not null default 24 check(reminder_hours between 1 and 8760),
 escalate_to_role text not null default 'principal' check(escalate_to_role in ('super_admin','principal','registrar','finance','hod','hr')),
 message_template text not null default 'Please review this pending item.',
 active boolean not null default true,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.college_workflow_runs(
 id uuid primary key default gen_random_uuid(),
 rule_id uuid references public.college_workflow_rules(id) on delete set null,
 started_by uuid references public.college_profiles(id) on delete set null,
 status text not null default 'completed' check(status in ('completed','failed')),
 items_found integer not null default 0,
 summary jsonb not null default '{}'::jsonb,
 error_message text,
 started_at timestamptz not null default now(),
 completed_at timestamptz
);
create table if not exists public.college_early_warning_alerts(
 id uuid primary key default gen_random_uuid(),
 alert_key text not null unique,
 student_id uuid references public.college_students(id) on delete cascade,
 category text not null check(category in ('attendance','academic','fees','quality','operations')),
 severity text not null check(severity in ('low','medium','high')),
 title text not null,
 details text not null,
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 assigned_to uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolved_by uuid references public.college_profiles(id) on delete set null
);
create table if not exists public.college_finance_import_batches(
 id uuid primary key default gen_random_uuid(),
 source_name text not null,
 imported_rows integer not null default 0,
 matched_rows integer not null default 0,
 skipped_rows integer not null default 0,
 duplicate_rows integer not null default 0,
 status text not null default 'completed' check(status in ('processing','completed','failed')),
 notes text,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.college_payments add column if not exists import_batch_id uuid references public.college_finance_import_batches(id) on delete set null;
create unique index if not exists college_payments_reference_unique_idx
 on public.college_payments (lower(trim(reference_number)))
 where reference_number is not null and trim(reference_number)<>'';
create table if not exists public.college_document_review_items(
 id uuid primary key default gen_random_uuid(),
 student_id uuid references public.college_students(id) on delete cascade,
 application_id uuid references public.college_admissions_applications(id) on delete cascade,
 document_type text not null,
 storage_path text,
 status text not null default 'pending' check(status in ('pending','verified','rejected','missing')),
 reviewer_notes text,
 reviewed_by uuid references public.college_profiles(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check(student_id is not null or application_id is not null)
);
create index if not exists college_learning_resources_unit_idx on public.college_learning_resources(unit_id,is_published);
create index if not exists college_learning_assignments_unit_idx on public.college_learning_assignments(unit_id,status,due_at);
create index if not exists college_unit_registrations_student_idx on public.college_unit_registrations(student_id,academic_period_id,status);
create index if not exists college_early_warning_status_idx on public.college_early_warning_alerts(status,severity,created_at desc);
create index if not exists college_quality_expiry_idx on public.college_quality_records(expires_on,status);
create index if not exists college_parent_links_parent_idx on public.college_parent_links(parent_profile_id,active);

create or replace function public.college_parent_portal_summary()
returns jsonb language plpgsql stable security definer set search_path=public
as $fn$
declare out_json jsonb;
begin
 if not exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active=true and p.role='parent') then raise exception 'Active parent account required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'student',jsonb_build_object('id',s.id,'admission_number',s.admission_number,'first_name',s.first_name,'middle_name',s.middle_name,'last_name',s.last_name,'status',s.status,'intake',s.intake,'intake_year',s.intake_year,'programme',pr.title),
   'relationship',pl.relationship,
   'fees',coalesce((select jsonb_agg(jsonb_build_object('description',fc.description,'amount_kes',fc.amount_kes,'discount_kes',fc.discount_kes,'charge_status',fc.charge_status,'due_date',fc.due_date) order by fc.due_date desc) from public.college_fee_charges fc where fc.student_id=s.id and fc.charge_status in ('posted','draft')),'[]'::jsonb),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('amount_kes',p.amount_kes,'reference_number',p.reference_number,'payment_method',p.payment_method,'paid_at',p.paid_at) order by p.paid_at desc) from public.college_payments p where p.student_id=s.id),'[]'::jsonb),
   'attendance',coalesce((select jsonb_agg(jsonb_build_object('session_date',a.session_date,'status',a.status) order by a.session_date desc) from (select * from public.college_attendance where student_id=s.id order by session_date desc limit 20) a),'[]'::jsonb),
   'results',coalesce((select jsonb_agg(jsonb_build_object('assessment',asmt.title,'unit',u.unit_title,'score',r.score,'max_score',asmt.max_score,'approved_at',r.approved_at) order by r.approved_at desc) from public.college_results r join public.college_assessments asmt on asmt.id=r.assessment_id left join public.college_units u on u.id=asmt.unit_id where r.student_id=s.id and r.approved_at is not null),'[]'::jsonb)
 )),'[]'::jsonb) into out_json
 from public.college_parent_links pl join public.college_students s on s.id=pl.student_id left join public.college_programmes pr on pr.id=s.programme_id
 where pl.parent_profile_id=auth.uid() and pl.active=true;
 return out_json;
end;
$fn$;
revoke all on function public.college_parent_portal_summary() from public,anon;
grant execute on function public.college_parent_portal_summary() to authenticated;

create or replace function public.college_register_student_units(p_student_id uuid,p_academic_period_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $fn$
declare student_programme uuid; inserted integer:=0; eligible integer:=0;
begin
 if not public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']) then raise exception 'You are not permitted to register units'; end if;
 select programme_id into student_programme from public.college_students where id=p_student_id and status='active';
 if student_programme is null then raise exception 'Active student with programme is required'; end if;
 perform 1 from public.college_academic_periods where id=p_academic_period_id;
 if not found then raise exception 'Select a valid academic period'; end if;
 select count(*) into eligible from public.college_units u where u.programme_id=student_programme and coalesce(u.active,true)
 and (u.prerequisite_unit_id is null or exists(select 1 from public.college_unit_registrations prev where prev.student_id=p_student_id and prev.unit_id=u.prerequisite_unit_id and prev.status='completed'));
 insert into public.college_unit_registrations(student_id,unit_id,academic_period_id,registered_by)
 select p_student_id,u.id,p_academic_period_id,auth.uid() from public.college_units u where u.programme_id=student_programme and coalesce(u.active,true)
 and (u.prerequisite_unit_id is null or exists(select 1 from public.college_unit_registrations prev where prev.student_id=p_student_id and prev.unit_id=u.prerequisite_unit_id and prev.status='completed'))
 on conflict(student_id,unit_id,academic_period_id) do nothing;
 get diagnostics inserted=row_count;
 return jsonb_build_object('inserted',inserted,'eligible',eligible,'skipped',greatest(eligible-inserted,0));
end;
$fn$;
revoke all on function public.college_register_student_units(uuid,uuid) from public,anon;
grant execute on function public.college_register_student_units(uuid,uuid) to authenticated;

create or replace function public.college_detect_timetable_conflicts()
returns table(session_a uuid,session_b uuid,conflict_type text,session_date date,weekday smallint,start_time time,end_time time,lecturer_id uuid,venue text)
language sql stable security definer set search_path=public
as $fn$
 select a.id,b.id,case when a.lecturer_id is not null and a.lecturer_id=b.lecturer_id then 'Lecturer double-booked' else 'Venue double-booked' end,
 coalesce(a.session_date,b.session_date),a.weekday,greatest(a.starts_at,b.starts_at),least(a.ends_at,b.ends_at),a.lecturer_id,coalesce(a.venue,b.venue)
 from public.college_timetable_sessions a join public.college_timetable_sessions b on a.id<b.id
 and ((a.session_date is not null and a.session_date=b.session_date) or (a.session_date is null and b.session_date is null and a.weekday=b.weekday and a.academic_period_id is not distinct from b.academic_period_id))
 and a.starts_at<b.ends_at and a.ends_at>b.starts_at
 and ((a.lecturer_id is not null and a.lecturer_id=b.lecturer_id) or (nullif(trim(a.venue),'') is not null and upper(trim(a.venue))=upper(trim(b.venue))))
 where public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer'])
$fn$;
revoke all on function public.college_detect_timetable_conflicts() from public,anon;
grant execute on function public.college_detect_timetable_conflicts() to authenticated;

create or replace function public.college_timetable_conflict_guard()
returns trigger language plpgsql security definer set search_path=public
as $fn$
declare conflicting uuid;
begin
 if new.starts_at>=new.ends_at then raise exception 'Lesson end time must be after start time'; end if;
 select s.id into conflicting from public.college_timetable_sessions s where s.id is distinct from new.id
 and ((new.session_date is not null and s.session_date=new.session_date) or (new.session_date is null and s.session_date is null and s.weekday=new.weekday and s.academic_period_id is not distinct from new.academic_period_id))
 and new.starts_at<s.ends_at and new.ends_at>s.starts_at
 and ((new.lecturer_id is not null and s.lecturer_id=new.lecturer_id) or (nullif(trim(new.venue),'') is not null and upper(trim(s.venue))=upper(trim(new.venue))))
 limit 1;
 if conflicting is not null then raise exception 'Timetable conflict: this lecturer or venue is already booked in the selected time slot'; end if;
 return new;
end;
$fn$;
drop trigger if exists college_timetable_conflict_guard_trg on public.college_timetable_sessions;
create trigger college_timetable_conflict_guard_trg before insert or update on public.college_timetable_sessions for each row execute function public.college_timetable_conflict_guard();

create or replace function public.college_refresh_early_warnings()
returns jsonb language plpgsql security definer set search_path=public,extensions
as $fn$
declare added integer:=0; n integer:=0; month_key text:=to_char(now() at time zone 'Africa/Nairobi','YYYY-MM');
begin
 if not public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','hod','lecturer']) then raise exception 'Not authorized to refresh alerts'; end if;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'attendance:'||s.id::text||':'||month_key,s.id,'attendance','high','Repeated student absence',count(*)::text||' absences recorded in the last 30 days.'
 from public.college_students s join public.college_attendance a on a.student_id=s.id where s.status='active' and a.session_date>=current_date-30 and a.status='absent'
 group by s.id having count(*)>=3 on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'academic:'||x.student_id::text||':'||month_key,x.student_id,'academic','high','Repeated low assessment scores',x.low_count::text||' approved assessment results below 40% of the maximum score in the last 90 days.'
 from (select r.student_id,count(*) as low_count from public.college_results r join public.college_assessments a on a.id=r.assessment_id where r.approved_at is not null and a.max_score>0 and r.score/a.max_score<0.4 and coalesce(r.approved_at,r.created_at)>=now()-interval '90 days' group by r.student_id having count(*)>=2) x on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'fees:'||s.id::text||':'||month_key,s.id,'fees','medium','Overdue fees for review','Estimated overdue balance: KES '||to_char(balance,'FM999999990.00')||'. Reconcile against the official student statement before action.'
 from (select c.student_id,greatest(sum(case when c.charge_status='posted' and c.due_date<current_date then greatest(coalesce(c.amount_kes,0)-coalesce(c.discount_kes,0),0) else 0 end)-coalesce(max(p.paid_total),0),0) balance
 from public.college_fee_charges c left join (select student_id,sum(amount_kes) paid_total from public.college_payments group by student_id) p on p.student_id=c.student_id group by c.student_id) x
 join public.college_students s on s.id=x.student_id where balance>0 on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,category,severity,title,details)
 select 'quality:'||q.id::text||':'||month_key,null,'quality','medium','Regulatory record expiry approaching',q.title||' expires on '||q.expires_on::text||'.'
 from public.college_quality_records q where q.expires_on between current_date and current_date+30 and q.status not in ('expired','closed') on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 return jsonb_build_object('new_alerts',added,'checked_at',now());
end;
$fn$;
revoke all on function public.college_refresh_early_warnings() from public,anon;
grant execute on function public.college_refresh_early_warnings() to authenticated;

do $policies$
declare t text;
begin
 foreach t in array array['college_learning_resources','college_learning_assignments','college_learning_submissions','college_parent_links','college_unit_registrations','college_graduation_clearance','college_quality_records','college_workflow_rules','college_workflow_runs','college_early_warning_alerts','college_finance_import_batches','college_document_review_items'] loop execute format('alter table public.%I enable row level security',t); end loop;
end
$policies$;

drop policy if exists learning_resources_read_staff_student on public.college_learning_resources;
create policy learning_resources_read_staff_student on public.college_learning_resources for select to authenticated using(
 public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer','practice_supervisor','student']) and
 (public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer','practice_supervisor']) or
 (is_published and (unit_id is null or exists(select 1 from public.college_profiles p join public.college_unit_registrations ur on ur.student_id=p.student_id where p.id=auth.uid() and p.role='student' and ur.unit_id=college_learning_resources.unit_id and ur.status in ('registered','completed')))))
);
drop policy if exists learning_resources_manage_staff on public.college_learning_resources;
create policy learning_resources_manage_staff on public.college_learning_resources for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']));
drop policy if exists learning_assignments_read_staff_student on public.college_learning_assignments;
create policy learning_assignments_read_staff_student on public.college_learning_assignments for select to authenticated using(
 public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer','student']) and
 (public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']) or
 (status='published' and exists(select 1 from public.college_profiles p join public.college_unit_registrations ur on ur.student_id=p.student_id where p.id=auth.uid() and p.role='student' and ur.unit_id=college_learning_assignments.unit_id and ur.status in ('registered','completed'))))
);
drop policy if exists learning_assignments_manage_staff on public.college_learning_assignments;
create policy learning_assignments_manage_staff on public.college_learning_assignments for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']));
drop policy if exists learning_submissions_read_staff_or_own on public.college_learning_submissions;
create policy learning_submissions_read_staff_or_own on public.college_learning_submissions for select to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']) or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_learning_submissions.student_id));
drop policy if exists learning_submissions_student_insert_own on public.college_learning_submissions;
create policy learning_submissions_student_insert_own on public.college_learning_submissions for insert to authenticated with check(
 exists(select 1 from public.college_profiles p join public.college_learning_assignments a on a.id=college_learning_submissions.assignment_id where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_learning_submissions.student_id and a.status='published')
);
drop policy if exists learning_submissions_mark_staff on public.college_learning_submissions;
create policy learning_submissions_mark_staff on public.college_learning_submissions for update to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']));
drop policy if exists parent_links_admin_manage on public.college_parent_links;
create policy parent_links_admin_manage on public.college_parent_links for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar']));
drop policy if exists parent_links_parent_read_own on public.college_parent_links;
create policy parent_links_parent_read_own on public.college_parent_links for select to authenticated using(parent_profile_id=auth.uid());
drop policy if exists unit_registrations_read_scoped on public.college_unit_registrations;
create policy unit_registrations_read_scoped on public.college_unit_registrations for select to authenticated using(
 public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer','student']) and
 (public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']) or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.student_id=college_unit_registrations.student_id))
);
drop policy if exists unit_registrations_manage_staff on public.college_unit_registrations;
create policy unit_registrations_manage_staff on public.college_unit_registrations for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','hod','lecturer']));
drop policy if exists graduation_clearance_read_manage on public.college_graduation_clearance;
create policy graduation_clearance_read_manage on public.college_graduation_clearance for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','librarian','hostel_manager','practice_supervisor'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','librarian','hostel_manager','practice_supervisor']));
drop policy if exists quality_records_read_manage on public.college_quality_records;
create policy quality_records_read_manage on public.college_quality_records for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','hr','ict_admin'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','hr','ict_admin']));
drop policy if exists workflow_rules_manage_admin on public.college_workflow_rules;
create policy workflow_rules_manage_admin on public.college_workflow_rules for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar']));
drop policy if exists workflow_runs_read_admin on public.college_workflow_runs;
create policy workflow_runs_read_admin on public.college_workflow_runs for select to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar']));
drop policy if exists workflow_runs_insert_admin on public.college_workflow_runs;
create policy workflow_runs_insert_admin on public.college_workflow_runs for insert to authenticated with check(public.college_blueprint_has_role(array['super_admin','principal','registrar']));
drop policy if exists alerts_read_manage on public.college_early_warning_alerts;
create policy alerts_read_manage on public.college_early_warning_alerts for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','hod','lecturer'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','hod','lecturer']));
drop policy if exists finance_import_batches_read_manage on public.college_finance_import_batches;
create policy finance_import_batches_read_manage on public.college_finance_import_batches for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','finance'])) with check(public.college_blueprint_has_role(array['super_admin','principal','finance']));
drop policy if exists document_review_read_manage on public.college_document_review_items;
create policy document_review_read_manage on public.college_document_review_items for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar']));

grant select,insert,update,delete on public.college_learning_resources,public.college_learning_assignments,public.college_learning_submissions,public.college_parent_links,public.college_unit_registrations,public.college_graduation_clearance,public.college_quality_records,public.college_workflow_rules,public.college_workflow_runs,public.college_early_warning_alerts,public.college_finance_import_batches,public.college_document_review_items to authenticated;
