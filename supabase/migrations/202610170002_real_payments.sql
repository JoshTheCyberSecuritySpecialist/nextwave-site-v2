-- LOCAL ONLY. Apply after 202610170001; never apply remotely without approval.
begin;
alter table public.service_orders drop constraint service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check check
  (status in ('pending','failed','expired','paid','intake_received','fulfilled','refunded'));
alter table public.service_orders
  add column token_hash text unique,
  add column token_expires_at timestamptz,
  add column checkout_url text,
  add column updated_at timestamptz not null default now(),
  add constraint service_order_token_hash check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$');
alter table public.payment_events
  add column event_type text,
  add column outcome text,
  add column payload_fingerprint text;
alter table public.fulfillment_outbox
  add column lease_id uuid,
  add column lease_until timestamptz,
  add column last_error text,
  add column delivered_at timestamptz;
alter table public.fulfillment_outbox add constraint outbox_status_check
  check (status in ('queued','processing','delivered','failed'));
create index fulfillment_outbox_due on public.fulfillment_outbox(next_attempt_at)
  where status in ('queued','processing');
create table public.project_status_history (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.fulfillment_projects(id),
  status text not null,
  created_at timestamptz not null default now(),
  unique(project_id,status)
);
-- Architecture only: deliberately impossible to activate billing in this phase.
create table public.service_subscriptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.service_orders(id),
  amount integer not null default 14900 check (amount=14900),
  currency text not null default 'usd' check (currency='usd'),
  status text not null default 'disabled' check (status='disabled'),
  consent_record jsonb,
  stripe_subscription_id text unique,
  check (stripe_subscription_id is null)
);
alter table public.project_status_history enable row level security;
alter table public.service_subscriptions enable row level security;
revoke all on public.service_orders,public.payment_events,public.customer_intakes,
 public.fulfillment_contacts,public.fulfillment_projects,public.fulfillment_outbox,
 public.project_status_history,public.service_subscriptions from public,anon,authenticated;

-- No SECURITY DEFINER: service role is the only caller and RLS bypass is explicit.
create function public.p3_checkout_prepare(p_request_id uuid,p_package_id text,p_email text)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare o public.service_orders; a integer; e text:=lower(btrim(p_email));
begin
  a:=case p_package_id when 'booking-only' then 79900 when 'website-crm' then 149900 end;
  if a is null or e is null or length(e)>320 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid checkout input';
  end if;
  insert into public.service_orders(request_id,package_id,amount,email)
    values(p_request_id,p_package_id,a,e) on conflict(request_id) do nothing;
  select * into strict o from public.service_orders where request_id=p_request_id for update;
  if o.package_id<>p_package_id or o.email<>e then raise exception 'request id conflict'; end if;
  return jsonb_build_object('order_id',o.id,'request_id',o.request_id,'package_id',o.package_id,
    'amount',o.amount,'currency',o.currency,'email',o.email,'status',o.status,'created_at',o.created_at,
    'stripe_session_id',o.stripe_session_id,'checkout_url',o.checkout_url,
    'stripe_idempotency_key','checkout:'||o.id::text);
end $$;

create function public.p3_checkout_attach(p_order_id uuid,p_session_id text,p_checkout_url text,p_token_hash text)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare o public.service_orders;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid token'; end if;
  if p_session_id is null or p_session_id !~ '^cs_test_' or p_checkout_url is null
     or p_checkout_url !~ '^https://checkout\.stripe\.com/' then raise exception 'invalid test checkout'; end if;
  select * into strict o from public.service_orders where id=p_order_id for update;
  if o.stripe_session_id is not null and (o.stripe_session_id<>p_session_id or o.checkout_url is distinct from p_checkout_url)
    then raise exception 'checkout already attached'; end if;
  if o.stripe_session_id is null then
    if o.status<>'pending' then raise exception 'order not pending'; end if;
    update public.service_orders set stripe_session_id=p_session_id,checkout_url=p_checkout_url,
      token_hash=p_token_hash,token_expires_at=now()+interval '7 days',updated_at=now() where id=o.id;
  end if;
  return jsonb_build_object('order_id',o.id,'stripe_session_id',p_session_id,'checkout_url',p_checkout_url);
end $$;

