create or replace function public.set_college_practice_visit_server_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.supervisor_verified then
    new.verified_at := now();
    new.supervisor_verified_by := auth.uid();
  else
    new.verified_at := null;
    new.supervisor_verified_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists college_practice_visit_server_audit on public.college_practice_visits;
create trigger college_practice_visit_server_audit
before insert or update on public.college_practice_visits
for each row execute function public.set_college_practice_visit_server_audit();