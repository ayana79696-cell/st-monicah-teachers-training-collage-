-- A student record must not be linked to more than one login profile.
CREATE UNIQUE INDEX IF NOT EXISTS college_profiles_student_id_unique
  ON public.college_profiles (student_id) WHERE student_id IS NOT NULL;
