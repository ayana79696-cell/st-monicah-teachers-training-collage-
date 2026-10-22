-- Inventory stock control, staff leave/payroll, student-account linking and
-- role-aware student portal access for St. Monicah Teachers Training College.

ALTER TABLE public.college_profiles
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.college_students(id) ON DELETE SET NULL;

ALTER TABLE public.college_profiles DROP CONSTRAINT IF EXISTS college_profiles_role_check;
ALTER TABLE public.college_profiles ADD CONSTRAINT college_profiles_role_check
  CHECK (role = ANY (ARRAY[
    'super_admin','principal','registrar','hod','lecturer','finance',
    'librarian','hostel_manager','student','practice_supervisor','hr',
    'procurement_officer','ict_admin'
  ]::text[]));

ALTER TABLE public.college_messages
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.college_programmes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_profile_id uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_error text;

CREATE INDEX IF NOT EXISTS college_messages_status_created_idx ON public.college_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS college_messages_programme_idx ON public.college_messages (programme_id) WHERE programme_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS college_profiles_student_id_idx ON public.college_profiles (student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.college_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text UNIQUE, item_name text NOT NULL,
  category text NOT NULL DEFAULT 'General', unit_of_measure text NOT NULL DEFAULT 'piece',
  quantity_on_hand numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  reorder_level numeric(12,2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost_kes >= 0),
  storage_location text, supplier_name text, active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.college_inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.college_inventory_items(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type = ANY (ARRAY['stock_in','stock_out','adjustment']::text[])),
  quantity numeric(12,2) NOT NULL,
  unit_cost_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_cost_kes >= 0),
  reference_number text, notes text,
  recorded_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((movement_type = 'adjustment' AND quantity <> 0) OR (movement_type <> 'adjustment' AND quantity > 0))
);

CREATE INDEX IF NOT EXISTS college_inventory_item_name_idx ON public.college_inventory_items (item_name);
CREATE INDEX IF NOT EXISTS college_inventory_low_stock_idx ON public.college_inventory_items (quantity_on_hand, reorder_level) WHERE active = true;
CREATE INDEX IF NOT EXISTS college_inventory_transactions_created_idx ON public.college_inventory_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS college_inventory_transactions_item_idx ON public.college_inventory_transactions (item_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.apply_college_inventory_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_delta numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  v_delta := CASE
    WHEN NEW.movement_type = 'stock_in' THEN NEW.quantity
    WHEN NEW.movement_type = 'stock_out' THEN -NEW.quantity
    ELSE NEW.quantity
  END;
  UPDATE public.college_inventory_items
     SET quantity_on_hand = quantity_on_hand + v_delta,
         updated_at = now(),
         unit_cost_kes = CASE WHEN NEW.unit_cost_kes > 0 THEN NEW.unit_cost_kes ELSE unit_cost_kes END
   WHERE id = NEW.item_id
   RETURNING quantity_on_hand INTO v_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory item was not found.'; END IF;
  IF v_balance < 0 THEN RAISE EXCEPTION 'Insufficient stock. This movement would make stock negative.'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS college_inventory_apply_movement ON public.college_inventory_transactions;
CREATE TRIGGER college_inventory_apply_movement AFTER INSERT ON public.college_inventory_transactions
FOR EACH ROW EXECUTE FUNCTION private.apply_college_inventory_movement();

CREATE TABLE IF NOT EXISTS public.college_staff_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.college_staff(id) ON DELETE RESTRICT,
  leave_type text NOT NULL CHECK (leave_type = ANY (ARRAY['annual','sick','maternity','paternity','compassionate','study','unpaid','other']::text[])),
  start_date date NOT NULL, end_date date NOT NULL, reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected','cancelled']::text[])),
  requested_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz, review_notes text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS college_leave_status_dates_idx ON public.college_staff_leave_requests (status, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.college_payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month date NOT NULL UNIQUE CHECK (extract(day from payroll_month) = 1),
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft','review','approved','paid']::text[])),
  notes text, created_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  approved_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_payroll_period_month_idx ON public.college_payroll_periods (payroll_month DESC);

CREATE TABLE IF NOT EXISTS public.college_payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.college_payroll_periods(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES public.college_staff(id) ON DELETE RESTRICT,
  basic_pay_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (basic_pay_kes >= 0),
  allowances_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (allowances_kes >= 0),
  overtime_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (overtime_kes >= 0),
  deductions_kes numeric(14,2) NOT NULL DEFAULT 0 CHECK (deductions_kes >= 0),
  net_pay_kes numeric(14,2) GENERATED ALWAYS AS (basic_pay_kes + allowances_kes + overtime_kes - deductions_kes) STORED,
  payment_reference text, paid_at timestamptz, notes text,
  created_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payroll_period_id, staff_id),
  CHECK (basic_pay_kes + allowances_kes + overtime_kes >= deductions_kes)
);
CREATE INDEX IF NOT EXISTS college_payroll_entries_staff_idx ON public.college_payroll_entries (staff_id, payroll_period_id);

ALTER TABLE public.college_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_staff_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_payroll_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS college_inventory_items_read ON public.college_inventory_items;
CREATE POLICY college_inventory_items_read ON public.college_inventory_items FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','finance','procurement_officer','ict_admin']::text[]));
DROP POLICY IF EXISTS college_inventory_items_manage ON public.college_inventory_items;
CREATE POLICY college_inventory_items_manage ON public.college_inventory_items FOR ALL TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','finance','procurement_officer','ict_admin']::text[]))
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','finance','procurement_officer','ict_admin']::text[]));

DROP POLICY IF EXISTS college_inventory_transactions_read ON public.college_inventory_transactions;
CREATE POLICY college_inventory_transactions_read ON public.college_inventory_transactions FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','finance','procurement_officer','ict_admin']::text[]));
DROP POLICY IF EXISTS college_inventory_transactions_insert ON public.college_inventory_transactions;
CREATE POLICY college_inventory_transactions_insert ON public.college_inventory_transactions FOR INSERT TO authenticated
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','finance','procurement_officer','ict_admin']::text[]) AND (recorded_by IS NULL OR recorded_by = auth.uid()));

DROP POLICY IF EXISTS college_staff_leave_read ON public.college_staff_leave_requests;
CREATE POLICY college_staff_leave_read ON public.college_staff_leave_requests FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','hr']::text[]));
DROP POLICY IF EXISTS college_staff_leave_manage ON public.college_staff_leave_requests;
CREATE POLICY college_staff_leave_manage ON public.college_staff_leave_requests FOR ALL TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','hr']::text[]))
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','hr']::text[]));

DROP POLICY IF EXISTS college_payroll_periods_read ON public.college_payroll_periods;
CREATE POLICY college_payroll_periods_read ON public.college_payroll_periods FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','finance','hr']::text[]));
DROP POLICY IF EXISTS college_payroll_periods_manage ON public.college_payroll_periods;
CREATE POLICY college_payroll_periods_manage ON public.college_payroll_periods FOR ALL TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance','hr']::text[]))
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance','hr']::text[]));

DROP POLICY IF EXISTS college_payroll_entries_read ON public.college_payroll_entries;
CREATE POLICY college_payroll_entries_read ON public.college_payroll_entries FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance','hr']::text[]));
DROP POLICY IF EXISTS college_payroll_entries_manage ON public.college_payroll_entries;
CREATE POLICY college_payroll_entries_manage ON public.college_payroll_entries FOR ALL TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance','hr']::text[]))
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance','hr']::text[]));

DROP POLICY IF EXISTS college_staff_manage ON public.college_staff;
CREATE POLICY college_staff_manage ON public.college_staff FOR ALL TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','hr']::text[]))
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','hr']::text[]));
DROP POLICY IF EXISTS college_staff_read ON public.college_staff;
CREATE POLICY college_staff_read ON public.college_staff FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','registrar','hod','hr']::text[]));

DROP POLICY IF EXISTS college_students_student_own_read ON public.college_students;
CREATE POLICY college_students_student_own_read ON public.college_students FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student'
AND id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true));

