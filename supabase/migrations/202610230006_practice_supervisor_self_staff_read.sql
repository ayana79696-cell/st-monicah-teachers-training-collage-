drop policy if exists college_staff_read on public.college_staff;
create policy college_staff_read
on public.college_staff
for select
to authenticated
using (
  (select private.current_college_role()) = any (array['super_admin','principal','registrar','hod','hr']::text[])
  or (
    (select private.current_college_role()) = 'lecturer'
    and profile_id = (select auth.uid())
  )
  or (
    (select private.current_college_role()) = 'practice_supervisor'
    and profile_id = (select auth.uid())
  )
);