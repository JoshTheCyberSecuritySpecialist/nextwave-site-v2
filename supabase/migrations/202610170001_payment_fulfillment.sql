-- Proposed production storage. LOCAL DRAFT ONLY: not applied to any database.
begin;
create table public.service_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  package_id text not null check (package_id in ('booking-only', 'website-crm')),
  amount integer not null,
  currency text not null default 'usd' check (currency = 'usd'),
  email text not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','intake_received','fulfilled','refunded')),
  created_at timestamptz not null default now(),
  check ((package_id = 'booking-only' and amount = 79900) or (package_id = 'website-crm' and amount = 149900))
);
create table public.payment_events (
  stripe_event_id text primary key,
  order_id uuid not null references public.service_orders(id),
  processed_at timestamptz not null default now()
);
create table public.customer_intakes (
  order_id uuid primary key references public.service_orders(id),
  business_name text not null,
  requirements text not null,
  submitted_at timestamptz not null default now()
);
create table public.fulfillment_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  external_crm_id text
);
create table public.fulfillment_projects (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.service_orders(id),
  contact_id uuid not null references public.fulfillment_contacts(id),
  status text not null default 'ready_for_review'
);
create table public.fulfillment_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id),
  kind text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  unique(order_id, kind)
);
-- No public browser policies: backend-only access; service credentials never go to Vite.
alter table public.service_orders enable row level security;
alter table public.payment_events enable row level security;
alter table public.customer_intakes enable row level security;
alter table public.fulfillment_contacts enable row level security;
alter table public.fulfillment_projects enable row level security;
alter table public.fulfillment_outbox enable row level security;
revoke all on public.service_orders, public.payment_events, public.customer_intakes,
  public.fulfillment_contacts, public.fulfillment_projects, public.fulfillment_outbox from anon, authenticated;
commit;
