-- Development migration. Do not apply to production until this migration has been checked on a copy.
-- Depends on 20261104120000_public_booking.sql and 20261030140000_crm_customers.sql.
-- A website + CRM booking links the guest to one active customer and marks that customer booked.
-- Messages are queued only when the package includes them. This file does not call an email provider.

begin;

create table public.booking_customer_intents (
  organization_id uuid not null references public.organizations(id),
  email text not null,
  display_name text not null,
  phone text not null,
  primary key (organization_id, email)
);

comment on table public.booking_customer_intents is
  'Short-lived permit so a guest booking can write one matching customer. Removed before the booking function returns.';

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  appointment_id uuid not null references public.appointments(id),
  kind text not null check (kind in ('confirmation', 'reminder')),
  recipient_email text not null check (
    length(recipient_email) between 3 and 320
    and recipient_email = lower(recipient_email)
    and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  subject text not null check (length(subject) between 1 and 200),
  body text not null check (length(body) between 1 and 4000),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  lease_id uuid,
  lease_until timestamptz,
  last_error text check (last_error is null or length(last_error) <= 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, kind)
);

create index booking_messages_due
  on public.booking_messages (scheduled_for, id)
  where status = 'pending';

comment on table public.booking_messages is
  'One confirmation and, when a template is saved, one reminder per appointment. Delivery is at-least-once.';

alter table public.appointments
  add column customer_id uuid;

alter table public.appointments
  add constraint appointments_same_customer
  foreign key (customer_id, organization_id)
  references public.customers (id, organization_id);

create or replace function public.crm_prepare_customer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  enabled boolean;
  seat_cap integer;
  next_count integer;
  tag text;
  clean_tags text[] := '{}';
  guest_link boolean;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization cannot change';
  end if;
  new.display_name := btrim(new.display_name);
  if new.email is not null then
    new.email := lower(btrim(new.email));
    if new.email = '' then
      new.email := null;
    end if;
  end if;
  if new.phone is not null then
    new.phone := btrim(new.phone);
    if new.phone = '' then
      new.phone := null;
    end if;
  end if;
  if new.tags is null then
    new.tags := '{}';
  end if;
  if cardinality(new.tags) > 20 then
    raise exception 'too many tags';
  end if;
  foreach tag in array new.tags loop
    tag := lower(btrim(tag));
    if tag is null or tag = '' then
      continue;
    end if;
    if length(tag) > 40 or tag ~ '[^a-z0-9 -]' then
      raise exception 'invalid tag';
    end if;
    if not tag = any(clean_tags) then
      clean_tags := clean_tags || tag;
    end if;
  end loop;
  new.tags := clean_tags;
  guest_link := false;
  if not public.crm_active_member(new.organization_id) then
    if tg_op = 'INSERT' then
      guest_link := exists (
        select 1
        from public.booking_customer_intents i
        where i.organization_id = new.organization_id
          and i.email = new.email
          and i.display_name = new.display_name
          and i.phone = new.phone
      );
      if guest_link and (
        new.lead_stage is distinct from 'booked'
        or new.status is distinct from 'active'
        or cardinality(new.tags) > 0
      ) then
        guest_link := false;
      end if;
    else
      guest_link := exists (
        select 1
        from public.booking_customer_intents i
        where i.organization_id = new.organization_id
          and i.email = new.email
      );
      if guest_link and (
        new.display_name is distinct from old.display_name
        or new.email is distinct from old.email
        or new.phone is distinct from old.phone
        or new.status is distinct from old.status
        or new.tags is distinct from old.tags
        or new.lead_stage is distinct from 'booked'
      ) then
        guest_link := false;
      end if;
    end if;
    if not guest_link then
      raise exception 'customer directory is not included';
    end if;
  end if;
  select e.crm_enabled, e.max_customers into enabled, seat_cap
  from public.organization_entitlements e
  where e.organization_id = new.organization_id;
  if not found or enabled is not true or seat_cap is null or seat_cap <= 0 then
    raise exception 'customer directory is not included';
  end if;
  if tg_op = 'INSERT' then
    insert into public.customer_capacity (organization_id, customer_count)
    values (new.organization_id, 0)
    on conflict (organization_id) do nothing;
    update public.customer_capacity
      set customer_count = customer_count + 1
      where organization_id = new.organization_id
      returning customer_count into next_count;
    if next_count is null or next_count > seat_cap then
      raise exception 'customer cap exceeded';
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$fn$;

