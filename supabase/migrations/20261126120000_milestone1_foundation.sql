-- Pending review. Do not apply to production until checked on a copy.
-- Milestone 1: package reconciliation, refund recording, website foundation, invite preview.
-- Does not enable live Stripe, subscriptions, or automatic workspace suspension on refund.
-- Preserves historical booking-only orders and organizations.

begin;

-- ---------------------------------------------------------------------------
-- Packages: allow business-website; keep booking-only for history
-- ---------------------------------------------------------------------------

alter table public.service_orders drop constraint if exists service_orders_package_id_check;
alter table public.service_orders drop constraint if exists service_orders_check;
alter table public.service_orders
  add constraint service_orders_package_id_check
  check (package_id in ('booking-only', 'business-website', 'website-crm'));
alter table public.service_orders
  add constraint service_orders_amount_package_check
  check (
    (package_id = 'booking-only' and amount = 79900)
    or (package_id = 'business-website' and amount = 79900)
    or (package_id = 'website-crm' and amount = 149900)
  );

alter table public.service_orders
  add column if not exists refunded_amount integer not null default 0
  check (refunded_amount >= 0);

alter table public.organizations drop constraint if exists organizations_package_id_check;
alter table public.organizations
  add constraint organizations_package_id_check
  check (package_id in ('booking-only', 'business-website', 'website-crm'));

alter table public.organization_entitlements
  add column if not exists website_enabled boolean not null default false;
alter table public.organization_entitlements
  add column if not exists max_pages integer not null default 0;
alter table public.organization_entitlements
  add column if not exists max_generation_runs integer not null default 0;

alter table public.organization_entitlements drop constraint if exists organization_entitlements_max_services_check;
alter table public.organization_entitlements
  add constraint organization_entitlements_max_services_check
  check (max_services is null or max_services >= 0);
alter table public.organization_entitlements drop constraint if exists organization_entitlements_max_pages_check;
alter table public.organization_entitlements
  add constraint organization_entitlements_max_pages_check
  check (max_pages >= 0);
alter table public.organization_entitlements drop constraint if exists organization_entitlements_max_generation_runs_check;
alter table public.organization_entitlements
  add constraint organization_entitlements_max_generation_runs_check
  check (max_generation_runs >= 0);

alter table public.organization_entitlements drop constraint if exists organization_entitlements_package_id_check;
alter table public.organization_entitlements drop constraint if exists organization_entitlements_check;

alter table public.organization_entitlements
  add constraint organization_entitlements_package_id_check
  check (package_id in ('booking-only', 'business-website', 'website-crm'));

alter table public.organization_entitlements
  add constraint organization_entitlements_check
  check (
    (
      package_id = 'website-crm'
      and max_users = 2
      and max_calendars = 1
      and max_services = 10
      and max_customers = 1000
      and max_locations = 1
      and max_inbound_addresses = 1
      and email_cap = 1000
      and crm_enabled
      and tasks_enabled
      and messages_enabled
      and csv_export_enabled
      and website_enabled
      and max_pages = 5
      and max_generation_runs = 20
    )
    or (
      package_id = 'business-website'
      and max_users = 1
      and max_calendars = 1
      and max_services = 0
      and max_customers = 0
      and max_locations = 1
      and max_inbound_addresses = 0
      and email_cap = 0
      and not crm_enabled
      and not tasks_enabled
      and not messages_enabled
      and not csv_export_enabled
      and website_enabled
      and max_pages = 3
      and max_generation_runs = 10
    )
    or (
      package_id = 'booking-only'
      and max_users = 1
      and max_calendars = 1
      and max_services is null
      and max_customers = 0
      and max_locations = 1
      and max_inbound_addresses = 0
      and email_cap = 0
      and not crm_enabled
      and not tasks_enabled
      and not messages_enabled
      and not csv_export_enabled
      and not website_enabled
      and max_pages = 0
      and max_generation_runs = 0
    )
  );

update public.organization_entitlements
set website_enabled = true, max_pages = 5, max_generation_runs = 20
where package_id = 'website-crm';

