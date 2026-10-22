drop policy if exists learning_submissions_student_update_own on public.college_learning_submissions;
create policy learning_submissions_student_update_own on public.college_learning_submissions for update to authenticated
using (exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active=true and p.role='student' and p.student_id=college_learning_submissions.student_id and college_learning_submissions.status in ('submitted','late')))
with check (
 exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active=true and p.role='student' and p.student_id=college_learning_submissions.student_id)
 and status in ('submitted','late') and score is null and marked_by is null and marked_at is null
);
create or replace function public.college_learning_submission_guard()
returns trigger language plpgsql security definer set search_path=public
as $fn$
declare profile_role text;
begin
 select role into profile_role from public.college_profiles where id=auth.uid() and active=true;
 if profile_role='student' then
   if new.student_id is distinct from old.student_id or new.assignment_id is distinct from old.assignment_id then raise exception 'Students cannot change the assignment or student identity on a submission'; end if;
   if new.score is distinct from old.score or new.feedback is distinct from old.feedback or new.marked_by is distinct from old.marked_by or new.marked_at is distinct from old.marked_at or new.status not in ('submitted','late') then raise exception 'Students cannot change marking fields or submission status'; end if;
   new.submitted_at:=now();
 end if;
 return new;
end;
$fn$;
drop trigger if exists college_learning_submission_guard_trg on public.college_learning_submissions;
create trigger college_learning_submission_guard_trg before update on public.college_learning_submissions for each row execute function public.college_learning_submission_guard();
