-- Pending review. Do not apply to production until checked on a copy.
-- Milestone 4: tenant website inquiries (no CRM customer create) + public page booking hints.

begin;

create table if not exists public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  website_id uuid not null references public.websites(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  email text not null check (
    length(email) between 3 and 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  phone text check (phone is null or length(btrim(phone)) between 7 and 40),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists website_inquiries_org_created
  on public.website_inquiries (organization_id, created_at desc);

comment on table public.website_inquiries is
  'Public website contact submissions. Never creates CRM customers.';

alter table public.website_inquiries enable row level security;
alter table public.website_inquiries force row level security;

revoke all on public.website_inquiries from public, anon, authenticated;
grant select on public.website_inquiries to authenticated;
grant select, insert on public.website_inquiries to service_role;

drop policy if exists website_inquiries_member_select on public.website_inquiries;
create policy website_inquiries_member_select
  on public.website_inquiries for select to authenticated
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = website_inquiries.organization_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create or replace function public.website_submit_inquiry(
  p_slug text,
  p_name text,
  p_email text,
  p_phone text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  site public.websites;
  org public.organizations;
  inquiry_id uuid;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  clean_body text := btrim(coalesce(p_body, ''));
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug) not between 3 and 63 then
    raise exception 'website not found';
  end if;
  if length(clean_name) < 1 or length(clean_name) > 120 then
    raise exception 'invalid inquiry';
  end if;
  if length(clean_email) < 3 or length(clean_email) > 254
     or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid inquiry';
  end if;
  if clean_phone is not null and (length(clean_phone) < 7 or length(clean_phone) > 40) then
    raise exception 'invalid inquiry';
  end if;
  if length(clean_body) < 1 or length(clean_body) > 4000 then
    raise exception 'invalid inquiry';
  end if;

  select * into site from public.websites where slug = p_slug;
  if not found or site.status <> 'published' or site.published_revision_id is null then
    raise exception 'website not found';
  end if;
  select * into org from public.organizations where id = site.organization_id;
  if not found or org.status <> 'active' then
    raise exception 'website not found';
  end if;
  if not exists (
    select 1 from public.organization_entitlements e
    where e.organization_id = org.id and e.website_enabled = true
  ) then
    raise exception 'website not found';
  end if;

  insert into public.website_inquiries (organization_id, website_id, name, email, phone, body)
  values (org.id, site.id, clean_name, clean_email, clean_phone, clean_body)
  returning id into inquiry_id;

  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    org.id, clean_email, 'website.inquiry_submitted', 'website_inquiry', inquiry_id,
    jsonb_build_object('website_id', site.id, 'slug', site.slug)
  );

  return jsonb_build_object(
    'id', inquiry_id,
    'organization_id', org.id,
    'created', true
  );
end;
$$;

create or replace function public.website_public_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  site public.websites;
  org public.organizations;
  rev public.website_revisions;
  ent public.organization_entitlements;
  settings public.organization_settings;
  booking_ok boolean := false;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or length(p_slug) not between 3 and 63 then
    return null;
  end if;
  select * into site from public.websites where slug = p_slug;
  if not found or site.status <> 'published' or site.published_revision_id is null then
    return null;
  end if;
  select * into org from public.organizations where id = site.organization_id;
  if not found or org.status <> 'active' then
    return null;
  end if;
  select * into rev from public.website_revisions where id = site.published_revision_id;
  if not found or rev.state <> 'published' then
    return null;
  end if;
  select * into ent from public.organization_entitlements where organization_id = org.id;
  select * into settings from public.organization_settings where organization_id = org.id;
  booking_ok := coalesce(settings.booking_published, false)
    and ent is not null
    and (ent.max_services is null or ent.max_services > 0);

  return jsonb_build_object(
    'slug', site.slug,
    'organization_name', org.name,
    'organization_slug', org.slug,
    'revision_id', rev.id,
    'revision_number', rev.revision_number,
    'schema_version', rev.schema_version,
    'content', rev.content,
    'page_count', rev.page_count,
    'published', true,
    'booking_enabled', booking_ok,
    'booking_path', case when booking_ok then '/book/' || org.slug else null end,
    'contact_enabled', true
  );
end;
$$;

revoke all on function public.website_submit_inquiry(text, text, text, text, text) from public;
grant execute on function public.website_submit_inquiry(text, text, text, text, text) to anon, authenticated, service_role;
revoke all on function public.website_public_page(text) from public;
grant execute on function public.website_public_page(text) to anon, authenticated, service_role;

commit;