create or replace function public.p3_checkout_prepare(p_request_id uuid, p_package_id text, p_email text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  o public.service_orders;
  a integer;
  e text := lower(btrim(p_email));
begin
  a := case p_package_id
    when 'business-website' then 79900
    when 'website-crm' then 149900
    else null
  end;
  if a is null or e is null or length(e) > 320 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid checkout input';
  end if;
  insert into public.service_orders(request_id, package_id, amount, email)
    values (p_request_id, p_package_id, a, e)
    on conflict (request_id) do nothing;
  select * into strict o from public.service_orders where request_id = p_request_id for update;
  if o.package_id <> p_package_id or o.email <> e then
    raise exception 'request id conflict';
  end if;
  return jsonb_build_object(
    'order_id', o.id,
    'request_id', o.request_id,
    'package_id', o.package_id,
    'amount', o.amount,
    'currency', o.currency,
    'email', o.email,
    'status', o.status,
    'created_at', o.created_at,
    'stripe_session_id', o.stripe_session_id,
    'checkout_url', o.checkout_url,
    'stripe_idempotency_key', 'checkout:' || o.id::text
  );
end;
$$;

-- Refund recording only. Does not change organization status.
create or replace function public.p3_refund_event(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text,
  p_amount_refunded integer,
  p_currency text,
  p_livemode boolean,
  p_payload_fingerprint text
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  o public.service_orders;
  ev public.payment_events;
  result text;
  next_status text;
begin
  if p_livemode is distinct from false
     or p_event_id is null or p_event_id !~ '^evt_'
     or p_payload_fingerprint is null or p_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or p_event_type is distinct from 'charge.refunded'
     or p_payment_intent_id is null or p_payment_intent_id !~ '^pi_'
     or p_amount_refunded is null or p_amount_refunded < 0
     or p_currency is distinct from 'usd' then
    raise exception 'invalid refund envelope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_event_id, 0));
  select * into ev from public.payment_events where stripe_event_id = p_event_id;
  if found then
    if ev.event_type is distinct from p_event_type
       or ev.payload_fingerprint is distinct from p_payload_fingerprint then
      raise exception 'event replay conflict';
    end if;
    return jsonb_build_object('duplicate', true, 'outcome', ev.outcome, 'order_id', ev.order_id);
  end if;
  select * into o from public.service_orders
    where stripe_payment_intent_id = p_payment_intent_id
    for update;
  if not found then
    raise exception 'payment intent not found';
  end if;
  if o.status not in ('paid', 'intake_received', 'fulfilled', 'refunded') then
    raise exception 'order cannot accept refund';
  end if;
  if p_amount_refunded > o.amount then
    raise exception 'refund exceeds order amount';
  end if;
  if p_amount_refunded < o.refunded_amount then
    raise exception 'refund amount regression';
  end if;
  next_status := case when p_amount_refunded >= o.amount then 'refunded' else o.status end;
  if next_status = 'refunded' and o.status = 'refunded' and o.refunded_amount = p_amount_refunded then
    result := 'already_refunded';
  else
    update public.service_orders
      set refunded_amount = p_amount_refunded,
          status = case when p_amount_refunded >= amount then 'refunded' else status end,
          updated_at = now()
      where id = o.id;
    result := case when p_amount_refunded >= o.amount then 'refunded' else 'partially_refunded' end;
  end if;
  insert into public.payment_events(stripe_event_id, order_id, event_type, outcome, payload_fingerprint)
    values (p_event_id, o.id, p_event_type, result, p_payload_fingerprint);
  return jsonb_build_object(
    'duplicate', false,
    'outcome', result,
    'order_id', o.id,
    'refunded_amount', p_amount_refunded,
    'access_unchanged', true
  );
end;
$$;

revoke all on function public.p3_refund_event(text, text, text, integer, text, boolean, text) from public, anon, authenticated;
grant execute on function public.p3_refund_event(text, text, text, integer, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Website foundation
-- ---------------------------------------------------------------------------

create table if not exists public.business_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  legal_name text,
  public_name text not null check (length(btrim(public_name)) between 1 and 200),
  industry text check (industry is null or length(btrim(industry)) between 1 and 120),
  description text check (description is null or length(description) <= 8000),
  public_email text check (
    public_email is null
    or (length(public_email) between 3 and 320 and public_email = lower(public_email))
  ),
  public_phone text check (public_phone is null or length(btrim(public_phone)) between 7 and 40),
  location_text text check (location_text is null or length(location_text) <= 500),
  service_area text check (service_area is null or length(service_area) <= 500),
  timezone text not null default 'America/New_York',
  hours_json jsonb not null default '{}'::jsonb,
  logo_asset_id uuid,
  brand_primary text check (brand_primary is null or brand_primary ~ '^#[0-9A-Fa-f]{6}$'),
  brand_secondary text check (brand_secondary is null or brand_secondary ~ '^#[0-9A-Fa-f]{6}$'),
  typography_preference text check (typography_preference is null or length(typography_preference) <= 80),
  style_direction text check (style_direction is null or length(style_direction) <= 200),
  social_links jsonb not null default '{}'::jsonb,
  primary_cta_label text check (primary_cta_label is null or length(primary_cta_label) <= 80),
  primary_cta_href text check (primary_cta_href is null or length(primary_cta_href) <= 500),
  private_notes text check (private_notes is null or length(private_notes) <= 8000),
  intake_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 63),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  draft_revision_id uuid,
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_revisions (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  state text not null check (state in ('draft', 'published', 'archived')),
  content jsonb not null default '{"pages":[],"theme":{},"navigation":[]}'::jsonb,
  page_count integer not null default 0 check (page_count >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (website_id, revision_number)
);

create table if not exists public.website_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid references public.websites(id) on delete cascade,
  kind text not null check (kind in ('logo', 'image', 'other')),
  storage_path text not null check (length(storage_path) between 1 and 500),
  alt_text text check (alt_text is null or length(alt_text) <= 300),
  content_type text check (content_type is null or length(content_type) <= 120),
  byte_size integer check (byte_size is null or byte_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.website_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  target_revision_id uuid references public.website_revisions(id),
  base_revision_id uuid references public.website_revisions(id),
  scope text not null default 'full_site' check (scope in ('full_site', 'section')),
  section_key text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  error_message text,
  provider text check (provider is null or length(provider) <= 40),
  provider_request_id text,
  idempotency_key text not null,
  result_revision_id uuid references public.website_revisions(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (organization_id, idempotency_key)
);

create index if not exists website_generation_jobs_status_idx
  on public.website_generation_jobs (status, created_at);

alter table public.websites
  drop constraint if exists websites_draft_revision_id_fkey;
alter table public.websites
  drop constraint if exists websites_published_revision_id_fkey;
alter table public.websites
  add constraint websites_draft_revision_id_fkey
  foreign key (draft_revision_id) references public.website_revisions(id);
alter table public.websites
  add constraint websites_published_revision_id_fkey
  foreign key (published_revision_id) references public.website_revisions(id);

alter table public.business_profiles enable row level security;
alter table public.websites enable row level security;
alter table public.website_revisions enable row level security;
alter table public.website_assets enable row level security;
alter table public.website_generation_jobs enable row level security;
alter table public.business_profiles force row level security;
alter table public.websites force row level security;
alter table public.website_revisions force row level security;
alter table public.website_assets force row level security;
alter table public.website_generation_jobs force row level security;

revoke all on public.business_profiles, public.websites, public.website_revisions,
  public.website_assets, public.website_generation_jobs from anon, authenticated;
grant select, insert, update on public.business_profiles, public.websites, public.website_revisions,
  public.website_assets, public.website_generation_jobs to authenticated;
grant all on public.business_profiles, public.websites, public.website_revisions,
  public.website_assets, public.website_generation_jobs to service_role;

drop policy if exists business_profiles_member_select on public.business_profiles;
create policy business_profiles_member_select on public.business_profiles
  for select to authenticated
  using (public.crm_active_member(organization_id));

drop policy if exists business_profiles_member_write on public.business_profiles;
create policy business_profiles_member_write on public.business_profiles
  for all to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

drop policy if exists websites_member_select on public.websites;
create policy websites_member_select on public.websites
  for select to authenticated
  using (public.crm_active_member(organization_id));

drop policy if exists websites_member_write on public.websites;
create policy websites_member_write on public.websites
  for all to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

drop policy if exists website_revisions_member_select on public.website_revisions;
create policy website_revisions_member_select on public.website_revisions
  for select to authenticated
  using (public.crm_active_member(organization_id));

drop policy if exists website_revisions_member_write on public.website_revisions;
create policy website_revisions_member_write on public.website_revisions
  for all to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

drop policy if exists website_assets_member_select on public.website_assets;
create policy website_assets_member_select on public.website_assets
  for select to authenticated
  using (public.crm_active_member(organization_id));

drop policy if exists website_assets_member_write on public.website_assets;
create policy website_assets_member_write on public.website_assets
  for all to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

drop policy if exists website_generation_jobs_member_select on public.website_generation_jobs;
create policy website_generation_jobs_member_select on public.website_generation_jobs
  for select to authenticated
  using (public.crm_active_member(organization_id));

drop policy if exists website_generation_jobs_member_insert on public.website_generation_jobs;
create policy website_generation_jobs_member_insert on public.website_generation_jobs
  for insert to authenticated
  with check (public.crm_active_member(organization_id));

-- ---------------------------------------------------------------------------
-- Owner invitation messages + preview
-- ---------------------------------------------------------------------------

create table if not exists public.owner_invitation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_email text not null,
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 8000),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (organization_id, recipient_email, subject, body)
);

alter table public.owner_invitation_messages enable row level security;
revoke all on public.owner_invitation_messages from anon, authenticated;
grant all on public.owner_invitation_messages to service_role;

create or replace function public.crm_invitation_preview(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inv public.organization_invitations;
  org public.organizations;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid or expired invitation';
  end if;
  select * into inv from public.organization_invitations where token_hash = p_token_hash;
  if not found or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'invalid or expired invitation';
  end if;
  select * into org from public.organizations where id = inv.organization_id and status = 'active';
  if not found then
    raise exception 'invalid or expired invitation';
  end if;
  return jsonb_build_object(
    'email', inv.email,
    'organization_name', org.name,
    'package_id', org.package_id,
    'expires_at', inv.expires_at
  );
end;
$$;

revoke all on function public.crm_invitation_preview(text) from public, anon, authenticated;
grant execute on function public.crm_invitation_preview(text) to service_role;

create or replace function public.owner_invitation_enqueue(
  p_organization_id uuid,
  p_recipient_email text,
  p_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job public.owner_invitation_messages;
  email text := lower(btrim(p_recipient_email));
begin
  if p_organization_id is null or email is null or p_subject is null or p_body is null then
    raise exception 'invalid invitation message';
  end if;
  insert into public.owner_invitation_messages (organization_id, recipient_email, subject, body)
    values (p_organization_id, email, btrim(p_subject), p_body)
    on conflict (organization_id, recipient_email, subject, body) do nothing
    returning * into job;
  if not found then
    select * into strict job
    from public.owner_invitation_messages
    where organization_id = p_organization_id
      and recipient_email = email
      and subject = btrim(p_subject)
      and body = p_body;
    return jsonb_build_object('id', job.id, 'duplicate', true, 'status', job.status);
  end if;
  return jsonb_build_object('id', job.id, 'duplicate', false, 'status', job.status);
end;
$$;

revoke all on function public.owner_invitation_enqueue(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.owner_invitation_enqueue(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Provisioning: new package entitlements + website draft bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.crm_provision_organization(p_order_id uuid, p_token_hash text, p_actor_email text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  o public.service_orders;
  existing public.provisioning_records;
  intake public.customer_intakes;
  org_id uuid;
  business text;
  base text;
  candidate text;
  actor text := lower(btrim(p_actor_email));
  site_id uuid;
  revision_id uuid;
begin
  if actor is null or actor !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid actor';
  end if;
  select * into o from public.service_orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  select * into existing from public.provisioning_records where order_id = o.id;
  if found then
    insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
    values (
      existing.organization_id, actor, 'organization.provision_replay', 'organization', existing.organization_id,
      jsonb_build_object('order_id', o.id, 'duplicate', true)
    );
    return jsonb_build_object(
      'organization_id', existing.organization_id,
      'duplicate', true,
      'status', existing.status,
      'package_id', o.package_id
    );
  end if;
  if o.status not in ('paid', 'intake_received', 'fulfilled') then
    raise exception 'order is not paid';
  end if;
  if o.package_id not in ('booking-only', 'business-website', 'website-crm') then
    raise exception 'unsupported package';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;

  select * into intake from public.customer_intakes where order_id = o.id;
  business := coalesce(nullif(btrim(intake.business_name), ''), 'New workspace');
  if length(business) > 200 then
    business := left(business, 200);
  end if;
  base := regexp_replace(lower(business), '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  base := left(base, 40);
  if base is null or length(base) < 3 then
    base := 'workspace';
  end if;
  candidate := base;
  if exists (select 1 from public.organizations where slug = candidate) then
    candidate := base || '-' || substr(replace(p_order_id::text, '-', ''), 1, 8);
  end if;
  if exists (select 1 from public.organizations where slug = candidate) then
    candidate := substr(replace(p_order_id::text, '-', ''), 1, 12);
  end if;

  insert into public.organizations (slug, name, status, package_id, source_order_id, timezone)
  values (candidate, business, 'active', o.package_id, o.id, 'America/New_York')
  returning id into org_id;

  if o.package_id = 'website-crm' then
    insert into public.organization_entitlements (
      organization_id, package_id, max_users, max_calendars, max_services, max_customers,
      max_locations, max_inbound_addresses, email_cap,
      crm_enabled, tasks_enabled, messages_enabled, csv_export_enabled,
      website_enabled, max_pages, max_generation_runs
    ) values (
      org_id, 'website-crm', 2, 1, 10, 1000, 1, 1, 1000, true, true, true, true, true, 5, 20
    );
  elsif o.package_id = 'business-website' then
    insert into public.organization_entitlements (
      organization_id, package_id, max_users, max_calendars, max_services, max_customers,
      max_locations, max_inbound_addresses, email_cap,
      crm_enabled, tasks_enabled, messages_enabled, csv_export_enabled,
      website_enabled, max_pages, max_generation_runs
    ) values (
      org_id, 'business-website', 1, 1, 0, 0, 1, 0, 0, false, false, false, false, true, 3, 10
    );
  else
    insert into public.organization_entitlements (
      organization_id, package_id, max_users, max_calendars, max_services, max_customers,
      max_locations, max_inbound_addresses, email_cap,
      crm_enabled, tasks_enabled, messages_enabled, csv_export_enabled,
      website_enabled, max_pages, max_generation_runs
    ) values (
      org_id, 'booking-only', 1, 1, null, 0, 1, 0, 0, false, false, false, false, false, 0, 0
    );
  end if;

  insert into public.organization_settings (organization_id, business_name, timezone)
  values (org_id, business, 'America/New_York');

  insert into public.business_profiles (organization_id, public_name, timezone)
  values (org_id, business, 'America/New_York');

  if o.package_id in ('business-website', 'website-crm') then
    insert into public.websites (organization_id, slug, status)
    values (org_id, candidate, 'draft')
    returning id into site_id;
    insert into public.website_revisions (
      website_id, organization_id, revision_number, schema_version, state, content, page_count
    ) values (
      site_id, org_id, 1, 1, 'draft',
      jsonb_build_object(
        'pages', '[]'::jsonb,
        'theme', jsonb_build_object('primary', '#2283B8'),
        'navigation', '[]'::jsonb,
        'meta', jsonb_build_object('title', business, 'description', '')
      ),
      0
    ) returning id into revision_id;
    update public.websites set draft_revision_id = revision_id, updated_at = now() where id = site_id;
  end if;

  insert into public.organization_invitations (organization_id, email, role, token_hash, expires_at)
  values (org_id, lower(o.email), 'owner', p_token_hash, now() + interval '7 days');

  insert into public.provisioning_records (order_id, organization_id, status, approved_by_email)
  values (o.id, org_id, 'provisioned', actor);

  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    org_id, actor, 'organization.provision', 'organization', org_id,
    jsonb_build_object('order_id', o.id, 'package_id', o.package_id, 'duplicate', false)
  );

  return jsonb_build_object(
    'organization_id', org_id,
    'duplicate', false,
    'status', 'provisioned',
    'package_id', o.package_id,
    'website_id', site_id
  );
end;
$$;

-- Restore cancelled-idempotency rejection lost when booking_confirmation replaced booking_create_appointment.
create or replace function public.booking_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  org_id uuid;
  tz text;
  business text;
  published boolean;
  calendar uuid;
  service_name text;
  duration integer;
  guest_name text := pg_catalog.btrim(p_guest_name);
  guest_email text := pg_catalog.lower(pg_catalog.btrim(p_guest_email));
  guest_phone text := pg_catalog.btrim(p_guest_phone);
  existing public.appointments;
  created_id uuid;
  linked_customer uuid;
  confirmation_queued boolean;
begin
  if guest_name is null or length(guest_name) < 1 or length(guest_name) > 200
     or guest_email is null or guest_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(guest_email) > 320
     or guest_phone is null or length(guest_phone) < 1 or length(guest_phone) > 40
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$'
     or p_starts_at is null then
    raise exception 'invalid booking';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'booking is not available';
  end if;
  select o.id, settings.timezone, settings.business_name, settings.booking_published
    into org_id, tz, business, published
  from public.organizations o
  join public.organization_settings settings on settings.organization_id = o.id
  where o.slug = p_slug
    and o.status = 'active';
  if not found or published is not true then
    raise exception 'booking is not available';
  end if;
  select c.id into calendar
  from public.calendars c
  where c.organization_id = org_id
  for update;
  if not found then
    raise exception 'booking is not available';
  end if;
  select * into existing
  from public.appointments
  where organization_id = org_id
    and idempotency_key = p_idempotency_key;
  if found then
    if existing.status = 'cancelled' then
      raise exception 'booking was cancelled';
    end if;
    if existing.service_id is distinct from p_service_id
       or existing.starts_at is distinct from p_starts_at
       or existing.guest_name is distinct from guest_name
       or existing.guest_email is distinct from guest_email
       or existing.guest_phone is distinct from guest_phone then
      raise exception 'idempotency conflict';
    end if;
    select s.name into service_name from public.services s where s.id = existing.service_id;
    confirmation_queued := exists (
      select 1 from public.booking_messages m
      where m.appointment_id = existing.id
        and m.kind = 'confirmation'
        and m.status <> 'cancelled'
    );
    return pg_catalog.jsonb_build_object(
      'appointment_id', existing.id,
      'starts_at', existing.starts_at,
      'ends_at', existing.ends_at,
      'timezone', existing.timezone,
      'service_name', service_name,
      'business_name', business,
      'duplicate', true,
      'confirmation_queued', confirmation_queued
    );
  end if;
  select s.name, s.duration_minutes into service_name, duration
  from public.services s
  where s.id = p_service_id
    and s.organization_id = org_id
    and s.active;
  if not found or not public.booking_slot_is_open(org_id, p_service_id, p_starts_at) then
    raise exception 'slot is not open';
  end if;
  linked_customer := public.booking_link_guest(org_id, guest_name, guest_email, guest_phone);
  begin
    insert into public.appointments (
      organization_id, calendar_id, service_id, customer_id, guest_name, guest_email, guest_phone,
      starts_at, ends_at, timezone, status, idempotency_key
    ) values (
      org_id, calendar, p_service_id, linked_customer, guest_name, guest_email, guest_phone,
      p_starts_at, p_starts_at + pg_catalog.make_interval(mins => duration), tz, 'confirmed', p_idempotency_key
    )
    returning id into created_id;
  exception
    when unique_violation then
      select * into existing
      from public.appointments
      where organization_id = org_id
        and idempotency_key = p_idempotency_key;
      if found and existing.status = 'cancelled' then
        raise exception 'booking was cancelled';
      end if;
      if not found
         or existing.service_id is distinct from p_service_id
         or existing.starts_at is distinct from p_starts_at
         or existing.guest_email is distinct from guest_email then
        raise exception 'idempotency conflict';
      end if;
      confirmation_queued := exists (
        select 1 from public.booking_messages m
        where m.appointment_id = existing.id
          and m.kind = 'confirmation'
          and m.status <> 'cancelled'
      );
      return pg_catalog.jsonb_build_object(
        'appointment_id', existing.id,
        'starts_at', existing.starts_at,
        'ends_at', existing.ends_at,
        'timezone', existing.timezone,
        'service_name', service_name,
        'business_name', business,
        'duplicate', true,
        'confirmation_queued', confirmation_queued
      );
    when exclusion_violation then
      raise exception 'appointment conflict';
  end;
  confirmation_queued := public.booking_queue_messages(created_id);
  return pg_catalog.jsonb_build_object(
    'appointment_id', created_id,
    'starts_at', p_starts_at,
    'ends_at', p_starts_at + pg_catalog.make_interval(mins => duration),
    'timezone', tz,
    'service_name', service_name,
    'business_name', business,
    'duplicate', false,
    'confirmation_queued', confirmation_queued
  );
end;
$fn$;

commit;