-- Caller must verify Stripe signature on raw bytes and reject livemode before calling.
-- Fingerprint is SHA-256 of raw event bytes. Token hash is SHA-256 of a random >=32-byte token.
create function public.p3_payment_event(p_event_id text,p_event_type text,p_order_id uuid,
 p_session_id text,p_payment_intent_id text,p_amount integer,p_currency text,p_payment_status text,
 p_livemode boolean,p_payload_fingerprint text,p_token_hash text default null)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare o public.service_orders; ev public.payment_events; result text;
begin
  if p_livemode is distinct from false or p_event_id is null or p_event_id !~ '^evt_'
     or p_payload_fingerprint is null or p_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or p_event_type is null or p_event_type not in ('checkout.session.completed',
       'checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired')
    then raise exception 'invalid event envelope'; end if;
  -- Serializes duplicates even if a malicious duplicate names a different order.
  perform pg_advisory_xact_lock(hashtextextended(p_event_id,0));
  select * into ev from public.payment_events where stripe_event_id=p_event_id;
  if found then
    if ev.order_id is distinct from p_order_id or ev.event_type is distinct from p_event_type
      or ev.payload_fingerprint is distinct from p_payload_fingerprint then raise exception 'event replay conflict'; end if;
    return jsonb_build_object('duplicate',true,'outcome',ev.outcome,'order_id',ev.order_id);
  end if;
  select * into strict o from public.service_orders where id=p_order_id for update;
  if p_session_id is null or o.stripe_session_id is distinct from p_session_id
    or o.amount is distinct from p_amount or o.currency is distinct from p_currency then
    raise exception 'payment order/session/amount/currency mismatch'; end if;
  result:='ignored';
  if p_event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded') then
    if p_payment_status='paid' then
      if p_payment_intent_id is null or p_payment_intent_id !~ '^pi_' then raise exception 'missing payment intent'; end if;
      if o.stripe_payment_intent_id is not null and o.stripe_payment_intent_id<>p_payment_intent_id then
        raise exception 'payment intent mismatch'; end if;
      if o.status in ('pending','failed','expired') then
        if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid token hash'; end if;
        update public.service_orders set status='paid',stripe_payment_intent_id=p_payment_intent_id,
          token_hash=p_token_hash,token_expires_at=now()+interval '7 days',updated_at=now() where id=o.id;
        insert into public.fulfillment_outbox(order_id,kind) values(o.id,'payment_confirmation') on conflict do nothing;
        result:='paid';
      elsif o.status in ('paid','intake_received','fulfilled') then result:='already_paid';
      else raise exception 'order cannot accept payment'; end if;
    elsif p_event_type='checkout.session.completed' and p_payment_status='unpaid' then result:='awaiting_payment';
    else raise exception 'invalid payment status'; end if;
  elsif o.status in ('pending','failed','expired') then
    result:=case when p_event_type='checkout.session.expired' then 'expired' else 'failed' end;
    -- Failure must not replace expiry, and neither may regress paid fulfillment.
    if o.status='expired' then result:='expired'; end if;
    update public.service_orders set status=result,updated_at=now() where id=o.id;
  end if;
  insert into public.payment_events(stripe_event_id,order_id,event_type,outcome,payload_fingerprint)
    values(p_event_id,o.id,p_event_type,result,p_payload_fingerprint);
  return jsonb_build_object('duplicate',false,'outcome',result,'order_id',o.id);
end $$;

-- Hash comparison and expiry enforced here, never by browser claims.
create function public.p3_order_status(p_order_id uuid,p_token_hash text)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare o public.service_orders;
begin
  select * into o from public.service_orders where id=p_order_id and token_hash=p_token_hash
    and token_expires_at>now();
  if not found then raise exception 'invalid or expired invitation'; end if;
  return jsonb_build_object('order_id',o.id,'package_id',o.package_id,'status',o.status,
    'intake_received',exists(select 1 from public.customer_intakes where order_id=o.id));
end $$;

