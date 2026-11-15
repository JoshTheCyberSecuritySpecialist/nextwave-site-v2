-- Pending. Do not apply until the customer directory is approved.
-- Depends on 20261029120100_crm_foundation.sql.
-- Booking-only workspaces have crm_enabled = false and max_customers = 0.
-- Archived customers keep a capacity slot. Archiving does not free a record or block reuse of that email.
-- Inserts reserve a slot by updating one customer_capacity row. That row lock is held until the
-- transaction ends, so concurrent inserts for the same organization cannot pass the same cap.

begin;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  display_name text not null check (length(btrim(display_name)) between 1 and 200),
  email text check (
    email is null or (
      length(email) between 3 and 320
      and email = lower(email)
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  phone text check (phone is null or length(btrim(phone)) between 1 and 40),
  status text not null default 'active' check (status in ('active', 'archived')),
  lead_stage text not null default 'inquiry' check (lead_stage in ('inquiry', 'booked', 'completed')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index customers_org_email
  on public.customers (organization_id, email)
  where email is not null and status <> 'archived';

create unique index customers_id_organization
  on public.customers (id, organization_id);

create index customers_org_directory
  on public.customers (organization_id, status, display_name);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint customer_notes_same_organization
    foreign key (customer_id, organization_id)
    references public.customers (id, organization_id)
);

create index customer_notes_customer on public.customer_notes (customer_id, created_at desc);

create table public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  customer_id uuid not null,
  kind text not null check (kind in ('created', 'updated', 'note')),
  summary text not null check (length(summary) between 1 and 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint customer_activities_same_organization
    foreign key (customer_id, organization_id)
    references public.customers (id, organization_id)
);

create index customer_activities_customer on public.customer_activities (customer_id, created_at desc);
create index customer_activities_org on public.customer_activities (organization_id, created_at desc);

create table public.customer_capacity (
  organization_id uuid primary key references public.organizations(id),
  customer_count integer not null default 0 check (customer_count >= 0)
);

comment on table public.customer_capacity is
  'One counter per organization. Every customer insert consumes a slot, including a customer that is later archived.';

create function public.crm_directory_enabled(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.crm_active_member(p_org)
    and exists (
      select 1 from public.organization_entitlements e
      where e.organization_id = p_org
        and e.crm_enabled
        and e.max_customers > 0
    );
$$;

create function public.crm_prepare_customer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  enabled boolean;
  seat_cap integer;
  next_count integer;
  tag text;
  clean_tags text[] := '{}';
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
  if not public.crm_active_member(new.organization_id) then
    raise exception 'customer directory is not included';
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
$$;

create trigger customers_prepare
  before insert or update on public.customers
  for each row execute function public.crm_prepare_customer();

create function public.crm_record_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed text := '';
begin
  if tg_op = 'INSERT' then
    insert into public.customer_activities (organization_id, customer_id, kind, summary, created_by)
    values (new.organization_id, new.id, 'created', 'Customer record created', auth.uid());
    return new;
  end if;
  if new.display_name is distinct from old.display_name then changed := changed || 'name, '; end if;
  if new.email is distinct from old.email then changed := changed || 'email, '; end if;
  if new.phone is distinct from old.phone then changed := changed || 'phone, '; end if;
  if new.status is distinct from old.status then changed := changed || 'status, '; end if;
  if new.lead_stage is distinct from old.lead_stage then changed := changed || 'stage, '; end if;
  if new.tags is distinct from old.tags then changed := changed || 'tags, '; end if;
  if changed <> '' then
    insert into public.customer_activities (organization_id, customer_id, kind, summary, created_by)
    values (
      new.organization_id,
      new.id,
      'updated',
      pg_catalog.left(pg_catalog.rtrim(changed, ', ') || ' updated', 200),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger customers_activity
  after insert or update on public.customers
  for each row execute function public.crm_record_customer_activity();

create function public.crm_prepare_note()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  customer_org uuid;
begin
  new.body := btrim(new.body);
  new.created_by := auth.uid();
  select organization_id into customer_org
  from public.customers
  where id = new.customer_id
    and organization_id = new.organization_id;
  if customer_org is null then
    raise exception 'customer is not in this organization';
  end if;
  return new;
end;
$$;

create trigger customer_notes_prepare
  before insert on public.customer_notes
  for each row execute function public.crm_prepare_note();

create function public.crm_record_note_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.customer_activities (organization_id, customer_id, kind, summary, created_by)
  values (new.organization_id, new.customer_id, 'note', 'Note added', new.created_by);
  return new;
end;
$$;

create trigger customer_notes_activity
  after insert on public.customer_notes
  for each row execute function public.crm_record_note_activity();

-- Hosted Postgres requires the new owner to hold CREATE on the schema during OWNER TO.
-- The direct grant is removed after the change. Inherited privileges are left as they were.
grant create on schema public to service_role;
alter function public.crm_directory_enabled(uuid) owner to service_role;
alter function public.crm_prepare_customer() owner to service_role;
alter function public.crm_record_customer_activity() owner to service_role;
alter function public.crm_record_note_activity() owner to service_role;
revoke create on schema public from service_role;

alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.customer_activities enable row level security;
alter table public.customer_capacity enable row level security;
alter table public.customers force row level security;
alter table public.customer_notes force row level security;
alter table public.customer_activities force row level security;
alter table public.customer_capacity force row level security;

revoke all on public.customers, public.customer_notes, public.customer_activities, public.customer_capacity
  from public, anon, authenticated;

grant select, insert, update on public.customers to authenticated;
grant select, insert on public.customer_notes to authenticated;
grant select on public.customer_activities to authenticated;
grant select, insert, update, delete on public.customers, public.customer_notes, public.customer_activities to service_role;
grant select, insert, update on public.customer_capacity to service_role;

create policy customers_directory_select
  on public.customers for select to authenticated
  using (public.crm_directory_enabled(organization_id));

create policy customers_directory_insert
  on public.customers for insert to authenticated
  with check (public.crm_directory_enabled(organization_id));

create policy customers_directory_update
  on public.customers for update to authenticated
  using (public.crm_directory_enabled(organization_id))
  with check (public.crm_directory_enabled(organization_id));

create policy customer_notes_select
  on public.customer_notes for select to authenticated
  using (public.crm_directory_enabled(organization_id));

create policy customer_notes_insert
  on public.customer_notes for insert to authenticated
  with check (public.crm_directory_enabled(organization_id));

create policy customer_activities_select
  on public.customer_activities for select to authenticated
  using (public.crm_directory_enabled(organization_id));

revoke all on function public.crm_directory_enabled(uuid) from public, anon;
revoke all on function public.crm_prepare_customer() from public, anon;
revoke all on function public.crm_prepare_note() from public, anon;
revoke all on function public.crm_record_customer_activity() from public, anon;
revoke all on function public.crm_record_note_activity() from public, anon;

grant execute on function public.crm_directory_enabled(uuid) to authenticated, service_role;
grant execute on function public.crm_prepare_customer() to authenticated, service_role;
grant execute on function public.crm_prepare_note() to authenticated, service_role;
grant execute on function public.crm_record_customer_activity() to authenticated, service_role;
grant execute on function public.crm_record_note_activity() to authenticated, service_role;

commit;
