-- Restrict one-time Super Administrator bootstrap to the designated college email.
-- A random authenticated account must never be able to claim the first admin role.
CREATE OR REPLACE FUNCTION public.claim_initial_college_super_admin(p_full_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_count bigint;
  v_full_name text := pg_catalog.left(pg_catalog.btrim(p_full_name), 120);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;

  SELECT pg_catalog.lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_email IS DISTINCT FROM 'superadmin@stmonicah.com' THEN
    RAISE EXCEPTION 'Only superadmin@stmonicah.com may claim the initial Super Administrator role.';
  END IF;

  IF v_full_name IS NULL OR pg_catalog.length(v_full_name) < 2 THEN
    RAISE EXCEPTION 'Enter the Super Administrator full name.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('saint_monicas_initial_admin_claim'));
  SELECT count(*) INTO v_count FROM public.college_profiles;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Initial setup has already been claimed. Ask the existing super administrator to create your profile.';
  END IF;

  INSERT INTO public.college_profiles (id, full_name, role, active)
  VALUES (v_uid, v_full_name, 'super_admin', true);

  RETURN pg_catalog.jsonb_build_object('success', true, 'role', 'super_admin');
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_initial_college_super_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_initial_college_super_admin(text) TO authenticated;
