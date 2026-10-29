-- Development migration. Do not apply to production until you review it.
-- Run after 202610170001_payment_fulfillment.sql and 202610170002_real_payments.sql.
-- This file does not change checkout, Stripe, subscriptions, blog publishing, or Gemini.
-- Provisioning creates a workspace and a hashed owner invitation. It does not create an auth user
-- and it does not send email.

begin;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and length(slug) between 3 and 63),
  name text not null check (length(btrim(name)) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'suspended')),
  package_id text not null check (package_id in ('booking-only', 'website-crm')),
  source_order_id uuid not null unique references public.service_orders(id),
  timezone text not null default 'America/New_York' check (
    length(timezone) between 1 and 64
    and timezone ~ '^[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)*$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_entitlements (
  organization_id uuid primary key references public.organizations(id),
  package_id text not null check (package_id in ('booking-only', 'website-crm')),
  max_users integer not null check (max_users > 0),
  max_calendars integer not null check (max_calendars > 0),
  max_services integer check (max_services is null or max_services > 0),
  max_customers integer not null check (max_customers >= 0),
  max_locations integer not null check (max_locations > 0),
  max_inbound_addresses integer not null check (max_inbound_addresses >= 0),
  email_cap integer not null check (email_cap >= 0),
  crm_enabled boolean not null,
  tasks_enabled boolean not null,
  messages_enabled boolean not null,
  csv_export_enabled boolean not null,
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
    )
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (organization_id, user_id)
);

create unique index organization_one_active_owner
  on public.organization_members (organization_id)
  where role = 'owner' and status = 'active';