create function public.p3_submit_intake(p_order_id uuid,p_token_hash text,p_business_name text,p_requirements text)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare o public.service_orders; i public.customer_intakes; c uuid; project uuid;
begin
  select * into o from public.service_orders where id=p_order_id and token_hash=p_token_hash
    and token_expires_at>now() for update;
  if not found then raise exception 'invalid or expired invitation'; end if;
  if o.status not in ('paid','intake_received','fulfilled') then raise exception 'payment not confirmed'; end if;
  if p_business_name is null or length(btrim(p_business_name)) not between 1 and 200
    or p_requirements is null or length(btrim(p_requirements)) not between 1 and 20000 then raise exception 'invalid intake'; end if;
  select * into i from public.customer_intakes where order_id=o.id;
  if found then
    if i.business_name<>btrim(p_business_name) or i.requirements<>btrim(p_requirements) then raise exception 'intake already submitted'; end if;
    select id into strict project from public.fulfillment_projects where order_id=o.id;
    return jsonb_build_object('order_id',o.id,'project_id',project,'duplicate',true);
  end if;
  insert into public.customer_intakes(order_id,business_name,requirements) values(o.id,btrim(p_business_name),btrim(p_requirements));
  insert into public.fulfillment_contacts(email) values(o.email) on conflict(email) do update set email=excluded.email returning id into c;
  insert into public.fulfillment_projects(order_id,contact_id) values(o.id,c) returning id into project;
  insert into public.project_status_history(project_id,status) values(project,'ready_for_review');
  update public.service_orders set status='intake_received',updated_at=now() where id=o.id;
  insert into public.fulfillment_outbox(order_id,kind) values(o.id,'intake_confirmation'),(o.id,'hubspot_sync') on conflict do nothing;
  return jsonb_build_object('order_id',o.id,'project_id',project,'duplicate',false);
end $$;

create function public.p3_outbox_claim(p_limit integer default 10)
returns setof public.fulfillment_outbox language plpgsql set search_path=pg_catalog,public as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid limit'; end if;
  -- Exhausted crashed workers must become visible terminal failures, not stuck leases.
  update public.fulfillment_outbox set status='failed',lease_until=null,
    last_error=coalesce(last_error,'delivery lease expired after final attempt')
    where status='processing' and lease_until<now() and attempts>=10;
  return query
    with due as (
      select id from public.fulfillment_outbox
      where ((status='queued' and next_attempt_at<=now()) or (status='processing' and lease_until<now()))
      and attempts<10 order by next_attempt_at,id for update skip locked limit p_limit
    ) update public.fulfillment_outbox o set status='processing',attempts=attempts+1,
        lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes'
      from due where o.id=due.id returning o.*;
end $$;

create function public.p3_outbox_finish(p_job_id uuid,p_lease_id uuid,p_success boolean,p_error text default null,p_external_crm_id text default null)
returns jsonb language plpgsql set search_path=pg_catalog,public as $$
declare j public.fulfillment_outbox;
begin
  select * into strict j from public.fulfillment_outbox where id=p_job_id for update;
  if p_success is null or p_lease_id is null or j.lease_id is distinct from p_lease_id then raise exception 'invalid lease'; end if;
  if j.status='delivered' and p_success then return jsonb_build_object('status','delivered','duplicate',true); end if;
  if j.status<>'processing' or j.lease_until<=now() then raise exception 'stale lease'; end if;
  if p_success and j.kind='hubspot_sync' then
    if p_external_crm_id is null or length(p_external_crm_id) not between 1 and 200 then raise exception 'missing CRM id'; end if;
    update public.fulfillment_contacts c set external_crm_id=p_external_crm_id
      from public.fulfillment_projects p where p.order_id=j.order_id and c.id=p.contact_id;
    if not found then raise exception 'missing project contact'; end if;
  end if;
  update public.fulfillment_outbox set
    status=case when p_success then 'delivered' when attempts>=10 then 'failed' else 'queued' end,
    delivered_at=case when p_success then now() end,
    last_error=case when p_success then null else left(coalesce(p_error,'delivery failed'),2000) end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(j.attempts,7))::integer)),
    lease_until=null where id=j.id returning * into j;
  return jsonb_build_object('status',j.status,'duplicate',false,'attempts',j.attempts);
end $$;

-- Revoke implicit PUBLIC EXECUTE before commit, including all overload signatures.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'p3\_%' escape '\'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant select,insert,update on public.service_orders,public.payment_events,public.customer_intakes,
 public.fulfillment_contacts,public.fulfillment_projects,public.fulfillment_outbox,
 public.project_status_history,public.service_subscriptions to service_role;
grant usage,select on sequence public.project_status_history_id_seq to service_role;
commit;
