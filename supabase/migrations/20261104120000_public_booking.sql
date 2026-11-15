-- Pending review. Do not apply to production until this migration has been checked on a copy.
-- Depends on 20261103160000_booking_setup.sql.
-- A guest books with a public slug. The browser does not choose an organization id.
-- Confirmed appointments on one calendar cannot overlap. The calendar row is locked for the write.
-- btree_gist is added when the server provides it. Local test databases may not, so the lock remains required.
-- No guest payment is stored here.

begin;

alter table public.organization_settings
  add column booking_published boolean not null default false;

create unique index services_id_organization on public.services (id, organization_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  calendar_id uuid not null,
  service_id uuid not null,
  guest_name text not null check (length(btrim(guest_name)) between 1 and 200),
  guest_email text not null check (
    length(guest_email) between 3 and 320
    and guest_email = lower(guest_email)
    and guest_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  guest_phone text not null check (length(btrim(guest_phone)) between 1 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (
    length(timezone) between 1 and 64
    and timezone ~ '^[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)*$'
  ),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (organization_id, idempotency_key),
  constraint appointments_same_calendar
    foreign key (calendar_id, organization_id)
    references public.calendars (id, organization_id),
  constraint appointments_service_fk
    foreign key (service_id)
    references public.services (id),
  constraint appointments_same_service
    foreign key (service_id, organization_id)
    references public.services (id, organization_id)
);

create index appointments_calendar_span
  on public.appointments (calendar_id, starts_at, ends_at)
  where status = 'confirmed';

create index appointments_org_start
  on public.appointments (organization_id, starts_at);

comment on table public.appointments is
  'One guest booking. The timezone is the business timezone used when the guest chose the time.';

do $extend$
begin
  create extension if not exists btree_gist;
exception
  when feature_not_supported then
    null;
end
$extend$;

do $constraint$
begin
  if exists (select 1 from pg_extension where extname = 'btree_gist') then
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        calendar_id with =,
        tstzrange(starts_at, ends_at, '[)') with &&
      )
      where (status = 'confirmed');
  end if;
end
$constraint$;

create or replace function public.crm_enforce_settings()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn$
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
  if new.booking_published and (tg_op = 'INSERT' or not old.booking_published) then
    if not exists (
      select 1 from public.services s
      where s.organization_id = new.organization_id and s.active
    ) then
      raise exception 'publish requires a service';
    end if;
    if not exists (
      select 1 from public.weekly_hours h
      where h.organization_id = new.organization_id
    ) then
      raise exception 'publish requires weekly hours';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$fn$;

create function public.crm_prepare_appointment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  duration integer;
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id
       or new.calendar_id is distinct from old.calendar_id
       or new.service_id is distinct from old.service_id
       or new.starts_at is distinct from old.starts_at
       or new.ends_at is distinct from old.ends_at
       or new.guest_name is distinct from old.guest_name
       or new.guest_email is distinct from old.guest_email
       or new.guest_phone is distinct from old.guest_phone
       or new.timezone is distinct from old.timezone
       or new.idempotency_key is distinct from old.idempotency_key
       or not (old.status = 'confirmed' and new.status = 'cancelled')
    then
      raise exception 'appointment cannot change';
    end if;
    if not public.crm_active_member(old.organization_id) then
      raise exception 'booking is not available';
    end if;
    return new;
  end if;
  perform 1
  from public.calendars
  where id = new.calendar_id
    and organization_id = new.organization_id
  for update;
  if not found then
    raise exception 'calendar is not in this organization';
  end if;
  select s.duration_minutes into duration
  from public.services s
  where s.id = new.service_id
    and s.organization_id = new.organization_id
    and s.active;
  if not found or new.ends_at <> new.starts_at + pg_catalog.make_interval(mins => duration) then
    raise exception 'slot is not open';
  end if;
  if exists (
    select 1
    from public.appointments a
    where a.calendar_id = new.calendar_id
      and a.status = 'confirmed'
      and a.starts_at < new.ends_at
      and a.ends_at > new.starts_at
  ) then
    raise exception 'appointment conflict';
  end if;
  return new;
end;
$fn$;

create trigger appointments_prepare
  before insert or update on public.appointments
  for each row execute function public.crm_prepare_appointment();

create function public.booking_slot_is_open(p_organization_id uuid, p_service_id uuid, p_starts_at timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $fn$
declare
  tz text;
  duration integer;
  calendar uuid;
  local_ts timestamp;
  local_minute integer;
  weekday_index integer;
  window_start integer;
  window_end integer;
begin
  if p_starts_at is null or p_starts_at <= pg_catalog.now() then
    return false;
  end if;
  select s.duration_minutes, c.id, settings.timezone
    into duration, calendar, tz
  from public.services s
  join public.calendars c on c.organization_id = s.organization_id
  join public.organization_settings settings on settings.organization_id = s.organization_id
  join public.organizations o on o.id = s.organization_id
  where s.id = p_service_id
    and s.organization_id = p_organization_id
    and s.active
    and o.status = 'active'
    and settings.booking_published;
  if not found then
    return false;
  end if;
  local_ts := p_starts_at at time zone tz;
  if pg_catalog.date_trunc('minute', local_ts) <> local_ts then
    return false;
  end if;
  local_minute := (pg_catalog.date_part('hour', local_ts)::integer * 60) + pg_catalog.date_part('minute', local_ts)::integer;
  weekday_index := pg_catalog.date_part('dow', local_ts)::integer;
  select h.start_minute, h.end_minute into window_start, window_end
  from public.weekly_hours h
  where h.calendar_id = calendar
    and h.organization_id = p_organization_id
    and h.weekday = weekday_index;
  if not found or local_minute < window_start or local_minute + duration > window_end then
    return false;
  end if;
  if (local_minute - window_start) % duration <> 0 then
    return false;
  end if;
  if exists (
    select 1
    from public.appointments a
    where a.calendar_id = calendar
      and a.status = 'confirmed'
      and a.starts_at < p_starts_at + pg_catalog.make_interval(mins => duration)
      and a.ends_at > p_starts_at
  ) then
    return false;
  end if;
  return true;
end;
$fn$;

create function public.booking_public_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $fn$
declare
  org_id uuid;
  cfg public.organization_settings;
  service_rows jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug) > 63 then
    return null;
  end if;
  select o.id into org_id
  from public.organizations o
  join public.organization_settings page on page.organization_id = o.id
  where o.slug = p_slug
    and o.status = 'active'
    and page.booking_published;
  if not found then
    return null;
  end if;
  select * into cfg from public.organization_settings where organization_id = org_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'description', s.description,
    'duration_minutes', s.duration_minutes
  ) order by s.name), '[]'::jsonb)
  into service_rows
  from public.services s
  where s.organization_id = org_id
    and s.active;
  return jsonb_build_object(
    'slug', p_slug,
    'business_name', cfg.business_name,
    'phone', cfg.phone,
    'email', cfg.email,
    'location', cfg.location,
    'brand_primary', cfg.brand_primary,
    'brand_accent', cfg.brand_accent,
    'policies', cfg.policies,
    'booking_intro', cfg.booking_intro,
    'timezone', cfg.timezone,
    'services', service_rows
  );
