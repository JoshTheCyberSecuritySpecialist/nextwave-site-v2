-- Pending. Do not apply until booking setup is approved.
-- Depends on 20261030140000_crm_customers.sql.
-- One staff calendar per organization. Website + CRM stops at 10 services.
-- Booking-only has no numeric service cap. This migration does not add one.
-- Active members can update organization settings. Reminder text stays blocked when messages are disabled.

begin;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 1000),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_org_directory on public.services (organization_id, active, name);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  name text not null default 'Staff calendar' check (length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index calendars_id_organization on public.calendars (id, organization_id);

comment on table public.calendars is
  'One staff calendar per organization. Both packages stay at one calendar.';

create table public.weekly_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  calendar_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440 and end_minute > start_minute),
  unique (calendar_id, weekday),
  constraint weekly_hours_same_organization
    foreign key (calendar_id, organization_id)
    references public.calendars (id, organization_id)
);

create table public.service_capacity (
  organization_id uuid primary key references public.organizations(id),
  service_count integer not null default 0 check (service_count >= 0)
);

comment on table public.service_capacity is
  'One counter per organization. A service insert consumes a slot. Deleting that service releases the slot. A null max_services entitlement is not a cap.';

create function public.crm_prepare_service()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  seat_cap integer;
  next_count integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization cannot change';
  end if;
  new.name := pg_catalog.btrim(new.name);
  if new.description is not null then
    new.description := pg_catalog.btrim(new.description);
    if new.description = '' then
      new.description := null;
    end if;
  end if;
  if not public.crm_active_member(new.organization_id) then
    raise exception 'booking setup is not available';
  end if;
  select e.max_services into seat_cap
  from public.organization_entitlements e
  where e.organization_id = new.organization_id;
  if not found then
    raise exception 'missing entitlements';
  end if;
  if tg_op = 'INSERT' then
    insert into public.service_capacity (organization_id, service_count)
    values (new.organization_id, 0)
    on conflict (organization_id) do nothing;
    update public.service_capacity
      set service_count = service_count + 1
      where organization_id = new.organization_id
      returning service_count into next_count;
    if next_count is null then
      raise exception 'missing service capacity';
    end if;
    if seat_cap is not null and next_count > seat_cap then
      raise exception 'service cap exceeded';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger services_prepare
  before insert or update on public.services
  for each row execute function public.crm_prepare_service();

create function public.crm_release_service()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.crm_active_member(old.organization_id) then
    raise exception 'booking setup is not available';
  end if;
  update public.service_capacity
    set service_count = service_count - 1
    where organization_id = old.organization_id
      and service_count > 0;
  return old;
end;
$$;

create trigger services_release
  before delete on public.services
  for each row execute function public.crm_release_service();

create function public.crm_prepare_calendar()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  seat_cap integer;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization cannot change';
  end if;
  new.name := pg_catalog.btrim(new.name);
  if not public.crm_active_member(new.organization_id) then
    raise exception 'booking setup is not available';
  end if;
  if tg_op = 'INSERT' then
    select e.max_calendars into seat_cap
    from public.organization_entitlements e
    where e.organization_id = new.organization_id
    for update;
    if not found or seat_cap is null or seat_cap < 1 then
      raise exception 'missing entitlements';
    end if;
    if exists (
      select 1 from public.calendars where organization_id = new.organization_id
    ) then
      raise exception 'calendar cap exceeded';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger calendars_prepare
  before insert or update on public.calendars
  for each row execute function public.crm_prepare_calendar();

create function public.crm_prepare_weekly_hours()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.calendar_id is distinct from old.calendar_id
  ) then
    raise exception 'organization cannot change';
  end if;
  if not public.crm_active_member(new.organization_id) then
    raise exception 'booking setup is not available';
  end if;
  if not exists (
    select 1 from public.calendars
    where id = new.calendar_id
      and organization_id = new.organization_id
  ) then
    raise exception 'calendar is not in this organization';
  end if;
  return new;
end;
$$;

create trigger weekly_hours_prepare
  before insert or update on public.weekly_hours
  for each row execute function public.crm_prepare_weekly_hours();

