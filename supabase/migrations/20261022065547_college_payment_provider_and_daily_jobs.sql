-- Private callback tokens are stored as one-way hashes only. Provider secrets stay in Vercel.
create table if not exists public.college_private_integration_secrets(
 secret_name text primary key, token_hash text not null, updated_at timestamptz not null default now()
);
alter table public.college_private_integration_secrets enable row level security;
revoke all on public.college_private_integration_secrets from public,anon,authenticated;

create table if not exists public.college_payment_intents(
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.college_students(id) on delete restrict,
 requested_amount_kes numeric(12,2) not null check(requested_amount_kes>0 and requested_amount_kes=trunc(requested_amount_kes)),
 phone_number text not null check(phone_number ~ '^\+?254[0-9]{9}$'),
 account_reference text not null,
 transaction_description text not null default 'College fees',
 status text not null default 'initiated' check(status in ('initiated','pending','paid','failed','callback_error')),
 checkout_request_id text unique,merchant_request_id text,result_code integer,result_description text,mpesa_receipt_number text unique,
 provider_request jsonb,provider_callback jsonb,
 created_by uuid references public.college_profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz
);
create index if not exists college_payment_intents_student_date_idx on public.college_payment_intents(student_id,created_at desc);
create index if not exists college_payment_intents_status_date_idx on public.college_payment_intents(status,created_at desc);
alter table public.college_payment_intents enable row level security;
drop policy if exists payment_intents_read_scoped on public.college_payment_intents;
create policy payment_intents_read_scoped on public.college_payment_intents for select to authenticated using(
 public.college_blueprint_has_role(array['super_admin','principal','finance'])
 or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_payment_intents.student_id)
);
drop policy if exists payment_intents_insert_own on public.college_payment_intents;
create policy payment_intents_insert_own on public.college_payment_intents for insert to authenticated with check(
 status='initiated' and created_by=auth.uid()
 and (public.college_blueprint_has_role(array['super_admin','principal','finance']) or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_payment_intents.student_id))
);
drop policy if exists payment_intents_update_pending on public.college_payment_intents;
create policy payment_intents_update_pending on public.college_payment_intents for update to authenticated using(
 created_by=auth.uid() and status='initiated'
 and (public.college_blueprint_has_role(array['super_admin','principal','finance']) or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_payment_intents.student_id))
) with check(
 created_by=auth.uid() and status in ('initiated','pending','failed')
 and (public.college_blueprint_has_role(array['super_admin','principal','finance']) or exists(select 1 from public.college_profiles p where p.id=auth.uid() and p.active and p.role='student' and p.student_id=college_payment_intents.student_id))
);
grant select,insert,update on public.college_payment_intents to authenticated;

