-- Pending review. Do not apply to production until checked on a copy.
-- Milestone 3: draft save, publish, rollback, public page resolution.
-- Failed publish must leave published_revision_id unchanged.

begin;

create or replace function public.website_save_draft(
  p_organization_id uuid,
  p_user_id uuid,
  p_base_revision_id uuid,
  p_content jsonb,
  p_page_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ent public.organization_entitlements;
  site public.websites;
  next_number integer;
  revision_id uuid;
begin
  if p_organization_id is null or p_user_id is null or p_base_revision_id is null
     or p_content is null or p_page_count is null or p_page_count < 1 then
    raise exception 'invalid draft save';
  end if;
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and o.status = 'active'
  ) then
    raise exception 'unauthorized';
  end if;
  select * into ent from public.organization_entitlements where organization_id = p_organization_id;
  if not found or not ent.website_enabled then
    raise exception 'website not enabled';
  end if;
  if p_page_count > ent.max_pages then
    raise exception 'page limit exceeded';
  end if;
  select * into site from public.websites where organization_id = p_organization_id for update;
  if not found then
    raise exception 'website not found';
  end if;
  if site.draft_revision_id is distinct from p_base_revision_id then
    raise exception 'draft changed during edit';
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_number
  from public.website_revisions where website_id = site.id;
  insert into public.website_revisions (
    website_id, organization_id, revision_number, schema_version, state, content, page_count, created_by
  ) values (
    site.id, p_organization_id, next_number, 1, 'draft', p_content, p_page_count, p_user_id
  ) returning id into revision_id;
  update public.websites
    set draft_revision_id = revision_id,
        updated_at = now()
    where id = site.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    p_organization_id, 'member@website-editor', 'website.draft_saved', 'website_revision', revision_id,
    jsonb_build_object('base_revision_id', p_base_revision_id, 'page_count', p_page_count)
  );
  return jsonb_build_object(
    'website_id', site.id,
    'revision_id', revision_id,
    'revision_number', next_number,
    'status', site.status,
    'published_revision_id', site.published_revision_id
  );
end;
$$;

create or replace function public.website_publish(
  p_organization_id uuid,
  p_user_id uuid,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ent public.organization_entitlements;
  site public.websites;
  rev public.website_revisions;
  previous uuid;
begin
  if p_organization_id is null or p_user_id is null or p_revision_id is null then
    raise exception 'invalid publish request';
  end if;
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and o.status = 'active'
  ) then
    raise exception 'unauthorized';
  end if;
  select * into ent from public.organization_entitlements where organization_id = p_organization_id;
  if not found or not ent.website_enabled then
    raise exception 'website not enabled';
  end if;
  select * into site from public.websites where organization_id = p_organization_id for update;
  if not found then
    raise exception 'website not found';
  end if;
  select * into rev from public.website_revisions
    where id = p_revision_id
      and website_id = site.id
      and organization_id = p_organization_id
    for update;
  if not found then
    raise exception 'revision not found';
  end if;
  if rev.page_count < 1 or rev.content is null then
    raise exception 'revision not publishable';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(rev.content->'unfinished', '[]'::jsonb)) item
    where length(btrim(item)) > 0
  ) then
    raise exception 'unfinished content blocks publish';
  end if;
  previous := site.published_revision_id;
  if previous is not null and previous is distinct from rev.id then
    update public.website_revisions set state = 'archived' where id = previous;
  end if;
  update public.website_revisions set state = 'published' where id = rev.id;
  update public.websites
    set published_revision_id = rev.id,
        draft_revision_id = coalesce(draft_revision_id, rev.id),
        status = 'published',
        updated_at = now()
    where id = site.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    p_organization_id, 'member@website-editor', 'website.published', 'website_revision', rev.id,
    jsonb_build_object('previous_published_revision_id', previous, 'slug', site.slug)
  );
  return jsonb_build_object(
    'website_id', site.id,
    'slug', site.slug,
    'status', 'published',
    'published_revision_id', rev.id,
    'previous_published_revision_id', previous,
    'public_path', '/site/' || site.slug
  );
end;
$$;

create or replace function public.website_rollback(
  p_organization_id uuid,
  p_user_id uuid,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  site public.websites;
  rev public.website_revisions;
  previous uuid;
begin
  if p_organization_id is null or p_user_id is null or p_revision_id is null then
    raise exception 'invalid rollback request';
  end if;
  if not exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id
      and m.user_id = p_user_id
      and m.status = 'active'
      and o.status = 'active'
  ) then
    raise exception 'unauthorized';
  end if;
  select * into site from public.websites where organization_id = p_organization_id for update;
  if not found then
    raise exception 'website not found';
  end if;
  select * into rev from public.website_revisions
    where id = p_revision_id
      and website_id = site.id
      and organization_id = p_organization_id
    for update;
  if not found then
    raise exception 'revision not found';
  end if;
  if rev.state not in ('published', 'archived') and site.published_revision_id is distinct from rev.id then
    -- Allow rollback to any prior revision that once existed as a complete draft snapshot
    -- only when it has pages; still refuse empty shells.
    if rev.page_count < 1 then
      raise exception 'revision not rollback target';
    end if;
  end if;
  previous := site.published_revision_id;
  if previous is null then
    raise exception 'no published site to roll back';
  end if;
  if previous = rev.id then
    return jsonb_build_object(
      'website_id', site.id,
      'slug', site.slug,
      'status', site.status,
      'published_revision_id', rev.id,
      'duplicate', true
    );
  end if;
  update public.website_revisions set state = 'archived' where id = previous;
  update public.website_revisions set state = 'published' where id = rev.id;
  update public.websites
    set published_revision_id = rev.id,
        status = 'published',
        updated_at = now()
    where id = site.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    p_organization_id, 'member@website-editor', 'website.rolled_back', 'website_revision', rev.id,
    jsonb_build_object('previous_published_revision_id', previous)
  );
  return jsonb_build_object(
    'website_id', site.id,
    'slug', site.slug,
    'status', 'published',
    'published_revision_id', rev.id,
    'previous_published_revision_id', previous,
    'duplicate', false,
    'public_path', '/site/' || site.slug
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
  return jsonb_build_object(
    'slug', site.slug,
    'organization_name', org.name,
    'revision_id', rev.id,
    'revision_number', rev.revision_number,
    'schema_version', rev.schema_version,
    'content', rev.content,
    'page_count', rev.page_count,
    'published', true
  );
end;
$$;

revoke all on function public.website_save_draft(uuid, uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.website_publish(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.website_rollback(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.website_public_page(text) from public;
grant execute on function public.website_save_draft(uuid, uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.website_publish(uuid, uuid, uuid) to service_role;
grant execute on function public.website_rollback(uuid, uuid, uuid) to service_role;
grant execute on function public.website_public_page(text) to anon, authenticated, service_role;

commit;