end;
$fn$;

create function public.booking_open_slots(p_slug text, p_service_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $fn$
declare
  org_id uuid;
  tz text;
  duration integer;
  calendar uuid;
  day_offset integer;
  local_date date;
  weekday_index integer;
  window_start integer;
  window_end integer;
  minute integer;
  slot_start timestamptz;
  slot_end timestamptz;
  slots jsonb := '[]'::jsonb;
begin
  if p_slug is null or p_service_id is null then
    return '[]'::jsonb;
  end if;
  select o.id, settings.timezone, s.duration_minutes, c.id
    into org_id, tz, duration, calendar
  from public.organizations o
  join public.organization_settings settings on settings.organization_id = o.id
  join public.services s on s.organization_id = o.id and s.id = p_service_id and s.active
  join public.calendars c on c.organization_id = o.id
  where o.slug = p_slug
    and o.status = 'active'
    and settings.booking_published;
  if not found then
    return '[]'::jsonb;
  end if;
  for day_offset in 0..13 loop
    exit when pg_catalog.jsonb_array_length(slots) >= 80;
    local_date := ((pg_catalog.now() at time zone tz)::date + day_offset);
    weekday_index := pg_catalog.date_part('dow', local_date)::integer;
    select h.start_minute, h.end_minute into window_start, window_end
    from public.weekly_hours h
    where h.calendar_id = calendar
      and h.organization_id = org_id
      and h.weekday = weekday_index;
    if not found then
      continue;
    end if;
    minute := window_start;
    while minute + duration <= window_end and pg_catalog.jsonb_array_length(slots) < 80 loop
      slot_start := (local_date::timestamp + pg_catalog.make_interval(mins => minute)) at time zone tz;
      slot_end := slot_start + pg_catalog.make_interval(mins => duration);
      if slot_start > pg_catalog.now() and not exists (
        select 1
        from public.appointments a
        where a.calendar_id = calendar
          and a.status = 'confirmed'
          and a.starts_at < slot_end
          and a.ends_at > slot_start
      ) then
        slots := slots || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'starts_at', slot_start,
          'ends_at', slot_end
        ));
      end if;
      minute := minute + duration;
    end loop;
  end loop;
  return slots;
