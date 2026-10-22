drop policy if exists learning_submissions_student_insert_own on public.college_learning_submissions;
create policy learning_submissions_student_insert_own on public.college_learning_submissions for insert to authenticated with check (
 exists(select 1 from public.college_profiles p
   join public.college_learning_assignments a on a.id=college_learning_submissions.assignment_id
   where p.id=auth.uid() and p.active=true and p.role='student'
     and p.student_id=college_learning_submissions.student_id
     and a.status='published')
);
