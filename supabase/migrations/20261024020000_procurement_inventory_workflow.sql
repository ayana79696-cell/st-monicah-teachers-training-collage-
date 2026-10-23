-- Storekeeper may read stock and post stock-in only through receiving; cannot create/edit inventory items.
drop policy if exists college_inventory_items_read on public.college_inventory_items;
create policy college_inventory_items_read on public.college_inventory_items for select to authenticated
using ((select private.current_college_role()) = any (array['super_admin','principal','registrar','finance','procurement_officer','storekeeper','ict_admin']::text[]));
drop policy if exists college_inventory_transactions_read on public.college_inventory_transactions;
create policy college_inventory_transactions_read on public.college_inventory_transactions for select to authenticated
using ((select private.current_college_role()) = any (array['super_admin','principal','registrar','finance','procurement_officer','storekeeper','ict_admin']::text[]));
drop policy if exists college_inventory_transactions_insert on public.college_inventory_transactions;
create policy college_inventory_transactions_insert on public.college_inventory_transactions for insert to authenticated
with check (
 ((select private.current_college_role()) = any (array['super_admin','principal','finance','procurement_officer','ict_admin']::text[]) and (recorded_by is null or recorded_by=auth.uid()))
 or ((select private.current_college_role())='storekeeper' and movement_type='stock_in' and (recorded_by is null or recorded_by=auth.uid()))
);