create or replace function public.crm_prepare_appointment()
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
       or new.customer_id is distinct from old.customer_id
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

create function public.booking_link_guest(
  p_organization_id uuid,
  p_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  enabled boolean;
  customer_id uuid;
begin
  select e.crm_enabled into enabled
  from public.organization_entitlements e
  where e.organization_id = p_organization_id;
  if enabled is not true then
    return null;
  end if;
  insert into public.booking_customer_intents (organization_id, email, display_name, phone)
  values (p_organization_id, p_email, p_name, p_phone);
  select c.id into customer_id
  from public.customers c
  where c.organization_id = p_organization_id
    and c.email = p_email
    and c.status = 'active'
  order by c.created_at
  limit 1;
  if found then
    update public.customers
      set lead_stage = 'booked'
      where id = customer_id
        and lead_stage is distinct from 'booked';
  else
    begin
      insert into public.customers (organization_id, display_name, email, phone, status, lead_stage)
      values (p_organization_id, p_name, p_email, p_phone, 'active', 'booked')
      returning id into customer_id;
    exception
      when unique_violation then
        select c.id into customer_id
        from public.customers c
        where c.organization_id = p_organization_id
          and c.email = p_email
          and c.status = 'active'
        limit 1;
        if customer_id is null then
          raise;
        end if;
        update public.customers
          set lead_stage = 'booked'
          where id = customer_id
            and lead_stage is distinct from 'booked';
      when others then
        if sqlerrm = 'customer cap exceeded' then
          customer_id := null;
        else
          raise;
        end if;
    end;
  end if;
  delete from public.booking_customer_intents
  where organization_id = p_organization_id
    and email = p_email;
  return customer_id;
end;
$fn$;

create function public.booking_queue_messages(p_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  appt public.appointments;
  business text;
  service_name text;
  template text;
  messages_on boolean;
  cap integer;
  tz text;
  used integer;
  when_text text;
begin
  select * into appt from public.appointments where id = p_appointment_id;
  if not found or appt.status <> 'confirmed' then
    return false;
  end if;
  select e.messages_enabled, e.email_cap, settings.business_name, settings.timezone, settings.reminder_template, svc.name
    into messages_on, cap, business, tz, template, service_name
  from public.organization_entitlements e
  join public.organization_settings settings on settings.organization_id = e.organization_id
  join public.services svc on svc.id = appt.service_id
  where e.organization_id = appt.organization_id;
  if not found or messages_on is not true or cap is null or cap <= 0 then
    return false;
  end if;
  select count(*)::integer into used
  from public.booking_messages m
  where m.organization_id = appt.organization_id
    and m.status <> 'cancelled'
    and m.created_at >= (date_trunc('month', pg_catalog.now() at time zone tz) at time zone tz);
  if used >= cap then
    return false;
  end if;
  when_text := pg_catalog.to_char(appt.starts_at at time zone tz, 'FMDay, FMMonth FMDD, YYYY, HH12:MI AM') || ' ' || tz;
  insert into public.booking_messages (
    organization_id, appointment_id, kind, recipient_email, subject, body, scheduled_for
  ) values (
    appt.organization_id,
    appt.id,
    'confirmation',
    appt.guest_email,
    pg_catalog.left('Appointment confirmed — ' || business, 200),
    pg_catalog.left('Your appointment is confirmed.' || E'\n\n' || service_name || ' with ' || business || E'\n' || when_text, 4000),
    pg_catalog.now()
  );
  if template is not null
     and appt.starts_at > pg_catalog.now() + interval '24 hours'
     and used + 1 < cap then
    insert into public.booking_messages (
      organization_id, appointment_id, kind, recipient_email, subject, body, scheduled_for
    ) values (
      appt.organization_id,
      appt.id,
      'reminder',
      appt.guest_email,
      pg_catalog.left('Appointment reminder — ' || business, 200),
      pg_catalog.left(service_name || ' with ' || business || ' on ' || when_text || E'\n\n' || template, 4000),
      appt.starts_at - interval '24 hours'
    );
  end if;
  return true;
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

create function public.booking_cancel_messages()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
begin
  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
    update public.booking_messages
      set status = 'cancelled',
          lease_until = null
      where appointment_id = new.id
        and status in ('pending', 'processing')
        and sent_at is null;
  end if;
  return new;
end;
$fn$;

create trigger appointments_cancel_messages
  after update on public.appointments
  for each row execute function public.booking_cancel_messages();

create function public.booking_messages_claim(p_limit integer default 10)
returns setof public.booking_messages
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'invalid limit';
  end if;
  update public.booking_messages
    set status = 'failed',
        lease_until = null,
        last_error = coalesce(last_error, 'delivery lease expired after final attempt')
    where status = 'processing'
      and lease_until < pg_catalog.now()
      and attempts >= 8;
  return query
    with due as (
      select id
      from public.booking_messages
      where (
        (status = 'pending' and scheduled_for <= pg_catalog.now())
        or (status = 'processing' and lease_until < pg_catalog.now())
      )
        and attempts < 8
      order by scheduled_for, id
      for update skip locked
      limit p_limit
    )
    update public.booking_messages m
      set status = 'processing',
          attempts = attempts + 1,
          lease_id = gen_random_uuid(),
          lease_until = pg_catalog.now() + interval '5 minutes'
      from due
      where m.id = due.id
      returning m.*;
end;
$fn$;

create function public.booking_messages_finish(
  p_message_id uuid,
  p_lease_id uuid,
  p_success boolean,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  message public.booking_messages;
begin
  select * into message from public.booking_messages where id = p_message_id for update;
  if not found or p_success is null or p_lease_id is null or message.lease_id is distinct from p_lease_id then
    raise exception 'invalid lease';
  end if;
  if message.status = 'sent' and p_success then
    return pg_catalog.jsonb_build_object('status', 'sent', 'duplicate', true);
  end if;
  if message.status = 'cancelled' then
    return pg_catalog.jsonb_build_object('status', 'cancelled', 'duplicate', false);
  end if;
  if message.status <> 'processing' or message.lease_until <= pg_catalog.now() then
    raise exception 'stale lease';
  end if;
  update public.booking_messages
    set status = case
          when p_success then 'sent'
          when attempts >= 8 then 'failed'
          else 'pending'
        end,
        sent_at = case when p_success then pg_catalog.now() else sent_at end,
        last_error = case
          when p_success then null
          else pg_catalog.left(coalesce(p_error, 'delivery failed'), 500)
        end,
        scheduled_for = case
          when p_success then scheduled_for
          else pg_catalog.now() + pg_catalog.make_interval(secs => least(3600, 30 * pg_catalog.power(2, least(attempts, 6))::integer))
        end,
        lease_until = null
    where id = message.id
    returning * into message;
  return pg_catalog.jsonb_build_object('status', message.status, 'duplicate', false, 'attempts', message.attempts);
end;
$fn$;

grant create on schema public to service_role;
alter function public.crm_prepare_customer() owner to service_role;
alter function public.crm_prepare_appointment() owner to service_role;
alter function public.booking_link_guest(uuid, text, text, text) owner to service_role;
alter function public.booking_queue_messages(uuid) owner to service_role;
alter function public.booking_create_appointment(text, uuid, timestamptz, text, text, text, text) owner to service_role;
alter function public.booking_cancel_messages() owner to service_role;
alter function public.booking_messages_claim(integer) owner to service_role;
alter function public.booking_messages_finish(uuid, uuid, boolean, text) owner to service_role;
revoke create on schema public from service_role;

alter table public.booking_customer_intents enable row level security;
alter table public.booking_customer_intents force row level security;
alter table public.booking_messages enable row level security;
alter table public.booking_messages force row level security;

revoke all on public.booking_customer_intents from public, anon, authenticated;
revoke all on public.booking_messages from public, anon, authenticated;
grant select, insert, update, delete on public.booking_customer_intents to service_role;
grant select, insert, update, delete on public.booking_messages to service_role;

revoke all on function public.booking_link_guest(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.booking_queue_messages(uuid) from public, anon, authenticated;
revoke all on function public.booking_cancel_messages() from public, anon;
revoke all on function public.booking_messages_claim(integer) from public, anon, authenticated;
revoke all on function public.booking_messages_finish(uuid, uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.booking_link_guest(uuid, text, text, text) to service_role;
grant execute on function public.booking_queue_messages(uuid) to service_role;
grant execute on function public.booking_cancel_messages() to authenticated, service_role;
grant execute on function public.booking_messages_claim(integer) to service_role;
grant execute on function public.booking_messages_finish(uuid, uuid, boolean, text) to service_role;

commit;
