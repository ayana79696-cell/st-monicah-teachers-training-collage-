-- Supplier payments for procurement invoices, with auditable voucher references.
CREATE TABLE IF NOT EXISTS public.college_supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text NOT NULL UNIQUE,
  invoice_id uuid NOT NULL REFERENCES public.college_supplier_invoices(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES public.college_suppliers(id) ON DELETE RESTRICT,
  amount_kes numeric(12,2) NOT NULL CHECK (amount_kes > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa','bank','cash','cheque','other')),
  bank_name text,
  payment_reference text,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES public.college_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS college_supplier_payments_invoice_idx ON public.college_supplier_payments(invoice_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS college_supplier_payments_date_idx ON public.college_supplier_payments(paid_at DESC);
ALTER TABLE public.college_supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS college_supplier_payments_read ON public.college_supplier_payments;
CREATE POLICY college_supplier_payments_read ON public.college_supplier_payments FOR SELECT TO authenticated
USING ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','principal','finance','procurement_officer']::text[]));
DROP POLICY IF EXISTS college_supplier_payments_insert ON public.college_supplier_payments;
CREATE POLICY college_supplier_payments_insert ON public.college_supplier_payments FOR INSERT TO authenticated
WITH CHECK ((SELECT private.current_college_role()) = ANY (ARRAY['super_admin','finance']::text[]) AND (recorded_by IS NULL OR recorded_by = auth.uid()));
