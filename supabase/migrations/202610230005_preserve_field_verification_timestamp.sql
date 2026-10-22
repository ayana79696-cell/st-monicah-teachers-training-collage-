create or replace function public.set_college_practice_visit_server_audit()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.supervisor_verified then
    if tg_op = 'INSERT' or old.supervisor_verified is distinct from new.supervisor_verified or new.supervisor_verified_by is null then
      new.verified_at := now();
      new.supervisor_verified_by := auth.uid();
    end if;
  else
    new.verified_at := null;
    new.supervisor_verified_by := null;
  end if;
  return new;
end;
$$;