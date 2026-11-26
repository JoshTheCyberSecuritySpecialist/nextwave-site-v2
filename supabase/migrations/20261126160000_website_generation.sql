-- Pending review. Do not apply to production until checked on a copy.
-- Milestone 2: durable website generation enqueue/complete/fail RPCs.
-- Does not enable live Stripe or publish public customer sites.

begin;

create or replace function public.website_enqueue_generation(
  p_organization_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_scope text default 'full_site',
  p_section_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  ent public.organization_entitlements;
  site public.websites;
  job public.website_generation_jobs;
  used integer;
  scope text := coalesce(nullif(btrim(p_scope), ''), 'full_site');
begin
  if p_organization_id is null or p_user_id is null
     or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{16,80}$'
     or scope not in ('full_site', 'section') then
    raise exception 'invalid generation request';
  end if;
  if scope = 'section' and (p_section_key is null or length(btrim(p_section_key)) < 2) then
    raise exception 'invalid generation request';
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
  if not found or not ent.website_enabled or ent.max_generation_runs <= 0 then
    raise exception 'website generation not enabled';
  end if;
  select * into site from public.websites where organization_id = p_organization_id;
  if not found then
    raise exception 'website not found';
  end if;
  select * into job
  from public.website_generation_jobs
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'job_id', job.id,
      'duplicate', true,
      'status', job.status,
      'website_id', job.website_id,
      'base_revision_id', job.base_revision_id
    );
  end if;
  if exists (
    select 1 from public.website_generation_jobs
    where organization_id = p_organization_id
      and status in ('queued', 'running')
  ) then
    raise exception 'generation already in progress';
  end if;
  select count(*)::integer into used
  from public.website_generation_jobs
  where organization_id = p_organization_id
    and status = 'succeeded';
  if used >= ent.max_generation_runs then
    raise exception 'generation limit reached';
  end if;
  insert into public.website_generation_jobs (
    organization_id, website_id, base_revision_id, scope, section_key,
    status, progress, attempt_count, idempotency_key, created_by
  ) values (
    p_organization_id, site.id, site.draft_revision_id, scope,
    nullif(btrim(p_section_key), ''), 'queued', 0, 0, p_idempotency_key, p_user_id
  ) returning * into job;
  return jsonb_build_object(
    'job_id', job.id,
    'duplicate', false,
    'status', job.status,
    'website_id', job.website_id,
    'base_revision_id', job.base_revision_id,
    'max_pages', ent.max_pages,
    'max_generation_runs', ent.max_generation_runs,
    'used_generation_runs', used
  );
end;
$$;