DROP POLICY IF EXISTS college_payments_student_own_read ON public.college_payments;
CREATE POLICY college_payments_student_own_read ON public.college_payments FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student'
AND student_id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true));

DROP POLICY IF EXISTS college_fee_charges_student_own_read ON public.college_fee_charges;
CREATE POLICY college_fee_charges_student_own_read ON public.college_fee_charges FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student'
AND student_id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true));

DROP POLICY IF EXISTS college_attendance_student_own_read ON public.college_attendance;
CREATE POLICY college_attendance_student_own_read ON public.college_attendance FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student'
AND student_id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true));

DROP POLICY IF EXISTS college_results_student_own_read ON public.college_results;
CREATE POLICY college_results_student_own_read ON public.college_results FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student'
AND student_id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true));

DROP POLICY IF EXISTS college_assessments_student_own_read ON public.college_assessments;
CREATE POLICY college_assessments_student_own_read ON public.college_assessments FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student' AND EXISTS (
  SELECT 1 FROM public.college_results r WHERE r.assessment_id = college_assessments.id
  AND r.student_id = (SELECT p.student_id FROM public.college_profiles p WHERE p.id = auth.uid() AND p.active = true)
));

DROP POLICY IF EXISTS college_messages_student_read ON public.college_messages;
CREATE POLICY college_messages_student_read ON public.college_messages FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = 'student' AND status = 'sent' AND channel = 'in_app' AND (
  audience = 'all_students'
  OR (audience = 'programme' AND programme_id = (
    SELECT s.programme_id FROM public.college_profiles p
    JOIN public.college_students s ON s.id = p.student_id
    WHERE p.id = auth.uid() AND p.active = true
  ))
  OR (audience = 'individual' AND recipient_profile_id = auth.uid())
));

DROP TRIGGER IF EXISTS college_audit_row_change ON public.college_inventory_items;
CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.college_inventory_items
FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change();
DROP TRIGGER IF EXISTS college_audit_row_change ON public.college_inventory_transactions;
CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.college_inventory_transactions
FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change();
DROP TRIGGER IF EXISTS college_audit_row_change ON public.college_staff_leave_requests;
CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.college_staff_leave_requests
FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change();
DROP TRIGGER IF EXISTS college_audit_row_change ON public.college_payroll_periods;
CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.college_payroll_periods
FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change();
DROP TRIGGER IF EXISTS college_audit_row_change ON public.college_payroll_entries;
CREATE TRIGGER college_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.college_payroll_entries
FOR EACH ROW EXECUTE FUNCTION private.audit_college_row_change();
