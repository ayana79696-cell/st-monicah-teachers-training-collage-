'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';

type Profile = { id: string; full_name: string; role: string; active: boolean };
type Item = { id: string; sku?: string | null; item_name: string; category: string; unit_of_measure: string; quantity_on_hand: number; reorder_level: number; unit_cost_kes: number; storage_location?: string | null; supplier_name?: string | null; active: boolean };
type Move = { id: string; item_id: string; movement_type: string; quantity: number; unit_cost_kes: number; reference_number?: string | null; notes?: string | null; created_at: string };
const crest = 'https://res.cloudinary.com/perlgcll/image/upload/v1792268502/St._Monicah_Teacher_s_College_Crest.png';
const readRoles = ['super_admin','principal','registrar','finance','procurement_officer','ict_admin'];
const manageRoles = ['super_admin','principal','finance','procurement_officer','ict_admin'];
const fieldStyle = { display: 'block', boxSizing: 'border-box' as const, width: '100%', padding: 11, margin: '7px 0 16px', border: '1px solid #d9cbd0', borderRadius: 8, background: '#fff', font: 'inherit' };
function money(n: number) { return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 2 }).format(n || 0); }

export default function InventoryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [sku, setSku] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Stationery');
  const [unit, setUnit] = useState('piece');
  const [reorderLevel, setReorderLevel] = useState('5');
  const [unitCost, setUnitCost] = useState('0');
  const [location, setLocation] = useState('');
  const [supplier, setSupplier] = useState('');
  const [itemId, setItemId] = useState('');
  const [movementType, setMovementType] = useState('stock_in');
  const [quantity, setQuantity] = useState('');
  const [movementCost, setMovementCost] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const db = createClient();
      const { data: { session } } = await db.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const { data: p, error: pError } = await db.from('college_profiles').select('id,full_name,role,active').eq('id', session.user.id).maybeSingle();
      if (pError) throw pError;
      if (!p?.active) { router.replace('/login'); return; }
      if (p.role === 'student') { router.replace('/portal'); return; }
      if (!readRoles.includes(p.role)) { setError('Your role does not have permission to view inventory. Contact the college administrator.'); setProfile(p as Profile); return; }
      setProfile(p as Profile);
      const [itemsResult, moveResult] = await Promise.all([
        db.from('college_inventory_items').select('id,sku,item_name,category,unit_of_measure,quantity_on_hand,reorder_level,unit_cost_kes,storage_location,supplier_name,active').order('item_name').limit(2000),
        db.from('college_inventory_transactions').select('id,item_id,movement_type,quantity,unit_cost_kes,reference_number,notes,created_at').order('created_at', { ascending: false }).limit(300)
      ]);
      if (itemsResult.error) throw itemsResult.error;
      if (moveResult.error) throw moveResult.error;
      const nextItems = (itemsResult.data || []) as Item[];
      setItems(nextItems); setMoves((moveResult.data || []) as Move[]);
      setItemId(current => nextItems.some(i => i.id === current) ? current : nextItems[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load inventory. Check role permissions.');
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const canManage = manageRoles.includes(profile?.role || '');
  const lowStock = items.filter(i => i.active && Number(i.quantity_on_hand) <= Number(i.reorder_level));
  const stockValue = items.reduce((sum, i) => sum + Number(i.quantity_on_hand || 0) * Number(i.unit_cost_kes || 0), 0);
  const visibleItems = useMemo(() => items.filter(i => [i.sku, i.item_name, i.category, i.storage_location, i.supplier_name].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())), [items, search]);
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  async function addItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || !canManage) return;
    if (!itemName.trim()) { setError('Enter an item name.'); return; }
    if (Number(reorderLevel) < 0 || Number(unitCost) < 0) { setError('Reorder level and cost cannot be negative.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: insertError } = await createClient().from('college_inventory_items').insert({
        sku: sku.trim() || null, item_name: itemName.trim(), category, unit_of_measure: unit,
        quantity_on_hand: 0, reorder_level: Number(reorderLevel), unit_cost_kes: Number(unitCost || 0),
        storage_location: location.trim() || null, supplier_name: supplier.trim() || null, created_by: profile.id
      });
      if (insertError) throw insertError;
      setItemName(''); setSku(''); setLocation(''); setSupplier('');
      setNotice('Inventory item created. Use the stock movement form to record opening stock; the stock quantity cannot be edited directly.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create inventory item. Check SKU uniqueness and permissions.'); }
    finally { setSaving(false); }
  }

  async function recordMovement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile || !canManage) return;
    const amount = Number(quantity);
    if (!itemId || !Number.isFinite(amount) || amount === 0 || (movementType !== 'adjustment' && amount < 0)) {
      setError('Select an item and enter a valid quantity. Stock in/out quantities must be positive; an adjustment may be positive or negative.'); return;
    }
    if (Number(movementCost || 0) < 0) { setError('Unit cost cannot be negative.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: insertError } = await createClient().from('college_inventory_transactions').insert({
        item_id: itemId, movement_type: movementType, quantity: amount,
        unit_cost_kes: Number(movementCost || 0), reference_number: reference.trim() || null,
        notes: notes.trim() || null, recorded_by: profile.id
      });
      if (insertError) throw insertError;
      setQuantity(''); setReference(''); setNotes(''); setMovementCost('');
      setNotice('Stock movement saved. The database updated the on-hand quantity and wrote an audit entry atomically.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Stock movement failed. Check the available quantity and role access.'); }
    finally { setSaving(false); }
  }

  async function signOut() { await createClient().auth.signOut(); router.replace('/login'); }

  return <main className="shell">
    <section className="workspace-topbar no-print"><a className="topbar-brand" href="/"><img className="crest-logo" src={crest} alt="St. Monicah crest" /><span><strong>ST. MONICAH</strong><small>TEACHERS TRAINING COLLEGE</small></span></a><ErpNavigation active="people" /><div className="topbar-user"><span>{profile?.full_name || 'College user'}<small>{profile?.role || ''}</small></span><button className="quiet-button" onClick={signOut}>Sign out</button></div></section>
    <section className="content inventory-content">
      <header className="workspace-record-header no-print"><div><p className="eyebrow">OPERATIONS / ASSET CONTROL</p><h1>Inventory &amp; stock</h1><p className="muted">Manage stock items, record receipts/issues and identify items that need reordering.</p></div><div className="toolbar"><button className="secondary-button" onClick={() => void load()} disabled={loading}>Refresh</button><button className="secondary-button" onClick={() => window.print()}>Print register</button></div></header>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      {profile && <div className="inventory-kpis"><article><span>Active stock items</span><strong>{items.filter(i => i.active).length}</strong></article><article><span>Items at reorder level</span><strong>{lowStock.length}</strong></article><article><span>Approx. stock value</span><strong>{money(stockValue)}</strong></article><article><span>Recent movements</span><strong>{moves.length}</strong></article></div>}
      {canManage && <div className="inventory-forms no-print">
        <form className="record-form" onSubmit={addItem}><h2>Add stock item</h2><p className="muted">New items start at zero. Record the opening quantity with a stock-in movement.</p><div className="form-grid">
          <label>Item name<input style={fieldStyle} value={itemName} onChange={e => setItemName(e.target.value)} required maxLength={180} /></label>
          <label>SKU / item code<input style={fieldStyle} value={sku} onChange={e => setSku(e.target.value)} maxLength={80} /></label>
          <label>Category<select style={fieldStyle} value={category} onChange={e => setCategory(e.target.value)}><option>Stationery</option><option>ICT equipment</option><option>Teaching materials</option><option>Cleaning supplies</option><option>Furniture</option><option>Laboratory</option><option>Maintenance</option><option>Kitchen</option><option>Other</option></select></label>
          <label>Unit of measure<input style={fieldStyle} value={unit} onChange={e => setUnit(e.target.value)} required maxLength={40} placeholder="piece, box, ream…" /></label>
          <label>Reorder level<input style={fieldStyle} type="number" value={reorderLevel} onChange={e => setReorderLevel(e.target.value)} min="0" step="0.01" required /></label>
          <label>Unit cost (KES)<input style={fieldStyle} type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} min="0" step="0.01" required /></label>
          <label>Storage location<input style={fieldStyle} value={location} onChange={e => setLocation(e.target.value)} maxLength={140} placeholder="Store room / cabinet" /></label>
          <label>Supplier<input style={fieldStyle} value={supplier} onChange={e => setSupplier(e.target.value)} maxLength={180} /></label>
        </div><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Create stock item'}</button></form>
        <form className="record-form" onSubmit={recordMovement}><h2>Record stock movement</h2><p className="muted">Receipts, issues and adjustments are recorded in an append-only ledger.</p><div className="form-grid">
          <label>Inventory item<select style={fieldStyle} value={itemId} onChange={e => setItemId(e.target.value)} required><option value="">Choose item</option>{items.filter(i => i.active).map(i => <option key={i.id} value={i.id}>{i.item_name} · on hand: {i.quantity_on_hand} {i.unit_of_measure}</option>)}</select></label>
          <label>Movement type<select style={fieldStyle} value={movementType} onChange={e => setMovementType(e.target.value)}><option value="stock_in">Stock received (+)</option><option value="stock_out">Stock issued (−)</option><option value="adjustment">Stock adjustment (+/−)</option></select></label>
          <label>Quantity<input style={fieldStyle} type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} required placeholder={movementType === 'adjustment' ? 'e.g. -2 or 5' : 'Positive quantity'} /></label>
          <label>Unit cost (KES)<input style={fieldStyle} type="number" min="0" step="0.01" value={movementCost} onChange={e => setMovementCost(e.target.value)} placeholder="Optional updated cost" /></label>
          <label>Reference<input style={fieldStyle} value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="LPO, delivery note, issue slip…" /></label>
          <label>Notes<input style={fieldStyle} value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} /></label>
        </div><button className="primary-button" disabled={saving || !items.length}>{saving ? 'Saving…' : 'Save stock movement'}</button></form>
      </div>}
      {lowStock.length > 0 && <div className="reports-note"><strong>Reorder attention needed:</strong> {lowStock.length} active item(s) are at or below their minimum stock level.</div>}
      <section className="section-head"><div><h2>Stock register</h2><p className="muted">{visibleItems.length} item records</p></div><input className="search-input no-print" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, SKU, category…" /></section>
      {loading ? <p className="empty-state">Loading inventory…</p> : <div className="table-wrap"><table className="records-table"><thead><tr><th>Code / item</th><th>Category</th><th>On hand</th><th>Reorder at</th><th>Unit cost</th><th>Location / supplier</th><th>Status</th></tr></thead><tbody>{visibleItems.map(i => <tr key={i.id} className={i.active && Number(i.quantity_on_hand) <= Number(i.reorder_level) ? 'stock-low' : ''}><td><strong>{i.item_name}</strong><small className="muted" style={{display:'block'}}>{i.sku || 'No SKU'}</small></td><td>{i.category}</td><td><strong>{i.quantity_on_hand}</strong> {i.unit_of_measure}</td><td>{i.reorder_level}</td><td>{money(Number(i.unit_cost_kes))}</td><td>{i.storage_location || '—'}<small className="muted" style={{display:'block'}}>{i.supplier_name || ''}</small></td><td>{i.active ? 'Active' : 'Inactive'}</td></tr>)}{visibleItems.length === 0 && <tr><td colSpan={7}>No stock items match this search.</td></tr>}</tbody></table></div>}
      <section className="section-head"><div><h2>Recent stock movement ledger</h2><p className="muted">Latest {moves.length} stock changes (quantities and references retained).</p></div></section>
      {loading ? <p className="empty-state">Loading stock movements…</p> : <div className="table-wrap"><table className="records-table"><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th>Quantity</th><th>Reference</th><th>Notes</th></tr></thead><tbody>{moves.map(m => <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('en-KE', {timeZone:'Africa/Nairobi'})}</td><td>{itemMap.get(m.item_id)?.item_name || 'Item'}</td><td>{m.movement_type.replaceAll('_', ' ')}</td><td>{m.quantity} {itemMap.get(m.item_id)?.unit_of_measure || ''}</td><td>{m.reference_number || '—'}</td><td>{m.notes || '—'}</td></tr>)}{moves.length === 0 && <tr><td colSpan={6}>No stock movements have been recorded yet.</td></tr>}</tbody></table></div>}
      <footer><span>ST. MONICAH · COLLEGE OPERATIONS</span><span>Stock movements are ledgered and audited; negative stock is blocked by the database.</span></footer>
    </section>
  </main>;
}
