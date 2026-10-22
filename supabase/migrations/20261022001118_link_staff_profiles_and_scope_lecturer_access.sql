-- Link staff accounts to staff records and scope academic access by assignment.
ALTER TABLE public.college_staff
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS college_staff_profile_id_unique
  ON public.college_staff (profile_id) WHERE profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_college_profile_staff_link(p_profile_id uuid, p_staff_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_target_role text; v_staff_profile uuid;
BEGIN
  IF auth.uid() IS NULL OR private.current_college_role() <> 'super_admin' THEN
    RAISE EXCEPTION 'Only the Super Administrator can link staff login accounts.';
  END IF;
  SELECT role INTO v_target_role FROM public.college_profiles WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'The login profile was not found.'; END IF;
  IF p_staff_id IS NOT NULL THEN
    IF v_target_role = 'student' THEN RAISE EXCEPTION 'A student login cannot be linked to an employee record.'; END IF;
    SELECT profile_id INTO v_staff_profile FROM public.college_staff WHERE id = p_staff_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'The selected staff record was not found.'; END IF;
    IF v_staff_profile IS NOT NULL AND v_staff_profile <> p_profile_id THEN
      RAISE EXCEPTION 'That staff record is already linked to another login.';
    END IF;
  END IF;
  UPDATE public.college_staff SET profile_id = NULL
   WHERE profile_id = p_profile_id AND (p_staff_id IS NULL OR id <> p_staff_id);
  IF p_staff_id IS NOT NULL THEN
    UPDATE public.college_staff SET profile_id = p_profile_id WHERE id = p_staff_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_college_profile_staff_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_college_profile_staff_link(uuid, uuid) TO authenticated;

-- Lecturers may read only their own staff row; staff managers retain directory access.
DROP POLICY IF EXISTS college_staff_read ON public.college_staff;
CREATE POLICY college_staff_read ON public.college_staff
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','hod','hr']::text[])
    OR ((SELECT private.current_college_role()) = 'lecturer' AND profile_id = auth.uid())
  );

-- Course-unit visibility follows lecturer assignment and HOD department.
DROP POLICY IF EXISTS college_units_manage ON public.college_units;
CREATE POLICY college_units_manage ON public.college_units
  FOR ALL TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_programmes pr
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE pr.id = college_units.programme_id AND cp.active = true
          AND cp.department IS NOT NULL
          AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
  )
  WITH CHECK (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_programmes pr
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE pr.id = college_units.programme_id AND cp.active = true
          AND cp.department IS NOT NULL
          AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
  );

DROP POLICY IF EXISTS college_units_read ON public.college_units;
CREATE POLICY college_units_read ON public.college_units
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) IS NOT NULL
    AND (
      (SELECT private.current_college_role()) NOT IN ('lecturer','hod','student')
      OR (
        (SELECT private.current_college_role()) = 'lecturer'
        AND EXISTS (
          SELECT 1 FROM public.college_staff st
          WHERE st.id = college_units.lecturer_id
            AND st.profile_id = auth.uid() AND st.employment_status = 'active'
        )
      )
      OR (
        (SELECT private.current_college_role()) = 'hod'
        AND EXISTS (
          SELECT 1 FROM public.college_programmes pr
          JOIN public.college_profiles cp ON cp.id = auth.uid()
          WHERE pr.id = college_units.programme_id AND cp.active = true
            AND cp.department IS NOT NULL
            AND lower(btrim(pr.department)) = lower(btrim(cp.department))
        )
      )
      OR (
        (SELECT private.current_college_role()) = 'student'
        AND EXISTS (
          SELECT 1 FROM public.college_profiles cp
          JOIN public.college_students st ON st.id = cp.student_id
          WHERE cp.id = auth.uid() AND cp.active = true
            AND st.programme_id = college_units.programme_id
        )
      )
    )
  );

