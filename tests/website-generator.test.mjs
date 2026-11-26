import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createWebsiteGenerator } from '../server/website-generator.mjs';
import { fixtureWebsiteContent } from '../server/website-schema.mjs';
import { productionServer } from '../server/production-server.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

const bootstrap = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function applyMigrations(db) {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  for (const name of names) {
    const sql = await readFile(new URL(name, dir), 'utf8');
    try { await db.exec(sql); }
    catch (error) { throw Error(`${name}: ${error instanceof Error ? error.message : 'migration failed'}`); }
  }
}

test('generator uses labeled fixtures when no Gemini key and refuses invalid output', async () => {
  const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const jwt = 'header.payload.signature';
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    calls.push(href);
    if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: userId, email: 'owner@example.test' }) };
    if (href.includes('/rpc/website_enqueue_generation')) {
      return { ok: true, json: async () => ({ job_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', duplicate: false, status: 'queued', max_pages: 3 }) };
    }
    if (href.includes('/rpc/website_mark_generation_running')) return { ok: true, json: async () => ({ job_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'running' }) };
    if (href.includes('/rpc/website_apply_generation_result')) {
      const body = JSON.parse(options.body);
      assert.equal(body.p_untrusted_fixture, true);
      assert.equal(body.p_provider, 'fixture');
      return { ok: true, json: async () => ({ job_id: body.p_job_id, duplicate: false, status: 'succeeded', revision_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revision_number: 2 }) };
    }
    if (href.includes('/business_profiles')) {
      return {
        ok: true,
        json: async () => ([{
          organization_id: orgId,
          public_name: 'Harbor Dental',
          industry: 'dentistry',
          description: 'Family dentistry with clear scheduling and practical aftercare for local patients.',
          intake_complete: true,
        }]),
      };
    }
    throw Error(`unexpected ${href}`);
  };

  const generator = createWebsiteGenerator({
    url: 'https://example.supabase.co',
    serviceKey: 'service-role-key-not-for-browser-use',
    apiKey: '',
    fetchImpl,
    allowFixture: true,
  });
  const result = await generator.generate(jwt, orgId, { idempotencyKey: 'gen_fixture_request_01' });
  assert.equal(result.fixture, true);
  assert.equal(result.provider, 'fixture');
  assert.equal(result.status, 'succeeded');
  assert.ok(result.content.unfinished.some(item => /fixture/i.test(item)));

  const rejectingFetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('/rpc/website_fail_generation')) return { ok: true, json: async () => ({ status: 'failed' }) };
    if (href.includes('/rpc/website_enqueue_generation')) {
      return { ok: true, json: async () => ({ job_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', duplicate: false, status: 'queued', max_pages: 3 }) };
    }
    return fetchImpl(url, options);
  };
  const rejecting = createWebsiteGenerator({
    url: 'https://example.supabase.co',
    serviceKey: 'service-role-key-not-for-browser-use',
    fetchImpl: rejectingFetch,
    allowFixture: true,
    complete: async () => ({ schemaVersion: 1, pages: [] }),
  });
  await assert.rejects(
    rejecting.generate(jwt, orgId, { idempotencyKey: 'gen_fixture_request_02' }),
    /Invalid website content/,
  );
});

test('generation RPCs create a draft revision without overwriting published pointer', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await applyMigrations(db);
    const orderId = '11111111-1111-4111-8111-111111111111';
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const token = 'a'.repeat(64);
    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test')`, [userId]);
    await db.query(
      `insert into public.service_orders (id, request_id, package_id, amount, currency, email, status)
       values ($1, '10000000-0000-4000-8000-000000000101', 'business-website', 79900, 'usd', 'owner-a@example.test', 'paid')`,
      [orderId],
    );
    const provisioned = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderId, hash(token)],
    );
    const orgId = provisioned.rows[0].result.organization_id;
    await db.query(`select public.crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userId, hash(token)]);
    await db.query(
      `update public.business_profiles
       set industry = 'landscaping',
           description = 'Seasonal lawn care and garden maintenance for residential customers in the local service area.',
           public_email = 'hello@harbor.example',
           intake_complete = true
       where organization_id = $1`,
      [orgId],
    );

    const queued = await db.query(
      `select public.website_enqueue_generation($1::uuid, $2::uuid, $3, 'full_site', null) as result`,
      [orgId, userId, 'gen_local_request_0001'],
    );
    assert.equal(queued.rows[0].result.duplicate, false);
    const jobId = queued.rows[0].result.job_id;
    await db.query(`select public.website_mark_generation_running($1::uuid)`, [jobId]);
    const content = fixtureWebsiteContent({
      businessName: 'Harbor Gardens',
      industry: 'landscaping',
      description: 'Seasonal lawn care and garden maintenance for residential customers in the local service area.',
      maxPages: 3,
    });
    const applied = await db.query(
      `select public.website_apply_generation_result($1::uuid, $2::jsonb, $3::integer, 'fixture', 'req1', true) as result`,
      [jobId, JSON.stringify(content), content.pages.length],
    );
    assert.equal(applied.rows[0].result.status, 'succeeded');
    const site = await db.query(`select draft_revision_id, published_revision_id, status from public.websites where organization_id = $1`, [orgId]);
    assert.ok(site.rows[0].draft_revision_id);
    assert.equal(site.rows[0].published_revision_id, null);
    assert.equal(site.rows[0].status, 'draft');
    const revision = await db.query(`select page_count, content from public.website_revisions where id = $1`, [site.rows[0].draft_revision_id]);
    assert.equal(revision.rows[0].page_count, content.pages.length);
    assert.equal(revision.rows[0].content.pages[0].slug, 'home');

    const replay = await db.query(
      `select public.website_enqueue_generation($1::uuid, $2::uuid, $3, 'full_site', null) as result`,
      [orgId, userId, 'gen_local_request_0001'],
    );
    assert.equal(replay.rows[0].result.duplicate, true);
  } finally {
    await db.close();
  }
});

test('website generate route requires auth and returns fixture result from injected generator', async () => {
  const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const websites = {
    async status(jwt, organizationId) {
      assert.equal(jwt, 'header.payload.signature');
      assert.equal(organizationId, orgId);
      return { organizationId, websiteEnabled: true, intakeComplete: true, maxPages: 3, maxGenerationRuns: 10, usedGenerationRuns: 0, jobs: [], website: null, draftRevision: null, profileName: 'Acme' };
    },
    async generate(jwt, organizationId, input) {
      assert.equal(jwt, 'header.payload.signature');
      assert.equal(organizationId, orgId);
      assert.match(input.idempotencyKey, /^[A-Za-z0-9_-]{16,80}$/);
      return { jobId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', status: 'succeeded', fixture: true, provider: 'fixture' };
    },
  };
  const server = productionServer({
    payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'], async checkout() { return { id: 'order' }; } },
    websites,
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const denied = await fetch(`${base}/api/crm/organizations/${orgId}/website`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    assert.equal(denied.status, 401);
    const status = await fetch(`${base}/api/crm/organizations/${orgId}/website`, {
      headers: { Origin: 'http://127.0.0.1:5173', Authorization: 'Bearer header.payload.signature' },
    });
    assert.equal(status.status, 200);
    const generated = await fetch(`${base}/api/crm/organizations/${orgId}/website/generate`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', Authorization: 'Bearer header.payload.signature', 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'gen_http_request_00001' }),
    });
    assert.equal(generated.status, 200);
    const body = await generated.json();
    assert.equal(body.fixture, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