create table if not exists public.college_message_deliveries(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.college_messages(id) on delete cascade,
 recipient_profile_id uuid references public.college_profiles(id) on delete set null,
 recipient_name text,destination text not null,
 channel text not null check(channel in ('sms','email')),
 status text not null default 'queued' check(status in ('queued','submitted','delivered','failed','rejected','bounced')),
 provider text,provider_message_id text,provider_status text,error_message text,
 submitted_at timestamptz,delivered_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists college_message_deliveries_message_idx on public.college_message_deliveries(message_id,created_at desc);
create index if not exists college_message_deliveries_status_idx on public.college_message_deliveries(status,created_at desc);
alter table public.college_message_deliveries enable row level security;
drop policy if exists message_deliveries_staff_manage on public.college_message_deliveries;
create policy message_deliveries_staff_manage on public.college_message_deliveries for all to authenticated using(public.college_blueprint_has_role(array['super_admin','principal','registrar'])) with check(public.college_blueprint_has_role(array['super_admin','principal','registrar']));
grant select,insert,update,delete on public.college_message_deliveries to authenticated;

create or replace function public.college_apply_mpesa_callback(
 p_token text,p_checkout_request_id text,p_merchant_request_id text,p_result_code integer,p_result_description text,p_receipt_number text,p_amount numeric,p_phone text,p_transaction_date text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions
as $fn$
declare secret_hash text; intent public.college_payment_intents%rowtype; receipt_time timestamptz; existing public.college_payments%rowtype;
begin
 select token_hash into secret_hash from public.college_private_integration_secrets where secret_name='mpesa_callback';
 if secret_hash is null or p_token is null or encode(digest(p_token,'sha256'),'hex')<>secret_hash then raise exception 'Invalid M-Pesa callback authorization'; end if;
 if nullif(trim(p_checkout_request_id),'') is null then raise exception 'Missing checkout request identifier'; end if;
 select * into intent from public.college_payment_intents where checkout_request_id=p_checkout_request_id for update;
 if not found then raise exception 'M-Pesa checkout request was not found'; end if;
 if intent.status='paid' then return jsonb_build_object('accepted',true,'duplicate',true,'status','paid'); end if;
 if p_result_code is distinct from 0 then
  update public.college_payment_intents set status='failed',result_code=p_result_code,result_description=left(coalesce(p_result_description,'Provider reported payment failure'),1000),provider_callback=p_payload,updated_at=now(),completed_at=now(),merchant_request_id=coalesce(p_merchant_request_id,merchant_request_id) where id=intent.id;
  return jsonb_build_object('accepted',true,'status','failed');
 end if;
 if nullif(trim(p_receipt_number),'') is null then raise exception 'Successful callback missing M-Pesa receipt number'; end if;
 if p_amount is null or abs(p_amount-intent.requested_amount_kes)>0.01 then
  update public.college_payment_intents set status='callback_error',result_code=p_result_code,result_description='Callback amount does not match requested amount; manual reconciliation required',provider_callback=p_payload,updated_at=now() where id=intent.id;
  return jsonb_build_object('accepted',false,'status','callback_error');
 end if;
 if nullif(trim(p_phone),'') is not null and regexp_replace(p_phone,'\D','','g')<>regexp_replace(intent.phone_number,'\D','','g') then
  update public.college_payment_intents set status='callback_error',result_code=p_result_code,result_description='Callback phone does not match requested phone; manual reconciliation required',provider_callback=p_payload,updated_at=now() where id=intent.id;
  return jsonb_build_object('accepted',false,'status','callback_error');
 end if;
 select * into existing from public.college_payments where lower(trim(reference_number))=lower(trim(p_receipt_number)) limit 1;
 if found then
  if existing.student_id=intent.student_id and abs(existing.amount_kes-intent.requested_amount_kes)<=0.01 then
   update public.college_payment_intents set status='paid',result_code=0,result_description='Receipt was already recorded against this student and amount',mpesa_receipt_number=p_receipt_number,provider_callback=p_payload,updated_at=now(),completed_at=now() where id=intent.id;
   return jsonb_build_object('accepted',true,'duplicate',true,'status','paid');
  end if;
  update public.college_payment_intents set status='callback_error',result_code=0,result_description='Receipt reference already exists against a different student or amount; manual review required',provider_callback=p_payload,updated_at=now() where id=intent.id;
  return jsonb_build_object('accepted',false,'status','callback_error');
 end if;
 begin
  if nullif(p_transaction_date,'') ~ '^[0-9]{14}$' then receipt_time:=make_timestamptz(substring(p_transaction_date,1,4)::int,substring(p_transaction_date,5,2)::int,substring(p_transaction_date,7,2)::int,substring(p_transaction_date,9,2)::int,substring(p_transaction_date,11,2)::int,substring(p_transaction_date,13,2)::double precision,'Africa/Nairobi');
  else receipt_time:=now(); end if;
 exception when others then receipt_time:=now();
 end;
 insert into public.college_payments(student_id,amount_kes,payment_method,reference_number,bank_name,paid_at,recorded_by,notes)
 values(intent.student_id,intent.requested_amount_kes,'mpesa',trim(p_receipt_number),'M-Pesa',receipt_time,intent.created_by,'Verified Daraja STK callback; checkout '||intent.checkout_request_id);
 update public.college_payment_intents set status='paid',result_code=0,result_description=left(coalesce(p_result_description,'Payment confirmed'),1000),mpesa_receipt_number=trim(p_receipt_number),provider_callback=p_payload,updated_at=now(),completed_at=now(),merchant_request_id=coalesce(p_merchant_request_id,merchant_request_id) where id=intent.id;
 return jsonb_build_object('accepted',true,'status','paid','receipt',trim(p_receipt_number));
end;
$fn$;
revoke all on function public.college_apply_mpesa_callback(text,text,text,integer,text,text,numeric,text,text,jsonb) from public;
grant execute on function public.college_apply_mpesa_callback(text,text,text,integer,text,text,numeric,text,text,jsonb) to anon,authenticated;

create or replace function public.college_cron_daily_checks(p_token text)
returns jsonb language plpgsql security definer set search_path=public,extensions
as $fn$
declare secret_hash text; result jsonb; run_id uuid;
begin
 select token_hash into secret_hash from public.college_private_integration_secrets where secret_name='cron';
 if secret_hash is null or p_token is null or encode(digest(p_token,'sha256'),'hex')<>secret_hash then raise exception 'Invalid scheduled task authorization'; end if;
 perform set_config('request.jwt.claim.role','service_role',true);
 result:=public.college_refresh_early_warnings();
 insert into public.college_workflow_runs(status,items_found,summary,started_at,completed_at) values('completed',coalesce((result->>'new_alerts')::int,0),result,now(),now()) returning id into run_id;
 return jsonb_build_object('success',true,'run_id',run_id,'result',result);
exception when others then
 insert into public.college_workflow_runs(status,items_found,summary,error_message,started_at,completed_at) values('failed',0,'{}'::jsonb,left(sqlerrm,2000),now(),now());
 raise;
end;
$fn$;
revoke all on function public.college_cron_daily_checks(text) from public;
grant execute on function public.college_cron_daily_checks(text) to anon,authenticated;

create or replace function public.college_refresh_early_warnings()
returns jsonb language plpgsql security definer set search_path=public,extensions
as $fn$
declare added integer:=0; n integer:=0; month_key text:=to_char(now() at time zone 'Africa/Nairobi','YYYY-MM');
begin
 if coalesce(auth.role(),'')<>'service_role' and not public.college_blueprint_has_role(array['super_admin','principal','registrar','finance','hod','lecturer']) then raise exception 'Not authorized to refresh alerts'; end if;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'attendance:'||s.id::text||':'||month_key,s.id,'attendance','high','Repeated student absence',count(*)::text||' absences recorded in the last 30 days.'
 from public.college_students s join public.college_attendance a on a.student_id=s.id where s.status='active' and a.session_date>=current_date-30 and a.status='absent' group by s.id having count(*)>=3 on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'academic:'||x.student_id::text||':'||month_key,x.student_id,'academic','high','Repeated low assessment scores',x.low_count::text||' approved assessment results below 40% of the maximum score in the last 90 days.'
 from (select r.student_id,count(*) as low_count from public.college_results r join public.college_assessments a on a.id=r.assessment_id where r.approved_at is not null and a.max_score>0 and r.score/a.max_score<0.4 and coalesce(r.approved_at,r.created_at)>=now()-interval '90 days' group by r.student_id having count(*)>=2) x on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,student_id,category,severity,title,details)
 select 'fees:'||s.id::text||':'||month_key,s.id,'fees','medium','Overdue fees for review','Estimated overdue balance: KES '||to_char(balance,'FM999999990.00')||'. Reconcile against the official student statement before action.'
 from (select c.student_id,greatest(sum(case when c.charge_status='posted' and c.due_date<current_date then greatest(coalesce(c.amount_kes,0)-coalesce(c.discount_kes,0),0) else 0 end)-coalesce(max(p.paid_total),0),0) balance from public.college_fee_charges c left join (select student_id,sum(amount_kes) paid_total from public.college_payments group by student_id) p on p.student_id=c.student_id group by c.student_id) x join public.college_students s on s.id=x.student_id where balance>0 on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 insert into public.college_early_warning_alerts(alert_key,category,severity,title,details)
 select 'quality:'||q.id::text||':'||month_key,null,'quality','medium','Regulatory record expiry approaching',q.title||' expires on '||q.expires_on::text||'.'
 from public.college_quality_records q where q.expires_on between current_date and current_date+30 and q.status not in ('expired','closed') on conflict(alert_key) do nothing;
 get diagnostics n=row_count;added:=added+n;
 return jsonb_build_object('new_alerts',added,'checked_at',now());
end;
$fn$;
revoke all on function public.college_refresh_early_warnings() from public,anon;
grant execute on function public.college_refresh_early_warnings() to authenticated;
