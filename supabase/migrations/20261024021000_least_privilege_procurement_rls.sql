-- Least-privilege permissions for each procurement sub-workflow.
do $$ begin
  -- Existing generic policies are removed before specific role policies are installed.
  drop policy if exists college_suppliers_manage on public.college_suppliers;
  drop policy if exists college_purchase_orders_manage on public.college_purchase_orders;
  drop policy if exists college_purchase_order_lines_manage on public.college_purchase_order_lines;
  drop policy if exists college_procurement_approvals_manage on public.college_procurement_approvals;
  drop policy if exists college_deliveries_manage on public.college_deliveries;
  drop policy if exists college_delivery_lines_manage on public.college_delivery_lines;
  drop policy if exists college_supplier_invoices_manage on public.college_supplier_invoices;
  drop policy if exists college_inventory_alerts_manage on public.college_inventory_alerts;
end $$;
create policy college_suppliers_manage on public.college_suppliers for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]));
create policy college_purchase_orders_manage on public.college_purchase_orders for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]));
create policy college_purchase_order_lines_manage on public.college_purchase_order_lines for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]));
create policy college_procurement_approvals_manage on public.college_procurement_approvals for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]));
create policy college_deliveries_manage on public.college_deliveries for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','procurement_officer','storekeeper','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','procurement_officer','storekeeper','ict_admin']::text[]));
create policy college_delivery_lines_manage on public.college_delivery_lines for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','procurement_officer','storekeeper','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','procurement_officer','storekeeper','ict_admin']::text[]));
create policy college_supplier_invoices_manage on public.college_supplier_invoices for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','ict_admin']::text[]));
create policy college_inventory_alerts_manage on public.college_inventory_alerts for all to authenticated
using ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','storekeeper','ict_admin']::text[]))
with check ((select private.current_college_role()) = any(array['super_admin','principal','finance','procurement_officer','storekeeper','ict_admin']::text[]));
