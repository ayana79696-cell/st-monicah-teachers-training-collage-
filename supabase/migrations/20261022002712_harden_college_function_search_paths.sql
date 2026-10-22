-- Use explicit, stable search paths for public application functions.
-- All application table references in these functions are schema-qualified.
ALTER FUNCTION public.normalize_college_form_values()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.approve_college_admission(uuid)
  SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.review_college_admission(uuid, text, text)
  SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.get_college_admission_tracking(text)
  SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.submit_college_admission(jsonb)
  SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.update_college_admission_tracking(text, jsonb, text)
  SET search_path = pg_catalog, public, auth, extensions;
ALTER FUNCTION public.verify_college_student_passport(uuid)
  SET search_path = pg_catalog, public, auth, extensions;