DROP POLICY IF EXISTS college_assessments_manage ON public.college_assessments;
CREATE POLICY college_assessments_manage ON public.college_assessments
  FOR ALL TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE u.id = college_assessments.unit_id AND cp.active = true
          AND cp.department IS NOT NULL AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE u.id = college_assessments.unit_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  )
  WITH CHECK (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE u.id = college_assessments.unit_id AND cp.active = true
          AND cp.department IS NOT NULL AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE u.id = college_assessments.unit_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS college_assessments_read ON public.college_assessments;
CREATE POLICY college_assessments_read ON public.college_assessments
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','practice_supervisor']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE u.id = college_assessments.unit_id AND cp.active = true
          AND cp.department IS NOT NULL AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE u.id = college_assessments.unit_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'student'
      AND EXISTS (
        SELECT 1 FROM public.college_results r
        WHERE r.assessment_id = college_assessments.id AND r.approved_at IS NOT NULL
          AND r.student_id = (SELECT cp.student_id FROM public.college_profiles cp WHERE cp.id = auth.uid() AND cp.active = true)
      )
    )
  );

DROP POLICY IF EXISTS college_results_manage ON public.college_results;
CREATE POLICY college_results_manage ON public.college_results
  FOR ALL TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE a.id = college_results.assessment_id AND cp.active = true AND cp.department IS NOT NULL
          AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE a.id = college_results.assessment_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  )
  WITH CHECK (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE a.id = college_results.assessment_id AND cp.active = true AND cp.department IS NOT NULL
          AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE a.id = college_results.assessment_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS college_results_read ON public.college_results;
CREATE POLICY college_results_read ON public.college_results
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_programmes pr ON pr.id = u.programme_id
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE a.id = college_results.assessment_id AND cp.active = true AND cp.department IS NOT NULL
          AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_assessments a
        JOIN public.college_units u ON u.id = a.unit_id
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE a.id = college_results.assessment_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS college_students_read ON public.college_students;
CREATE POLICY college_students_read ON public.college_students
  FOR SELECT TO authenticated
  USING (
    (SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','finance','librarian','hostel_manager','practice_supervisor']::text[])
    OR (
      (SELECT private.current_college_role()) = 'hod'
      AND EXISTS (
        SELECT 1 FROM public.college_programmes pr
        JOIN public.college_profiles cp ON cp.id = auth.uid()
        WHERE pr.id = college_students.programme_id AND cp.active = true
          AND cp.department IS NOT NULL AND lower(btrim(pr.department)) = lower(btrim(cp.department))
      )
    )
    OR (
      (SELECT private.current_college_role()) = 'lecturer'
      AND EXISTS (
        SELECT 1 FROM public.college_units u
        JOIN public.college_staff st ON st.id = u.lecturer_id
        WHERE u.programme_id = college_students.programme_id
          AND st.profile_id = auth.uid() AND st.employment_status = 'active'
      )
    )
  );

-- Server-side scope checks ensure direct API calls cannot bypass page-level restrictions.
CREATE OR REPLACE FUNCTION public.save_college_assessment_result(
  p_assessment_id uuid, p_student_id uuid, p_score numeric, p_lecturer_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid(); v_role text := private.current_college_role();
  v_max_score numeric; v_assessment_status text; v_unit_id uuid; v_unit_programme uuid;
  v_department text; v_student_programme uuid; v_student_status text; v_result_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.college_profiles p WHERE p.id = v_actor AND p.active = true) THEN
    RAISE EXCEPTION 'An active college login is required to enter results.';
  END IF;
  IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod','lecturer']::text[]) THEN
    RAISE EXCEPTION 'Your college role is not permitted to enter results.';
  END IF;

  SELECT a.max_score, a.status, u.id, u.programme_id, pr.department
    INTO v_max_score, v_assessment_status, v_unit_id, v_unit_programme, v_department
    FROM public.college_assessments a
    JOIN public.college_units u ON u.id = a.unit_id
    JOIN public.college_programmes pr ON pr.id = u.programme_id
   WHERE a.id = p_assessment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment or linked course unit was not found.'; END IF;
  IF v_assessment_status <> 'open' THEN RAISE EXCEPTION 'Marks can only be changed while the assessment is open for entry.'; END IF;
  IF v_max_score IS NULL OR v_max_score <= 0 THEN RAISE EXCEPTION 'Set a valid maximum score before entering marks.'; END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > v_max_score THEN
    RAISE EXCEPTION 'Score must be between 0 and the assessment maximum (%).', v_max_score;
  END IF;

  IF v_role = 'lecturer' AND NOT EXISTS (
    SELECT 1 FROM public.college_units u
    JOIN public.college_staff st ON st.id = u.lecturer_id
    WHERE u.id = v_unit_id AND st.profile_id = v_actor AND st.employment_status = 'active'
  ) THEN RAISE EXCEPTION 'You can only enter marks for course units assigned to your staff account.'; END IF;
  IF v_role = 'hod' AND NOT EXISTS (
    SELECT 1 FROM public.college_profiles cp WHERE cp.id = v_actor AND cp.active = true
      AND cp.department IS NOT NULL AND lower(btrim(cp.department)) = lower(btrim(v_department))
  ) THEN RAISE EXCEPTION 'You can only manage marks for programmes in your assigned department.'; END IF;

  SELECT s.programme_id, s.status INTO v_student_programme, v_student_status
    FROM public.college_students s WHERE s.id = p_student_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student record was not found.'; END IF;
  IF v_student_status <> 'active' THEN RAISE EXCEPTION 'Results can only be entered for active students.'; END IF;
  IF v_student_programme IS DISTINCT FROM v_unit_programme THEN
    RAISE EXCEPTION 'The selected student is not registered in the programme for this assessment.';
  END IF;

  INSERT INTO public.college_results (assessment_id, student_id, score, lecturer_comment, approved_by, approved_at)
  VALUES (p_assessment_id, p_student_id, p_score, NULLIF(btrim(p_lecturer_comment), ''), NULL, NULL)
  ON CONFLICT (assessment_id, student_id)
  DO UPDATE SET score = EXCLUDED.score, lecturer_comment = EXCLUDED.lecturer_comment, approved_by = NULL, approved_at = NULL
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
DECLARE v_actor uuid := auth.uid(); v_role text := private.current_college_role(); v_status text; v_department text; v_count integer;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.college_profiles p WHERE p.id = v_actor AND p.active = true) THEN
    RAISE EXCEPTION 'An active college login is required to approve results.';
  END IF;
  IF v_role <> ALL (ARRAY['super_admin','principal','registrar','hod']::text[]) THEN
    RAISE EXCEPTION 'Only the Super Administrator, Principal, Registrar or HOD can approve results.';
  END IF;

  SELECT a.status, pr.department INTO v_status, v_department
    FROM public.college_assessments a
    JOIN public.college_units u ON u.id = a.unit_id
    JOIN public.college_programmes pr ON pr.id = u.programme_id
   WHERE a.id = p_assessment_id FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment was not found.'; END IF;
  IF v_status <> 'submitted' THEN RAISE EXCEPTION 'Only a submitted assessment can be approved.'; END IF;
  IF v_role = 'hod' AND NOT EXISTS (
    SELECT 1 FROM public.college_profiles cp WHERE cp.id = v_actor AND cp.active = true
      AND cp.department IS NOT NULL AND lower(btrim(cp.department)) = lower(btrim(v_department))
  ) THEN RAISE EXCEPTION 'You can only approve results for programmes in your assigned department.'; END IF;

  UPDATE public.college_results SET approved_by = v_actor, approved_at = now()
   WHERE assessment_id = p_assessment_id AND approved_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'No pending marks were found for this assessment.'; END IF;
  UPDATE public.college_assessments SET status = 'approved' WHERE id = p_assessment_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.set_college_profile_staff_link(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_college_profile_staff_link(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.save_college_assessment_result(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_college_assessment_result(uuid, uuid, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_college_assessment_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_college_assessment_results(uuid) TO authenticated;
