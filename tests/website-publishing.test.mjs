import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fixtureWebsiteContent } from '../server/website-schema.mjs';
import { createWebsitePublishing } from '../server/website-publishing.mjs';
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

test('save draft, publish, and rollback keep failed publish from wiping the live site', async () => {
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
       values ($1, '10000000-0000-4000-8000-000000000201', 'business-website', 79900, 'usd', 'owner-a@example.test', 'paid')`,
      [orderId],
    );
    const provisioned = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderId, hash(token)],
    );
    const orgId = provisioned.rows[0].result.organization_id;
    await db.query(`select public.crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userId, hash(token)]);

    const site = await db.query(`select id, slug, draft_revision_id from public.websites where organization_id = $1`, [orgId]);
    const content = fixtureWebsiteContent({
      businessName: 'Cedar Clinic',
      industry: 'clinic',
      description: 'Primary care visits and preventive checkups for local families with clear appointment options.',
      maxPages: 3,
    });
    content.unfinished = [];
    const saved = await db.query(
      `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
      [orgId, userId, site.rows[0].draft_revision_id, JSON.stringify(content), content.pages.length],
    );
    const draftId = saved.rows[0].result.revision_id;
    const published = await db.query(
      `select public.website_publish($1::uuid, $2::uuid, $3::uuid) as result`,
      [orgId, userId, draftId],
    );
    assert.equal(published.rows[0].result.status, 'published');
    assert.equal(published.rows[0].result.public_path, `/site/${site.rows[0].slug}`);

    const live = await db.query(`select public.website_public_page($1) as page`, [site.rows[0].slug]);
    assert.equal(live.rows[0].page.published, true);
    assert.equal(live.rows[0].page.content.pages[0].slug, 'home');

    const secondContent = structuredClone(content);
    secondContent.pages[0].sections[0].title = 'Cedar Clinic Updated';
    const current = await db.query(`select draft_revision_id, published_revision_id from public.websites where organization_id = $1`, [orgId]);
    const second = await db.query(
      `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
      [orgId, userId, current.rows[0].draft_revision_id, JSON.stringify(secondContent), secondContent.pages.length],
    );
    await db.query(
      `select public.website_publish($1::uuid, $2::uuid, $3::uuid) as result`,
      [orgId, userId, second.rows[0].result.revision_id],
    );

    await assert.rejects(
      db.query(
        `select public.website_publish($1::uuid, $2::uuid, $3::uuid) as result`,
        [orgId, userId, '99999999-9999-4999-8999-999999999999'],
      ),
      /revision not found/i,
    );
    const stillLive = await db.query(`select published_revision_id, status from public.websites where organization_id = $1`, [orgId]);
    assert.equal(stillLive.rows[0].status, 'published');
    assert.equal(stillLive.rows[0].published_revision_id, second.rows[0].result.revision_id);

    const rolled = await db.query(
      `select public.website_rollback($1::uuid, $2::uuid, $3::uuid) as result`,
      [orgId, userId, draftId],
    );
    assert.equal(rolled.rows[0].result.published_revision_id, draftId);
    const publicAgain = await db.query(`select public.website_public_page($1) as page`, [site.rows[0].slug]);
    assert.equal(publicAgain.rows[0].page.revision_id, draftId);

    const draftOnly = await db.query(`select public.website_public_page($1) as page`, ['not-a-real-site']);
    assert.equal(draftOnly.rows[0].page, null);
  } finally {
    await db.close();
  }
});

test('publishing API requires auth and returns public path on publish', async () => {
  const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const revisionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const publishing = {
    async listRevisions(jwt, organizationId) {
      assert.equal(jwt, 'header.payload.signature');
      assert.equal(organizationId, orgId);
      return { website: { slug: 'cedar-clinic', status: 'draft', draftRevisionId: revisionId, publishedRevisionId: null, publicPath: null }, revisions: [] };
    },
    async publish(jwt, organizationId, id) {
      assert.equal(organizationId, orgId);
      assert.equal(id, revisionId);
      return { publicPath: '/site/cedar-clinic', publishedRevisionId: revisionId, slug: 'cedar-clinic', status: 'published' };
    },
    async saveDraft() { return {}; },
    async rollback() { return {}; },
    async previewDraft() { return { private: true, content: {}, slug: 'cedar-clinic', revisionId, revisionNumber: 1 }; },
  };
  const server = productionServer({
    payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'], async checkout() { return { id: 'order' }; } },
    publishing,
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const denied = await fetch(`${base}/api/crm/organizations/${orgId}/website/publish`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId }),
    });
    assert.equal(denied.status, 401);
    const published = await fetch(`${base}/api/crm/organizations/${orgId}/website/publish`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', Authorization: 'Bearer header.payload.signature', 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisionId }),
    });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).publicPath, '/site/cedar-clinic');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('saveDraft validates content before calling RPC', async () => {
  const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const baseRevisionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let saved = null;
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: userId, email: 'owner@example.test' }) };
    if (href.includes('organization_entitlements')) return { ok: true, json: async () => ([{ website_enabled: true, max_pages: 3 }]) };
    if (href.includes('/rpc/website_save_draft')) {
      saved = JSON.parse(options.body);
      return { ok: true, json: async () => ({ website_id: orgId, revision_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', revision_number: 3, status: 'draft', published_revision_id: null }) };
    }
    throw Error(`unexpected ${href}`);
  };
  const publishing = createWebsitePublishing({
    url: 'https://example.supabase.co',
    serviceKey: 'service-role-key-not-for-browser-use',
    fetchImpl,
  });
  const content = fixtureWebsiteContent({
    businessName: 'Cedar Clinic',
    description: 'Primary care visits and preventive checkups for local families with clear appointment options.',
    maxPages: 3,
  });
  await assert.rejects(
    publishing.saveDraft('header.payload.signature', orgId, { baseRevisionId, content: { ...content, pages: [] } }),
    /Invalid website content/,
  );
  const result = await publishing.saveDraft('header.payload.signature', orgId, { baseRevisionId, content, clearUnfinished: true });
  assert.equal(result.revisionNumber, 3);
  assert.equal(saved.p_page_count, content.pages.length);
  assert.deepEqual(saved.p_content.unfinished, []);
});
