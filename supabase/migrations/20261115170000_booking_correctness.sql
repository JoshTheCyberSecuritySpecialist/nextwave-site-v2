-- Pending review. Do not apply to production until this migration has been checked on a copy.
-- Depends on 20261104120000_public_booking.sql.
-- Does not change package prices, entitlements, Stripe mode, or charge type.
-- A cancelled booking must not be replayed as a confirmed appointment.
-- Open times cover the next 14 days instead of stopping after 80 slots.
-- Local times that do not exist, or that fold onto another offset, are skipped.
-- Weekly hours and the stored schedule copy are replaced in one transaction.

begin;

create or replace function public.booking_slot_is_open(p_organization_id uuid, p_service_id uuid, p_starts_at timestamptz)
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
  -- Rejects the second offset of a repeated hour and any instant that does not
  -- display as the local time used for the weekly grid.
  if (local_ts at time zone tz) is distinct from p_starts_at then
    return false;
  end if;
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

create or replace function public.booking_open_slots(p_slug text, p_service_id uuid)
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
  day_count integer;
  local_date date;
  weekday_index integer;
  window_start integer;
  window_end integer;
  minute integer;
  expected_local timestamp;
  slot_start timestamptz;
  slot_end timestamptz;
  slot_index integer;
  blocked boolean;
  taken_start timestamptz[];
  taken_end timestamptz[];
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
  select coalesce(array_agg(a.starts_at), '{}'::timestamptz[]), coalesce(array_agg(a.ends_at), '{}'::timestamptz[])
    into taken_start, taken_end
  from public.appointments a
  where a.calendar_id = calendar
    and a.status = 'confirmed'
    and a.ends_at > pg_catalog.now()
    and a.starts_at < pg_catalog.now() + interval '15 days';
  for day_offset in 0..13 loop
    exit when pg_catalog.jsonb_array_length(slots) >= 1680;
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
    day_count := 0;
    while minute + duration <= window_end and day_count < 120 and pg_catalog.jsonb_array_length(slots) < 1680 loop
      expected_local := local_date::timestamp + pg_catalog.make_interval(mins => minute);
      slot_start := expected_local at time zone tz;
      if (slot_start at time zone tz) is distinct from expected_local then
        minute := minute + duration;
        continue;
      end if;
      slot_end := slot_start + pg_catalog.make_interval(mins => duration);
      blocked := slot_start <= pg_catalog.now();
      if not blocked then
        for slot_index in 1..coalesce(pg_catalog.array_length(taken_start, 1), 0) loop
          if taken_start[slot_index] < slot_end and taken_end[slot_index] > slot_start then
            blocked := true;
            exit;
          end if;
        end loop;
      end if;
      if not blocked then
        slots := slots || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'starts_at', slot_start,
          'ends_at', slot_end
        ));
        day_count := day_count + 1;
      end if;
      minute := minute + duration;
    end loop;
  end loop;
  return slots;
end;
$fn$;

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
    if existing.status is distinct from 'confirmed' then
      raise exception 'booking was cancelled';
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
         or existing.guest_name is distinct from guest_name
         or existing.guest_email is distinct from guest_email
         or existing.guest_phone is distinct from guest_phone then
        raise exception 'idempotency conflict';
      end if;
      if existing.status is distinct from 'confirmed' then
        raise exception 'booking was cancelled';
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

create function public.crm_replace_weekly_hours(p_organization_id uuid, p_windows jsonb)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $fn$
declare
  cal uuid;
  item jsonb;
  seen boolean[] := array[false, false, false, false, false, false, false];
  day_index integer;
  start_minute integer;
  end_minute integer;
  window_count integer;
begin
  if not public.crm_active_member(p_organization_id) then
    raise exception 'booking setup is not available';
  end if;
  if p_windows is null or pg_catalog.jsonb_typeof(p_windows) <> 'array' then
    raise exception 'hours must be a weekly schedule';
  end if;
  window_count := pg_catalog.jsonb_array_length(p_windows);
  if window_count > 7 then
    raise exception 'hours must be a weekly schedule';
  end if;
  for item in select value from pg_catalog.jsonb_array_elements(p_windows) loop
    begin
      day_index := (item->>'weekday')::integer;
      start_minute := (item->>'start_minute')::integer;
      end_minute := (item->>'end_minute')::integer;
    exception
      when invalid_text_representation then
        raise exception 'hours must be a weekly schedule';
    end;
    if day_index is null or day_index < 0 or day_index > 6 or seen[day_index + 1] then
      raise exception 'hours must be a weekly schedule';
    end if;
    if start_minute is null or end_minute is null
       or start_minute < 0 or start_minute > 1439
       or end_minute < 1 or end_minute > 1440
       or end_minute <= start_minute then
      raise exception 'hours must be a weekly schedule';
    end if;
    seen[day_index + 1] := true;
  end loop;

  select id into cal
  from public.calendars
  where organization_id = p_organization_id
  for update;
  if not found then
    if window_count = 0 then
      update public.organization_settings
        set hours = '[]'::jsonb
        where organization_id = p_organization_id;
      if not found then
        raise exception 'booking setup is not available';
      end if;
      return;
    end if;
    insert into public.calendars (organization_id, name)
    values (p_organization_id, 'Staff calendar')
    returning id into cal;
  end if;

  delete from public.weekly_hours
  where organization_id = p_organization_id
    and calendar_id = cal
    and not (weekday in (
      select (value->>'weekday')::smallint
      from pg_catalog.jsonb_array_elements(p_windows)
    ));

  insert into public.weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute)
  select p_organization_id,
         cal,
         (value->>'weekday')::smallint,
         (value->>'start_minute')::smallint,
         (value->>'end_minute')::smallint
  from pg_catalog.jsonb_array_elements(p_windows)
  on conflict (calendar_id, weekday) do update
    set start_minute = excluded.start_minute,
        end_minute = excluded.end_minute;

  update public.organization_settings
    set hours = p_windows
    where organization_id = p_organization_id;
  if not found then
    raise exception 'booking setup is not available';
  end if;
end;
$fn$;

revoke all on function public.crm_replace_weekly_hours(uuid, jsonb) from public, anon;
grant execute on function public.crm_replace_weekly_hours(uuid, jsonb) to authenticated, service_role;

commit;
