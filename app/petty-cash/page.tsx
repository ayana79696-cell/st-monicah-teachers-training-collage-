'use client';

import ErpNavigation from '@/components/ErpNavigation';
import { createClient } from '@/lib/supabase/client';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Account={id:string;name:string;opening_balance_kes:number;active:boolean};
type Tx={id:string;account_id:string;voucher_no:string;transaction_date:string;transaction_type:'money_in'|'money_out';description:string;amount_kes:number;category:string;department:string|null;paid_to:string|null;received_by:string|null;supplier_name:string|null;requisition_no:string|null;lpo_no:string|null;invoice_receipt_no:string|null;payment_method:string;transaction_reference:string|null;notes:string|null;balance_before_kes:number;balance_after_kes:number;created_at:string};
const money=(n:number)=>new Intl.NumberFormat('en-KE',{style:'currency',currency:'KES',minimumFractionDigits:2}).format(Number(n||0));
const today=()=>new Date().toLocaleDateString('en-CA');
const initialForm={transaction_date:today(),transaction_type:'money_out',description:'',amount_kes:'',category:'General',department:'',paid_to:'',received_by:'',supplier_name:'',requisition_no:'',lpo_no:'',invoice_receipt_no:'',payment_method:'cash',transaction_reference:'',notes:''};
export default function PettyCashPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [accountId,setAccountId]=useState('');
 const [transactions,setTransactions]=useState<Tx[]>([]);
 const [form,setForm]=useState(initialForm);
 const [accountName,setAccountName]=useState('Main Petty Cash');
 const [openingBalance,setOpeningBalance]=useState('0');
 const [showAccountForm,setShowAccountForm]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [fromDate,setFromDate]=useState('');
 const [toDate,setToDate]=useState('');
 const [week,setWeek]=useState('all');
 const [userName,setUserName]=useState('');
 const [manualAmount,setManualAmount]=useState('');
 const [manualDate,setManualDate]=useState(today());
 const [manualDescription,setManualDescription]=useState('Cash added manually');
 const [manualSource,setManualSource]=useState('');
 const [manualReceivedBy,setManualReceivedBy]=useState('');
 const [manualNotes,setManualNotes]=useState('');
 const [authorized,setAuthorized]=useState(false);

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:{user},error:userError}=await supabase.auth.getUser();
   if(userError||!user)throw new Error('Please sign in to access petty cash.');
   const {data:profile,error:profileError}=await supabase.from('college_profiles').select('full_name,role,active').eq('id',user.id).maybeSingle();
   if(profileError)throw profileError;
   if(!profile?.active||!['super_admin','principal','finance'].includes(profile.role))throw new Error('Access restricted to authorized finance users, the principal, and super admin.');
   setAuthorized(true);setUserName(profile.full_name||user.email||'Finance user');
   const {data:accountRows,error:accountError}=await supabase.from('college_petty_cash_accounts').select('id,name,opening_balance_kes,active').eq('active',true).order('created_at');
   if(accountError)throw accountError;
   let list=(accountRows||[]) as Account[];
   if(!list.length){
    const {data:newAccount,error:createError}=await supabase.rpc('college_create_petty_cash_account',{p_name:'Main Petty Cash',p_opening_balance_kes:0});
    if(createError)throw createError;
    if(newAccount){list=[newAccount as Account];}
   }
   setAccounts(list);
   const chosen=list.some(a=>a.id===accountId)?accountId:(list[0]?.id||'');
   setAccountId(chosen);
   if(chosen){
    const {data:rows,error:txError}=await supabase.from('college_petty_cash_transactions').select('*').eq('account_id',chosen).order('transaction_date',{ascending:false}).order('created_at',{ascending:false}).limit(1500);
    if(txError)throw txError;
    setTransactions((rows||[]) as Tx[]);
   }else setTransactions([]);
  }catch(e:any){setError(e?.message||'Could not load petty cash.');}
  finally{setLoading(false);}
 },[supabase,accountId]);

 useEffect(()=>{void load();},[load]);
 const selectedAccount=accounts.find(a=>a.id===accountId);
 const liveBalance=transactions.length?Number(transactions.reduce((latest,tx)=>!latest||new Date(tx.created_at)>new Date(latest.created_at)?tx:latest,transactions[0]).balance_after_kes):Number(selectedAccount?.opening_balance_kes||0);
 const filtered=useMemo(()=>transactions.filter(tx=>{
  const hay=[tx.voucher_no,tx.description,tx.category,tx.paid_to,tx.received_by,tx.supplier_name,tx.requisition_no,tx.lpo_no,tx.invoice_receipt_no,tx.transaction_reference,tx.department].filter(Boolean).join(' ').toLowerCase();
  if(search&&!hay.includes(search.toLowerCase()))return false;
  if(fromDate&&tx.transaction_date<fromDate)return false;
  if(toDate&&tx.transaction_date>toDate)return false;
  if(week!=='all'){
   const day=new Date(tx.transaction_date+'T12:00:00').getDate();
   const wanted=Number(week);
   if(Math.ceil(day/7)!==wanted)return false;
  }
  return true;
 }),[transactions,search,fromDate,toDate,week]);
 const moneyIn=filtered.filter(t=>t.transaction_type==='money_in').reduce((s,t)=>s+Number(t.amount_kes),0);
 const moneyOut=filtered.filter(t=>t.transaction_type==='money_out').reduce((s,t)=>s+Number(t.amount_kes),0);

 async function submit(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!accountId){setError('Create or select a petty-cash account first.');return;}
  if(!form.description.trim()){setError('Enter a clear transaction description.');return;}
  if(!(Number(form.amount_kes)>0)){setError('Amount must be greater than zero.');return;}
  if(form.transaction_type==='money_out'&&!form.received_by.trim()){setError('Enter the name of the person receiving the cash.');return;}
  if(form.payment_method!=='cash'&&!form.transaction_reference.trim()){setError('Enter the M-Pesa, bank, or cheque reference.');return;}
  setSaving(true);
  try{
   const {data,error:rpcError}=await supabase.rpc('college_record_petty_cash_transaction',{
    p_account_id:accountId,p_transaction_date:form.transaction_date,p_transaction_type:form.transaction_type,
    p_description:form.description.trim(),p_amount_kes:Number(form.amount_kes),p_category:form.category,
    p_department:form.department||null,p_paid_to:form.paid_to||null,p_received_by:form.received_by||null,
    p_supplier_name:form.supplier_name||null,p_requisition_no:form.requisition_no||null,p_lpo_no:form.lpo_no||null,
    p_invoice_receipt_no:form.invoice_receipt_no||null,p_payment_method:form.payment_method,
    p_transaction_reference:form.transaction_reference||null,p_notes:form.notes||null
   });
   if(rpcError)throw rpcError;
   setNotice('Transaction saved successfully. Voucher: '+(data as Tx).voucher_no);
   setForm({...initialForm,transaction_date:today(),transaction_type:form.transaction_type});
   await load();
  }catch(e:any){setError(e?.message||'The transaction could not be saved.');}
  finally{setSaving(false);}
 }
 async function addMoneyManually(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!accountId){setError('Select a petty-cash account first.');return;}
  if(!(Number(manualAmount)>0)){setError('Enter an amount greater than zero.');return;}
  if(!manualDescription.trim()){setError('Enter where the money came from or why it was added.');return;}
  setSaving(true);
  try{
   const {data,error:rpcError}=await supabase.rpc('college_record_petty_cash_transaction',{
    p_account_id:accountId,p_transaction_date:manualDate,p_transaction_type:'money_in',
    p_description:manualDescription.trim(),p_amount_kes:Number(manualAmount),p_category:'Cash Replenishment',
    p_department:null,p_paid_to:manualSource.trim()||null,p_received_by:manualReceivedBy.trim()||null,
    p_supplier_name:null,p_requisition_no:null,p_lpo_no:null,p_invoice_receipt_no:null,
    p_payment_method:'cash',p_transaction_reference:null,p_notes:manualNotes.trim()||'Manually added to petty cash'
   });
   if(rpcError)throw rpcError;
   setNotice('Money added successfully. Voucher: '+(data as Tx).voucher_no);
   setManualAmount('');setManualDescription('');setManualSource('');setManualNotes('');
   await load();
  }catch(e:any){setError(e?.message||'Could not add money to petty cash.');}
  finally{setSaving(false);}
 }
 async function createAccount(e:FormEvent){
  e.preventDefault();setError('');setNotice('');
  if(!accountName.trim()){setError('Enter an account name.');return;}
  if(Number(openingBalance)<0||!Number.isFinite(Number(openingBalance))){setError('Opening balance must be zero or more.');return;}
  setSaving(true);
  try{
   const {data,error:rpcError}=await supabase.rpc('college_create_petty_cash_account',{p_name:accountName.trim(),p_opening_balance_kes:Number(openingBalance)});
   if(rpcError)throw rpcError;
   const created=data as Account;
   setShowAccountForm(false);setNotice('Petty-cash account created.');
   await load();if(created?.id)setAccountId(created.id);
  }catch(e:any){setError(e?.message||'Could not create account.');}
  finally{setSaving(false);}
 }
 function printReport(){
  const w=window.open('','_blank','width=1000,height=800');
  if(!w){setError('Allow pop-ups to print the report.');return;}
  const rows=filtered.map(t=>'<tr><td>'+esc(t.transaction_date)+'</td><td>'+esc(t.voucher_no)+'</td><td>'+esc(t.transaction_type==='money_in'?'Money In':'Money Out')+'</td><td>'+esc(t.description)+'</td><td>'+esc(t.paid_to||t.received_by||'—')+'</td><td>'+esc(t.payment_method.toUpperCase())+'</td><td class="num">'+money(Number(t.amount_kes))+'</td><td class="num">'+money(Number(t.balance_after_kes))+'</td></tr>').join('');
  w.document.write('<!doctype html><html><head><title>St. Monicah Petty Cash Report</title><style>body{font:12px Arial;color:#222;padding:24px}h1{color:#641c35;font-size:22px;margin-bottom:4px}.meta{color:#666;margin-bottom:18px}.totals{display:flex;gap:22px;margin:16px 0;font-weight:bold}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#f4edf0;color:#641c35}.num{text-align:right}.sign{display:flex;justify-content:space-between;margin-top:55px}.sign div{width:28%;border-top:1px solid #555;padding-top:8px}</style></head><body><h1>St. Monicah Teachers Training College</h1><h2>Petty Cash Statement — '+esc(selectedAccount?.name||'')+'</h2><div class="meta">Printed '+new Date().toLocaleString()+' · Period '+esc(fromDate||'start')+' to '+esc(toDate||'today')+' · Prepared by '+esc(userName)+'</div><div class="totals"><span>Money in: '+money(moneyIn)+'</span><span>Money out: '+money(moneyOut)+'</span><span>Current balance: '+money(liveBalance)+'</span></div><table><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Description</th><th>Paid to / Received by</th><th>Method</th><th>Amount (KES)</th><th>Balance (KES)</th></tr></thead><tbody>'+rows+'</tbody></table><div class="sign"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></div><script>window.onload=()=>window.print()<\/script></body></html>');
  w.document.close();
 }
 function esc(value:any){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}

 return <main className="content">
  <ErpNavigation active="finance"/>
  <header><div><p className="eyebrow">FINANCE / CASH CONTROL</p><h1>Petty Cash</h1><p className="muted">Track cash received and spent, vouchers, supporting references and a live balance.</p></div><div className="toolbar"><button className="secondary-button" onClick={()=>setShowAccountForm(v=>!v)}>Manage account</button><button className="secondary-button" onClick={()=>void load()}>Refresh</button><button className="primary-button" onClick={printReport}>Print statement</button></div></header>
  {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
  {showAccountForm&&<form className="record-form" onSubmit={createAccount}><h2>Create petty-cash account</h2><div className="form-grid"><label>Account name<input value={accountName} onChange={e=>setAccountName(e.target.value)} required maxLength={80}/></label><label>Opening balance (KES)<input type="number" min="0" step="0.01" value={openingBalance} onChange={e=>setOpeningBalance(e.target.value)} required/></label></div><div className="toolbar"><button className="primary-button" disabled={saving}>{saving?'Saving…':'Create account'}</button><button type="button" className="secondary-button" onClick={()=>setShowAccountForm(false)}>Cancel</button></div></form>}
  <section className="module-grid" style={{marginBottom:22}}>
   <article className="module"><div className="module-top"><span className="module-icon">KES</span><span className="arrow">01</span></div><h3>Available balance</h3><p style={{fontSize:20,fontWeight:800,color:'#641c35'}}>{money(liveBalance)}</p><p>{selectedAccount?.name||'Select an account'}</p></article>
   <article className="module"><div className="module-top"><span className="module-icon">IN</span><span className="arrow">02</span></div><h3>Money received · filtered period</h3><p style={{fontSize:20,fontWeight:800,color:'#24613b'}}>{money(moneyIn)}</p><p>{filtered.filter(t=>t.transaction_type==='money_in').length} entries</p></article>
   <article className="module"><div className="module-top"><span className="module-icon">OUT</span><span className="arrow">03</span></div><h3>Money spent · filtered period</h3><p style={{fontSize:20,fontWeight:800,color:'#a12c43'}}>{money(moneyOut)}</p><p>{filtered.filter(t=>t.transaction_type==='money_out').length} entries</p></article>
  </section>
  <section className="record-form" style={{border:'2px solid #d7b45a',marginBottom:22}}>
   <div className="section-head" style={{marginTop:0}}><div><h2>Add Money Manually</h2><p className="muted">Enter cash received or funds you are adding to petty cash. This records a money-in voucher and updates the balance automatically.</p></div></div>
   <form onSubmit={addMoneyManually}>
    <div className="form-grid">
     <label>Petty-cash account<select value={accountId} onChange={e=>setAccountId(e.target.value)} required>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
     <label>Date<input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)} required/></label>
     <label>Amount to add (KES)<input type="number" min="0.01" step="0.01" value={manualAmount} onChange={e=>setManualAmount(e.target.value)} required placeholder="Enter amount"/></label>
     <label>Source / received from<input value={manualSource} onChange={e=>setManualSource(e.target.value)} placeholder="e.g. Bursar, bank withdrawal, refund"/></label>
     <label>Description / reason<input value={manualDescription} onChange={e=>setManualDescription(e.target.value)} onFocus={()=>{if(manualDescription==='Cash added manually')setManualDescription('');}} required maxLength={500} placeholder="Why is money being added?"/></label>
     <label>Recorded by<input value={manualReceivedBy} onChange={e=>setManualReceivedBy(e.target.value)} placeholder="Your name (optional)"/></label>
     <label>Notes<input value={manualNotes} onChange={e=>setManualNotes(e.target.value)} placeholder="Optional notes"/></label>
    </div>
    <div className="toolbar"><button className="primary-button" disabled={saving||loading}>{saving?'Adding money…':'Add money to petty cash'}</button></div>
   </form>
  </section>
  <section className="record-form"><div className="section-head" style={{marginTop:0}}><div><h2>Record transaction</h2><p className="muted">Voucher numbers and balances are generated by the database.</p></div></div>
   <form onSubmit={submit}>
    <div className="form-grid">
     <label>Petty-cash account<select value={accountId} onChange={e=>setAccountId(e.target.value)} required>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · Opening {money(Number(a.opening_balance_kes))}</option>)}</select></label>
     <label>Transaction type<select value={form.transaction_type} onChange={e=>setForm({...form,transaction_type:e.target.value})}><option value="money_out">Money Out — Expense</option><option value="money_in">Money In — Replenishment / Refund</option></select></label>
     <label>Date<input type="date" value={form.transaction_date} onChange={e=>setForm({...form,transaction_date:e.target.value})} required/></label>
     <label>Amount (KES)<input type="number" min="0.01" step="0.01" value={form.amount_kes} onChange={e=>setForm({...form,amount_kes:e.target.value})} required placeholder="0.00"/></label>
     <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['General','Transport','Fuel','Repairs & Maintenance','Stationery','Kitchen & Food','Cleaning','Utilities','Teaching Materials','Medical','Postage & Communication','Staff Welfare','Reimbursement','Cash Replenishment','Other'].map(v=><option key={v}>{v}</option>)}</select></label>
     <label>Department<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})} placeholder="e.g. Administration"/></label>
     <label>Description<input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required maxLength={500} placeholder="What is the transaction for?"/></label>
     <label>{form.transaction_type==='money_out'?'Paid to':'Source / paid by'}<input value={form.paid_to} onChange={e=>setForm({...form,paid_to:e.target.value})} placeholder="Person or organization"/></label>
     <label>{form.transaction_type==='money_out'?'Received by':'Recorded / received by'}<input value={form.received_by} onChange={e=>setForm({...form,received_by:e.target.value})} required={form.transaction_type==='money_out'} placeholder="Full name"/></label>
     <label>Supplier name<input value={form.supplier_name} onChange={e=>setForm({...form,supplier_name:e.target.value})}/></label>
     <label>Payment method<select value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>{[['cash','Cash'],['mpesa','M-Pesa'],['bank','Bank transfer'],['cheque','Cheque']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
     <label>{form.payment_method==='mpesa'?'M-Pesa transaction code':form.payment_method==='cheque'?'Cheque number':form.payment_method==='bank'?'Bank reference':'Payment reference'}<input value={form.transaction_reference} onChange={e=>setForm({...form,transaction_reference:e.target.value})} required={form.payment_method!=='cash'} placeholder={form.payment_method==='cash'?'Optional': 'Enter reference'}/></label>
     <label>Requisition number<input value={form.requisition_no} onChange={e=>setForm({...form,requisition_no:e.target.value})}/></label>
     <label>LPO / purchase order number<input value={form.lpo_no} onChange={e=>setForm({...form,lpo_no:e.target.value})}/></label>
     <label>Invoice / receipt number<input value={form.invoice_receipt_no} onChange={e=>setForm({...form,invoice_receipt_no:e.target.value})}/></label>
     <label>Notes<input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} maxLength={1000}/></label>
    </div>
    <div className="toolbar"><button className="primary-button" disabled={saving||loading}>{saving?'Saving transaction…':'Save transaction & generate voucher'}</button><button type="button" className="secondary-button" onClick={()=>setForm({...initialForm,transaction_date:today()})}>Clear form</button></div>
   </form>
  </section>
  <section>
   <div className="section-head"><div><h2>Transaction register</h2><p className="muted">Search vouchers, filter by date/week, and print the current view.</p></div><span className="count">{filtered.length} RECORDS</span></div>
   <div className="toolbar" style={{marginBottom:14}}><select className="search-input" value={accountId} onChange={e=>setAccountId(e.target.value)} aria-label="Account">{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><input className="search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search voucher, supplier, description…"/><label className="muted">From <input className="search-input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label className="muted">To <input className="search-input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label><select className="search-input" value={week} onChange={e=>setWeek(e.target.value)} aria-label="Week of month"><option value="all">All weeks</option><option value="1">Week 1 (days 1–7)</option><option value="2">Week 2 (days 8–14)</option><option value="3">Week 3 (days 15–21)</option><option value="4">Week 4 (days 22–28)</option><option value="5">Week 5 (days 29–31)</option></select></div>
   {loading?<div className="empty-state">Loading petty-cash records…</div>:!authorized?<div className="empty-state">Sign in with an authorized finance account to view this module.</div>:filtered.length===0?<div className="empty-state">No transactions match this filter. Clear the date/week filters or record your first transaction.</div>:<div className="table-wrap"><table className="records-table"><thead><tr><th>Date</th><th>Voucher</th><th>Type</th><th>Description / Category</th><th>Paid to / Received by</th><th>Method / Ref</th><th>Amount</th><th>Balance after</th><th>Support refs</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td>{t.transaction_date}</td><td><strong>{t.voucher_no}</strong></td><td><span className="count">{t.transaction_type==='money_in'?'MONEY IN':'MONEY OUT'}</span></td><td><strong>{t.description}</strong><br/><span className="muted">{t.category}{t.department?' · '+t.department:''}</span></td><td>{t.paid_to||'—'}<br/><span className="muted">Received by: {t.received_by||'—'}</span></td><td>{t.payment_method.toUpperCase()}<br/><span className="muted">{t.transaction_reference||'No reference'}</span></td><td style={{color:t.transaction_type==='money_in'?'#24613b':'#a12c43',fontWeight:800}}>{t.transaction_type==='money_in'?'+':'−'}{money(Number(t.amount_kes))}</td><td>{money(Number(t.balance_after_kes))}</td><td><span className="muted">{[t.requisition_no,t.lpo_no,t.invoice_receipt_no,t.supplier_name].filter(Boolean).join(' · ')||'—'}</span></td></tr>)}</tbody></table></div>}
  </section>
  <p className="muted" style={{marginTop:24}}>Signed in as {userName||'—'}. All amounts are in Kenyan shillings (KES). Transaction records are retained in the database.</p>
 </main>;
}