create or replace function public.crm_enforce_settings()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization cannot change';
  end if;
  new.business_name := pg_catalog.btrim(new.business_name);
  new.timezone := pg_catalog.btrim(new.timezone);
  if new.phone is not null then
    new.phone := pg_catalog.btrim(new.phone);
    if new.phone = '' then new.phone := null; end if;
  end if;
  if new.email is not null then
    new.email := pg_catalog.lower(pg_catalog.btrim(new.email));
    if new.email = '' then new.email := null; end if;
  end if;
  if new.location is not null then
    new.location := pg_catalog.btrim(new.location);
    if new.location = '' then new.location := null; end if;
  end if;
  if new.logo_path is not null then
    new.logo_path := pg_catalog.btrim(new.logo_path);
    if new.logo_path = '' then new.logo_path := null; end if;
  end if;
  if new.policies is not null then
    new.policies := pg_catalog.btrim(new.policies);
    if new.policies = '' then new.policies := null; end if;
  end if;
  if new.booking_intro is not null then
    new.booking_intro := pg_catalog.btrim(new.booking_intro);
    if new.booking_intro = '' then new.booking_intro := null; end if;
  end if;
  if new.brand_primary is not null then
    new.brand_primary := pg_catalog.upper(pg_catalog.btrim(new.brand_primary));
    if new.brand_primary = '' then new.brand_primary := null; end if;
  end if;
  if new.brand_accent is not null then
    new.brand_accent := pg_catalog.upper(pg_catalog.btrim(new.brand_accent));
    if new.brand_accent = '' then new.brand_accent := null; end if;
  end if;
  if new.reminder_template is not null then
    new.reminder_template := pg_catalog.btrim(new.reminder_template);
    if new.reminder_template = '' then new.reminder_template := null; end if;
  end if;
  if pg_catalog.jsonb_typeof(new.hours) not in ('object', 'array') then
    raise exception 'hours must be a weekly schedule';
  end if;
  if pg_catalog.octet_length(new.hours::text) > 8000 then
    raise exception 'hours are too large';
  end if;
  if new.reminder_template is not null
     and not exists (
       select 1 from public.organization_entitlements e
       where e.organization_id = new.organization_id and e.messages_enabled
     ) then
    raise exception 'messages are not included';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

grant create on schema public to service_role;
alter function public.crm_prepare_service() owner to service_role;
alter function public.crm_release_service() owner to service_role;
alter function public.crm_prepare_calendar() owner to service_role;
revoke create on schema public from service_role;

alter table public.services enable row level security;
alter table public.calendars enable row level security;
alter table public.weekly_hours enable row level security;
alter table public.service_capacity enable row level security;
alter table public.services force row level security;
alter table public.calendars force row level security;
alter table public.weekly_hours force row level security;
alter table public.service_capacity force row level security;

revoke all on public.services, public.calendars, public.weekly_hours, public.service_capacity
  from public, anon, authenticated;
revoke all on public.organization_settings from public, anon, authenticated;

grant select, insert, update, delete on public.services, public.calendars, public.weekly_hours to authenticated;
grant select, update on public.organization_settings to authenticated;
grant select, insert, update, delete on public.services, public.calendars, public.weekly_hours, public.service_capacity to service_role;
grant select, insert, update, delete on public.organization_settings to service_role;

create policy services_member_select
  on public.services for select to authenticated
  using (public.crm_active_member(organization_id));

create policy services_member_insert
  on public.services for insert to authenticated
  with check (public.crm_active_member(organization_id));

create policy services_member_update
  on public.services for update to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

create policy services_member_delete
  on public.services for delete to authenticated
  using (public.crm_active_member(organization_id));

create policy calendars_member_select
  on public.calendars for select to authenticated
  using (public.crm_active_member(organization_id));

create policy calendars_member_insert
  on public.calendars for insert to authenticated
  with check (public.crm_active_member(organization_id));

create policy calendars_member_update
  on public.calendars for update to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

create policy weekly_hours_member_select
  on public.weekly_hours for select to authenticated
  using (public.crm_active_member(organization_id));

create policy weekly_hours_member_insert
  on public.weekly_hours for insert to authenticated
  with check (public.crm_active_member(organization_id));

create policy weekly_hours_member_update
  on public.weekly_hours for update to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

create policy weekly_hours_member_delete
  on public.weekly_hours for delete to authenticated
  using (public.crm_active_member(organization_id));

create policy settings_member_update
  on public.organization_settings for update to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

revoke all on function public.crm_prepare_service() from public, anon;
revoke all on function public.crm_release_service() from public, anon;
revoke all on function public.crm_prepare_calendar() from public, anon;
revoke all on function public.crm_prepare_weekly_hours() from public, anon;
revoke all on function public.crm_enforce_settings() from public, anon;

grant execute on function public.crm_prepare_service() to authenticated, service_role;
grant execute on function public.crm_release_service() to authenticated, service_role;
grant execute on function public.crm_prepare_calendar() to authenticated, service_role;
grant execute on function public.crm_prepare_weekly_hours() to authenticated, service_role;
grant execute on function public.crm_enforce_settings() to authenticated, service_role;

commit;
