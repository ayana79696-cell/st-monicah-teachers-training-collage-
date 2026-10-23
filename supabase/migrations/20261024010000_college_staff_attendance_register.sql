create table if not exists public.college_staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.college_staff(id) on delete restrict,
  attendance_date date not null,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_method text not null default 'manual' check (check_in_method in ('manual','self_service','face_recognition','qr','gps','biometric')),
  check_out_method text check (check_out_method in ('manual','self_service','face_recognition','qr','gps','biometric')),
  check_in_latitude numeric(10,7),
  check_in_longitude numeric(10,7),
  check_in_accuracy_m numeric(9,2),
  check_out_latitude numeric(10,7),
  check_out_longitude numeric(10,7),
  check_out_accuracy_m numeric(9,2),
  status text not null default 'present' check (status in ('present','late','half_day','absent','on_leave')),
  notes text,
  check_in_recorded_by uuid references auth.users(id) on delete set null,
  check_out_recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, attendance_date),
  check (check_out_at is null or check_in_at is not null),
  check ((check_in_latitude is null and check_in_longitude is null) or (check_in_latitude between -90 and 90 and check_in_longitude between -180 and 180)),
  check ((check_out_latitude is null and check_out_longitude is null) or (check_out_latitude between -90 and 90 and check_out_longitude between -180 and 180))
);

create index if not exists college_staff_attendance_date_idx on public.college_staff_attendance (attendance_date desc);
create index if not exists college_staff_attendance_staff_date_idx on public.college_staff_attendance (staff_id, attendance_date desc);

alter table public.college_staff_attendance enable row level security;
drop policy if exists college_staff_attendance_read on public.college_staff_attendance;
create policy college_staff_attendance_read on public.college_staff_attendance for select to authenticated
using (
  (select private.current_college_role()) in ('super_admin','principal','hr','registrar')
  or exists (select 1 from public.college_staff s where s.id = staff_id and s.profile_id = (select auth.uid()))
);
revoke insert, update, delete on public.college_staff_attendance from anon, authenticated;
grant select on public.college_staff_attendance to authenticated;

create or replace function public.college_record_staff_attendance(
  p_staff_id uuid, p_action text, p_method text default 'manual',
  p_latitude numeric default null, p_longitude numeric default null,
  p_accuracy_m numeric default null, p_note text default null
)
returns public.college_staff_attendance
language plpgsql security definer set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_staff_profile uuid;
  v_attendance_date date := (now() at time zone 'Africa/Nairobi')::date;
  v_row public.college_staff_attendance;
  v_can_manage boolean;
begin
  if v_user is null then raise exception 'Sign in before recording staff attendance.'; end if;
  select role into v_role from public.college_profiles where id = v_user and active = true;
  if v_role is null then raise exception 'Your college account is not active or has no assigned role.'; end if;
  if p_action not in ('check_in','check_out') then raise exception 'Choose check-in or check-out.'; end if;
  if p_method not in ('manual','self_service','face_recognition','qr','gps','biometric') then raise exception 'Choose a supported attendance method.'; end if;
  if (p_latitude is null) <> (p_longitude is null) then raise exception 'Both GPS latitude and longitude are required when location is supplied.'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180) then raise exception 'The supplied GPS coordinates are invalid.'; end if;

  select profile_id into v_staff_profile from public.college_staff where id = p_staff_id and employment_status = 'active';
  if not found then raise exception 'Select an active staff member.'; end if;

  v_can_manage := v_role in ('super_admin','principal','hr');
  if not v_can_manage and v_staff_profile is distinct from v_user then
    raise exception 'You may only record attendance for your own linked staff profile.';
  end if;

  perform pg_advisory_xact_lock(hashtext('college_staff_attendance:' || p_staff_id::text || ':' || v_attendance_date::text));
  select * into v_row from public.college_staff_attendance
  where staff_id = p_staff_id and attendance_date = v_attendance_date for update;

  if p_action = 'check_in' then
    if found then raise exception 'Staff member has already checked in today.'; end if;
    insert into public.college_staff_attendance (
      staff_id, attendance_date, check_in_at, check_in_method, check_in_latitude,
      check_in_longitude, check_in_accuracy_m, notes, check_in_recorded_by
    ) values (
      p_staff_id, v_attendance_date, now(), p_method, p_latitude, p_longitude,
      p_accuracy_m, nullif(trim(coalesce(p_note,'')),''), v_user
    ) returning * into v_row;
  else
    if not found or v_row.check_in_at is null then raise exception 'Check in first before recording check-out.'; end if;
    if v_row.check_out_at is not null then raise exception 'Staff member has already checked out today.'; end if;
    update public.college_staff_attendance
    set check_out_at = now(), check_out_method = p_method, check_out_latitude = p_latitude,
        check_out_longitude = p_longitude, check_out_accuracy_m = p_accuracy_m,
        notes = coalesce(nullif(trim(coalesce(p_note,'')),''), notes),
        check_out_recorded_by = v_user, updated_at = now()
    where id = v_row.id returning * into v_row;
  end if;
  return v_row;
end
$function$;

revoke all on function public.college_record_staff_attendance(uuid,text,text,numeric,numeric,numeric,text) from public;
grant execute on function public.college_record_staff_attendance(uuid,text,text,numeric,numeric,numeric,text) to authenticated;