end;
$fn$;

create function public.booking_create_appointment(
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
    if existing.service_id is distinct from p_service_id
       or existing.starts_at is distinct from p_starts_at
       or existing.guest_name is distinct from guest_name
       or existing.guest_email is distinct from guest_email
       or existing.guest_phone is distinct from guest_phone then
      raise exception 'idempotency conflict';
    end if;
    select s.name into service_name from public.services s where s.id = existing.service_id;
    return pg_catalog.jsonb_build_object(
      'appointment_id', existing.id,
      'starts_at', existing.starts_at,
      'ends_at', existing.ends_at,
      'timezone', existing.timezone,
      'service_name', service_name,
      'business_name', business,
      'duplicate', true
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
  begin
    insert into public.appointments (
      organization_id, calendar_id, service_id, guest_name, guest_email, guest_phone,
      starts_at, ends_at, timezone, status, idempotency_key
    ) values (
      org_id, calendar, p_service_id, guest_name, guest_email, guest_phone,
      p_starts_at, p_starts_at + pg_catalog.make_interval(mins => duration), tz, 'confirmed', p_idempotency_key
    )
    returning id into created_id;
  exception
    when unique_violation then
      select * into existing
      from public.appointments
      where organization_id = org_id
        and idempotency_key = p_idempotency_key;
      if not found
         or existing.service_id is distinct from p_service_id
         or existing.starts_at is distinct from p_starts_at
         or existing.guest_email is distinct from guest_email then
        raise exception 'idempotency conflict';
      end if;
      return pg_catalog.jsonb_build_object(
        'appointment_id', existing.id,
        'starts_at', existing.starts_at,
        'ends_at', existing.ends_at,
        'timezone', existing.timezone,
        'service_name', service_name,
        'business_name', business,
        'duplicate', true
      );
    when exclusion_violation then
      raise exception 'appointment conflict';
  end;
  return pg_catalog.jsonb_build_object(
    'appointment_id', created_id,
    'starts_at', p_starts_at,
    'ends_at', p_starts_at + pg_catalog.make_interval(mins => duration),
    'timezone', tz,
    'service_name', service_name,
    'business_name', business,
    'duplicate', false
  );
end;
$fn$;

grant create on schema public to service_role;
alter function public.booking_slot_is_open(uuid, uuid, timestamptz) owner to service_role;
alter function public.booking_public_page(text) owner to service_role;
alter function public.booking_open_slots(text, uuid) owner to service_role;
alter function public.booking_create_appointment(text, uuid, timestamptz, text, text, text, text) owner to service_role;
alter function public.crm_prepare_appointment() owner to service_role;
revoke create on schema public from service_role;

alter table public.appointments enable row level security;
alter table public.appointments force row level security;

revoke all on public.appointments from public, anon, authenticated;
grant select, update on public.appointments to authenticated;
grant select, insert, update, delete on public.appointments to service_role;

create policy appointments_member_select
  on public.appointments for select to authenticated
  using (public.crm_active_member(organization_id));

create policy appointments_member_update
  on public.appointments for update to authenticated
  using (public.crm_active_member(organization_id))
  with check (public.crm_active_member(organization_id));

revoke all on function public.booking_slot_is_open(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.booking_public_page(text) from public, anon, authenticated;
revoke all on function public.booking_open_slots(text, uuid) from public, anon, authenticated;
revoke all on function public.booking_create_appointment(text, uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
revoke all on function public.crm_prepare_appointment() from public, anon;

grant execute on function public.booking_slot_is_open(uuid, uuid, timestamptz) to service_role;
grant execute on function public.booking_public_page(text) to anon, authenticated, service_role;
grant execute on function public.booking_open_slots(text, uuid) to anon, authenticated, service_role;
grant execute on function public.booking_create_appointment(text, uuid, timestamptz, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.crm_prepare_appointment() to authenticated, service_role;

commit;