create index organization_members_user on public.organization_members (user_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check (
    length(email) between 3 and 320
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  role text not null check (role in ('owner', 'member')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.organization_settings (
  organization_id uuid primary key references public.organizations(id),
  business_name text not null check (length(btrim(business_name)) between 1 and 200),
  phone text check (phone is null or length(phone) <= 40),
  email text check (
    email is null or (
      length(email) between 3 and 320
      and email = lower(email)
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  location text check (location is null or length(location) <= 300),
  logo_path text check (logo_path is null or length(logo_path) <= 500),
  brand_primary text check (brand_primary is null or brand_primary ~ '^#[0-9A-Fa-f]{6}$'),
  brand_accent text check (brand_accent is null or brand_accent ~ '^#[0-9A-Fa-f]{6}$'),
  hours jsonb not null default '{}'::jsonb,
  policies text check (policies is null or length(policies) <= 4000),
  booking_intro text check (booking_intro is null or length(booking_intro) <= 2000),
  reminder_template text check (reminder_template is null or length(reminder_template) <= 4000),
  timezone text not null check (
    length(timezone) between 1 and 64
    and timezone ~ '^[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)*$'
  ),
  updated_at timestamptz not null default now()
);

create table public.provisioning_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.service_orders(id),
  organization_id uuid not null unique references public.organizations(id),
  status text not null default 'provisioned' check (status = 'provisioned'),
  approved_by_email text not null check (
    length(approved_by_email) between 3 and 320
    and approved_by_email = lower(approved_by_email)
  ),
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  actor_email text not null check (length(actor_email) between 3 and 320),
  action text not null check (length(action) between 1 and 80),
  target_type text not null check (length(target_type) between 1 and 40),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_organization_created
  on public.audit_events (organization_id, created_at desc);

create function public.crm_active_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and o.status = 'active'
  );
$$;

create function public.crm_enforce_entitlements()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  org_package text;
begin
  select package_id into org_package from public.organizations where id = new.organization_id;
  if org_package is distinct from new.package_id then
    raise exception 'entitlement package mismatch';
  end if;
  return new;
end;
$$;

create trigger organization_entitlements_package
  before insert or update on public.organization_entitlements
  for each row execute function public.crm_enforce_entitlements();

create function public.crm_enforce_member_cap()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  seat_cap integer;
  active_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  select max_users into seat_cap
  from public.organization_entitlements
  where organization_id = new.organization_id;
  if seat_cap is null then
    raise exception 'missing entitlements';
  end if;
  select count(*) into active_count
  from public.organization_members
  where organization_id = new.organization_id
    and status = 'active'
    and id is distinct from new.id;
  if active_count >= seat_cap then
    raise exception 'user cap exceeded';
  end if;
  return new;
end;
$$;

create trigger organization_members_cap
  before insert or update of status on public.organization_members
  for each row execute function public.crm_enforce_member_cap();

create function public.crm_enforce_settings()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.reminder_template is not null and length(btrim(new.reminder_template)) > 0
     and not exists (
       select 1 from public.organization_entitlements e
       where e.organization_id = new.organization_id and e.messages_enabled
     ) then
    raise exception 'messages are not included';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger organization_settings_guard
  before insert or update on public.organization_settings
  for each row execute function public.crm_enforce_settings();

create function public.crm_provision_organization(p_order_id uuid, p_token_hash text, p_actor_email text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  o public.service_orders;
  intake public.customer_intakes;
  existing public.provisioning_records;
  actor text := lower(btrim(p_actor_email));
  business text;
  base text;
  candidate text;
  org_id uuid;
begin
  if actor is null or length(actor) > 320 or actor !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
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
  if o.package_id not in ('booking-only', 'website-crm') then
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
      crm_enabled, tasks_enabled, messages_enabled, csv_export_enabled
    ) values (
      org_id, 'website-crm', 2, 1, 10, 1000, 1, 1, 1000, true, true, true, true
    );
  else
    insert into public.organization_entitlements (
      organization_id, package_id, max_users, max_calendars, max_services, max_customers,
      max_locations, max_inbound_addresses, email_cap,
      crm_enabled, tasks_enabled, messages_enabled, csv_export_enabled
    ) values (
      org_id, 'booking-only', 1, 1, null, 0, 1, 0, 0, false, false, false, false
    );
  end if;

  insert into public.organization_settings (organization_id, business_name, timezone)
  values (org_id, business, 'America/New_York');

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
    'package_id', o.package_id
  );
end;
$$;

create function public.crm_accept_invitation(p_user_id uuid, p_email text, p_token_hash text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  inv public.organization_invitations;
  member_status text;
  caller text := lower(btrim(p_email));
begin
  if p_user_id is null or caller is null or caller !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid or expired invitation';
  end if;
  select * into inv from public.organization_invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'invalid or expired invitation';
  end if;
  if inv.accepted_at is not null then
    if inv.accepted_by = p_user_id then
      return jsonb_build_object('organization_id', inv.organization_id, 'role', inv.role, 'duplicate', true);
    end if;
    raise exception 'invalid or expired invitation';
  end if;
  if inv.expires_at <= now() or caller <> inv.email then
    raise exception 'invalid or expired invitation';
  end if;
  if not exists (
    select 1 from public.organizations where id = inv.organization_id and status = 'active'
  ) then
    raise exception 'invalid or expired invitation';
  end if;
  select status into member_status
  from public.organization_members
  where organization_id = inv.organization_id and user_id = p_user_id;
  if found then
    if member_status = 'disabled' then
      raise exception 'membership disabled';
    end if;
  else
    insert into public.organization_members (organization_id, user_id, role, status)
    values (inv.organization_id, p_user_id, inv.role, 'active');
  end if;
  update public.organization_invitations
  set accepted_at = now(), accepted_by = p_user_id
  where id = inv.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    inv.organization_id, caller, 'invitation.accepted', 'invitation', inv.id,
    jsonb_build_object('role', inv.role)
  );
  return jsonb_build_object('organization_id', inv.organization_id, 'role', inv.role, 'duplicate', false);
end;
$$;

create function public.crm_reissue_invitation(p_organization_id uuid, p_token_hash text, p_actor_email text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  actor text := lower(btrim(p_actor_email));
  inv public.organization_invitations;
begin
  if actor is null or actor !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid token';
  end if;
  select * into inv
  from public.organization_invitations
  where organization_id = p_organization_id and role = 'owner'
  for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation already accepted';
  end if;
  update public.organization_invitations
  set token_hash = p_token_hash, expires_at = now() + interval '7 days'
  where id = inv.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (inv.organization_id, actor, 'invitation.reissue', 'invitation', inv.id, '{}'::jsonb);
  return jsonb_build_object('organization_id', inv.organization_id, 'duplicate', false);
end;
$$;

create function public.crm_set_organization_status(p_organization_id uuid, p_status text, p_actor_email text)
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  actor text := lower(btrim(p_actor_email));
  org public.organizations;
begin
  if actor is null or actor !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_status not in ('active', 'suspended') then
    raise exception 'invalid status';
  end if;
  select * into org from public.organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found';
  end if;
  if org.status = p_status then
    return jsonb_build_object('organization_id', org.id, 'status', org.status, 'duplicate', true);
  end if;
  update public.organizations set status = p_status, updated_at = now() where id = org.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    org.id, actor, 'organization.status', 'organization', org.id,
    jsonb_build_object('status', p_status)
  );
  return jsonb_build_object('organization_id', org.id, 'status', p_status, 'duplicate', false);
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.provisioning_records enable row level security;
alter table public.audit_events enable row level security;

alter table public.organizations force row level security;
alter table public.organization_entitlements force row level security;
alter table public.organization_members force row level security;
alter table public.organization_invitations force row level security;
alter table public.organization_settings force row level security;
alter table public.provisioning_records force row level security;
alter table public.audit_events force row level security;

revoke all on public.organizations, public.organization_entitlements, public.organization_members,
  public.organization_invitations, public.organization_settings, public.provisioning_records,
  public.audit_events
  from public, anon, authenticated;

grant select on public.organizations, public.organization_entitlements,
  public.organization_members, public.organization_settings
  to authenticated;

grant select, insert, update, delete on public.organizations, public.organization_entitlements,
  public.organization_members, public.organization_invitations, public.organization_settings,
  public.provisioning_records, public.audit_events
  to service_role;

create policy organizations_member_select
  on public.organizations
  for select
  to authenticated
  using (public.crm_active_member(id));

create policy entitlements_member_select
  on public.organization_entitlements
  for select
  to authenticated
  using (public.crm_active_member(organization_id));

create policy settings_member_select
  on public.organization_settings
  for select
  to authenticated
  using (public.crm_active_member(organization_id));

create policy members_member_select
  on public.organization_members
  for select
  to authenticated
  using (public.crm_active_member(organization_id) and status = 'active');

revoke all on function public.crm_active_member(uuid) from public, anon;
grant execute on function public.crm_active_member(uuid) to authenticated, service_role;

revoke all on function public.crm_enforce_entitlements() from public, anon, authenticated;
revoke all on function public.crm_enforce_member_cap() from public, anon, authenticated;
revoke all on function public.crm_enforce_settings() from public, anon, authenticated;
grant execute on function public.crm_enforce_entitlements() to service_role;
grant execute on function public.crm_enforce_member_cap() to service_role;
grant execute on function public.crm_enforce_settings() to service_role;

revoke all on function public.crm_provision_organization(uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_accept_invitation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_reissue_invitation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_set_organization_status(uuid, text, text) from public, anon, authenticated;

grant execute on function public.crm_provision_organization(uuid, text, text) to service_role;
grant execute on function public.crm_accept_invitation(uuid, text, text) to service_role;
grant execute on function public.crm_reissue_invitation(uuid, text, text) to service_role;
grant execute on function public.crm_set_organization_status(uuid, text, text) to service_role;

commit;
