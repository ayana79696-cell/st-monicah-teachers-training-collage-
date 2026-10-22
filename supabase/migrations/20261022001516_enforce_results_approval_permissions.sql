-- Enforce the assessed-mark approval workflow at the database privilege/status level.
-- Result entry and approval must use the validated SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.college_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.college_results TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_college_assessment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text := private.current_college_role();
  v_unapproved_count integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF OLD.status = 'draft' AND NEW.status = 'open' THEN
    IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod','lecturer']::text[]) THEN
      RAISE EXCEPTION 'Your college role cannot open assessments for mark entry.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'open' AND NEW.status = 'submitted' THEN
    IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod','lecturer']::text[]) THEN
      RAISE EXCEPTION 'Your college role cannot submit assessment marks.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
      RAISE EXCEPTION 'Use the authorized results approval function to release marks.';
    END IF;
    SELECT count(*) INTO v_unapproved_count
      FROM public.college_results r WHERE r.assessment_id = OLD.id AND r.approved_at IS NULL;
    IF v_unapproved_count > 0 THEN
      RAISE EXCEPTION 'An assessment cannot be approved while unapproved marks remain.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status = 'approved' AND NEW.status = 'open' THEN
    IF v_role <> ALL (ARRAY['super_admin','principal','registrar']::text[]) THEN
      RAISE EXCEPTION 'Only an academic administrator can reopen an approved assessment.';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid assessment status transition: % to %.', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS college_assessment_status_transition_guard ON public.college_assessments;
CREATE TRIGGER college_assessment_status_transition_guard
BEFORE UPDATE OF status ON public.college_assessments
FOR EACH ROW EXECUTE FUNCTION private.guard_college_assessment_status_transition();
