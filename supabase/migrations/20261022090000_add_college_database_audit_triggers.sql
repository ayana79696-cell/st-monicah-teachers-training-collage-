-- Database audit trail for important St. Monicah college workflows.
-- Captures actor, table, record key and changed column names only. It deliberately
-- avoids writing old/new PII values to the audit trail.
CREATE OR REPLACE FUNCTION private.audit_college_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  v_entity_id uuid;
  v_entity_text text;
  v_fields text[];
  v_sensitive text[] := ARRAY[
    'national_id_number','kcse_index_number','kcse_grades','date_of_birth',
    'phone','email','guardian_phone','guardian_email','home_address',
    'passport_photo_url','photo_url','documents','notes'
  ];
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.college_profiles p
    WHERE p.id = v_actor AND p.active = true
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  v_entity_text := COALESCE(v_new->>'id', v_old->>'id');
  BEGIN
    v_entity_id := v_entity_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_entity_id := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
      INTO v_fields
      FROM jsonb_object_keys(v_new) AS keys(k)
     WHERE v_old->k IS DISTINCT FROM v_new->k
       AND NOT (k = ANY(v_sensitive));
  ELSIF TG_OP = 'INSERT' THEN
    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
      INTO v_fields
      FROM jsonb_object_keys(v_new) AS keys(k)
     WHERE NOT (k = ANY(v_sensitive));
  ELSE
    SELECT COALESCE(array_agg(k ORDER BY k), ARRAY[]::text[])
      INTO v_fields
      FROM jsonb_object_keys(v_old) AS keys(k)
     WHERE NOT (k = ANY(v_sensitive));
  END IF;

  INSERT INTO public.college_audit_log (actor_id, action, entity_table, entity_id, details)
  VALUES (
    v_actor,
    lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    jsonb_build_object('operation', lower(TG_OP), 'changed_fields', v_fields, 'source', 'database_trigger')
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS college_audit_log_created_at_idx
  ON public.college_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS college_audit_log_entity_idx
  ON public.college_audit_log (entity_table, entity_id);

DO $$
DECLARE
  t text;
  tables_to_audit text[] := ARRAY[
    'college_students','college_payments','college_attendance','college_staff',
    'college_fee_charges','college_results','college_messages',
    'college_admissions_applications','college_profiles','college_programmes',
    'college_practice_placements','college_student_passports','college_assessments',
    'college_bank_accounts','college_procurement_requests','college_library_loans',
    'college_hostel_allocations','college_academic_periods','college_timetable_sessions',
    'college_units','college_fee_structures','college_enrolments','college_practice_visits',
    'college_hostel_rooms','college_practice_partners'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_audit LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS college_audit_row_change ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change()',
        t
      );
    END IF;
  END LOOP;
END;
$$;