create or replace function public.website_mark_generation_running(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job public.website_generation_jobs;
begin
  select * into job from public.website_generation_jobs where id = p_job_id for update;
  if not found then raise exception 'generation job not found'; end if;
  if job.status not in ('queued', 'running') then
    return jsonb_build_object('job_id', job.id, 'status', job.status, 'duplicate', true);
  end if;
  update public.website_generation_jobs
    set status = 'running',
        progress = greatest(progress, 10),
        attempt_count = attempt_count + case when status = 'queued' then 1 else 0 end,
        started_at = coalesce(started_at, now())
    where id = job.id
    returning * into job;
  return jsonb_build_object('job_id', job.id, 'status', job.status, 'duplicate', false);
end;
$$;

create or replace function public.website_apply_generation_result(
  p_job_id uuid,
  p_content jsonb,
  p_page_count integer,
  p_provider text,
  p_provider_request_id text default null,
  p_untrusted_fixture boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job public.website_generation_jobs;
  site public.websites;
  ent public.organization_entitlements;
  base public.website_revisions;
  next_number integer;
  revision_id uuid;
begin
  if p_job_id is null or p_content is null or p_page_count is null or p_page_count < 1 then
    raise exception 'invalid generation result';
  end if;
  select * into job from public.website_generation_jobs where id = p_job_id for update;
  if not found then raise exception 'generation job not found'; end if;
  if job.status = 'succeeded' and job.result_revision_id is not null then
    return jsonb_build_object(
      'job_id', job.id,
      'duplicate', true,
      'status', job.status,
      'revision_id', job.result_revision_id
    );
  end if;
  if job.status not in ('queued', 'running') then
    raise exception 'generation job not runnable';
  end if;
  select * into site from public.websites where id = job.website_id for update;
  select * into ent from public.organization_entitlements where organization_id = job.organization_id;
  if not found or not ent.website_enabled then
    raise exception 'website generation not enabled';
  end if;
  if p_page_count > ent.max_pages then
    raise exception 'page limit exceeded';
  end if;
  if job.base_revision_id is not null then
    select * into base from public.website_revisions where id = job.base_revision_id;
    if found and site.draft_revision_id is distinct from job.base_revision_id then
      raise exception 'draft changed during generation';
    end if;
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_number
  from public.website_revisions
  where website_id = site.id;
  insert into public.website_revisions (
    website_id, organization_id, revision_number, schema_version, state, content, page_count, created_by
  ) values (
    site.id, job.organization_id, next_number, 1, 'draft', p_content, p_page_count, job.created_by
  ) returning id into revision_id;
  update public.websites
    set draft_revision_id = revision_id,
        status = 'draft',
        updated_at = now()
    where id = site.id;
  update public.website_generation_jobs
    set status = 'succeeded',
        progress = 100,
        provider = left(coalesce(p_provider, 'unknown'), 40),
        provider_request_id = nullif(left(coalesce(p_provider_request_id, ''), 120), ''),
        result_revision_id = revision_id,
        error_message = case when p_untrusted_fixture then 'Fixture draft labeled for testing' else null end,
        finished_at = now()
    where id = job.id;
  insert into public.audit_events (organization_id, actor_email, action, target_type, target_id, metadata)
  values (
    job.organization_id,
    'system@website-generator',
    'website.generation_succeeded',
    'website_revision',
    revision_id,
    jsonb_build_object(
      'job_id', job.id,
      'provider', p_provider,
      'fixture', p_untrusted_fixture,
      'page_count', p_page_count
    )
  );
  return jsonb_build_object(
    'job_id', job.id,
    'duplicate', false,
    'status', 'succeeded',
    'revision_id', revision_id,
    'revision_number', next_number
  );
end;
$$;

create or replace function public.website_fail_generation(p_job_id uuid, p_error text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  job public.website_generation_jobs;
  message text := left(coalesce(nullif(btrim(p_error), ''), 'Generation failed'), 500);
begin
  select * into job from public.website_generation_jobs where id = p_job_id for update;
  if not found then raise exception 'generation job not found'; end if;
  if job.status in ('succeeded', 'failed', 'cancelled') then
    return jsonb_build_object('job_id', job.id, 'status', job.status, 'duplicate', true);
  end if;
  update public.website_generation_jobs
    set status = 'failed',
        error_message = message,
        finished_at = now()
    where id = job.id
    returning * into job;
  return jsonb_build_object('job_id', job.id, 'status', job.status, 'duplicate', false, 'error', message);
end;
$$;

revoke all on function public.website_enqueue_generation(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.website_mark_generation_running(uuid) from public, anon, authenticated;
revoke all on function public.website_apply_generation_result(uuid, jsonb, integer, text, text, boolean) from public, anon, authenticated;
revoke all on function public.website_fail_generation(uuid, text) from public, anon, authenticated;
grant execute on function public.website_enqueue_generation(uuid, uuid, text, text, text) to service_role;
grant execute on function public.website_mark_generation_running(uuid) to service_role;
grant execute on function public.website_apply_generation_result(uuid, jsonb, integer, text, text, boolean) to service_role;
grant execute on function public.website_fail_generation(uuid, text) to service_role;

commit;
