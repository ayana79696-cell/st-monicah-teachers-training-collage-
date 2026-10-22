-- Secure marks entry and approval before results are exposed to students.
CREATE OR REPLACE FUNCTION public.save_college_assessment_result(
  p_assessment_id uuid,
  p_student_id uuid,
  p_score numeric,
  p_lecturer_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := private.current_college_role();
  v_max_score numeric;
  v_assessment_status text;
  v_unit_programme uuid;
  v_student_programme uuid;
  v_student_status text;
  v_result_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.college_profiles p
    WHERE p.id = v_actor AND p.active = true
  ) THEN
    RAISE EXCEPTION 'An active college login is required to enter results.';
  END IF;
  IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod','lecturer']::text[]) THEN
    RAISE EXCEPTION 'Your college role is not permitted to enter results.';
  END IF;

  SELECT a.max_score, a.status, u.programme_id
    INTO v_max_score, v_assessment_status, v_unit_programme
    FROM public.college_assessments a
    JOIN public.college_units u ON u.id = a.unit_id
   WHERE a.id = p_assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment or linked course unit was not found.'; END IF;
  IF v_assessment_status <> 'open' THEN
    RAISE EXCEPTION 'Marks can only be changed while the assessment is open for entry.';
  END IF;
  IF v_max_score IS NULL OR v_max_score <= 0 THEN
    RAISE EXCEPTION 'Set a valid maximum score before entering marks.';
  END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > v_max_score THEN
    RAISE EXCEPTION 'Score must be between 0 and the assessment maximum (%).', v_max_score;
  END IF;

  SELECT s.programme_id, s.status
    INTO v_student_programme, v_student_status
    FROM public.college_students s
   WHERE s.id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student record was not found.'; END IF;
  IF v_student_status <> 'active' THEN RAISE EXCEPTION 'Results can only be entered for active students.'; END IF;
  IF v_student_programme IS DISTINCT FROM v_unit_programme THEN
    RAISE EXCEPTION 'The selected student is not registered in the programme for this assessment.';
  END IF;

  INSERT INTO public.college_results (
    assessment_id, student_id, score, lecturer_comment, approved_by, approved_at
  )
  VALUES (p_assessment_id, p_student_id, p_score, NULLIF(btrim(p_lecturer_comment), ''), NULL, NULL)
  ON CONFLICT (assessment_id, student_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    lecturer_comment = EXCLUDED.lecturer_comment,
    approved_by = NULL,
    approved_at = NULL
  RETURNING id INTO v_result_id;

  RETURN v_result_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_college_assessment_results(p_assessment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := private.current_college_role();
  v_status text;
  v_count integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.college_profiles p
    WHERE p.id = v_actor AND p.active = true
  ) THEN
    RAISE EXCEPTION 'An active college login is required to approve results.';
  END IF;
  IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod']::text[]) THEN
    RAISE EXCEPTION 'Only the Super Administrator, Principal, Registrar or HOD can approve results.';
  END IF;

  SELECT status INTO v_status
    FROM public.college_assessments
   WHERE id = p_assessment_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment was not found.'; END IF;
  IF v_status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted assessment can be approved.';
  END IF;

  UPDATE public.college_results
     SET approved_by = v_actor, approved_at = now()
   WHERE assessment_id = p_assessment_id AND approved_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'No pending marks were found for this assessment.'; END IF;

  UPDATE public.college_assessments SET status = 'approved' WHERE id = p_assessment_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_college_assessment_result(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_college_assessment_result(uuid, uuid, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_college_assessment_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_college_assessment_results(uuid) TO authenticated;

DROP POLICY IF EXISTS college_results_student_own_read ON public.college_results;
CREATE POLICY college_results_student_own_read ON public.college_results
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = 'student'
    AND approved_at IS NOT NULL
    AND student_id = (
      SELECT p.student_id FROM public.college_profiles p
      WHERE p.id = auth.uid() AND p.active = true
    )
  );

DROP POLICY IF EXISTS college_assessments_student_own_read ON public.college_assessments;
CREATE POLICY college_assessments_student_own_read ON public.college_assessments
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = 'student'
    AND EXISTS (
      SELECT 1 FROM public.college_results r
      WHERE r.assessment_id = college_assessments.id
        AND r.approved_at IS NOT NULL
        AND r.student_id = (
          SELECT p.student_id FROM public.college_profiles p
          WHERE p.id = auth.uid() AND p.active = true
        )
    )
  );
