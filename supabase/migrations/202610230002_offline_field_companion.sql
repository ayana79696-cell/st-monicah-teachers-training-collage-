alter table public.college_practice_visits
  add column if not exists client_record_id uuid,
  add column if not exists lesson_plan_notes text,
  add column if not exists lesson_observation text,
  add column if not exists trainee_reflection text,
  add column if not exists supervisor_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists supervisor_verified_by uuid,
  add column if not exists gps_latitude double precision,
  add column if not exists gps_longitude double precision,
  add column if not exists gps_accuracy_m double precision,
  add column if not exists client_recorded_at timestamptz;

create unique index if not exists college_practice_visits_client_record_id_uidx
  on public.college_practice_visits (client_record_id)
  where client_record_id is not null;

alter table public.college_practice_visits
  drop constraint if exists college_practice_visits_gps_latitude_range_check;
alter table public.college_practice_visits
  add constraint college_practice_visits_gps_latitude_range_check
  check (gps_latitude is null or gps_latitude between -90 and 90);
alter table public.college_practice_visits
  drop constraint if exists college_practice_visits_gps_longitude_range_check;
alter table public.college_practice_visits
  add constraint college_practice_visits_gps_longitude_range_check
  check (gps_longitude is null or gps_longitude between -180 and 180);
alter table public.college_practice_visits
  drop constraint if exists college_practice_visits_gps_accuracy_range_check;
alter table public.college_practice_visits
  add constraint college_practice_visits_gps_accuracy_range_check
  check (gps_accuracy_m is null or gps_accuracy_m >= 0);
