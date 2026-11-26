import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fixtureWebsiteContent } from '../server/website-schema.mjs';

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

async function useRole(db, role, user) {
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user.id]);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user.id, email: user.email })]);
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
  await db.exec(`set role ${role}`);
}

async function provisionWebsiteCrm(db, { orderId, userId, token, requestId, businessName }) {
  await db.query(`insert into auth.users (id, email) values ($1, 'owner@example.test') on conflict (id) do nothing`, [userId]);
  await db.query(
    `insert into public.service_orders (id, request_id, package_id, amount, currency, email, status)
     values ($1, $2, 'website-crm', 149900, 'usd', 'owner@example.test', 'paid')`,
    [orderId, requestId],
  );
  await db.query(
    `insert into public.customer_intakes (order_id, business_name, requirements) values ($1, $2, 'Weekday hours')`,
    [orderId, businessName],
  );
  const provisioned = await db.query(
    `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
    [orderId, hash(token)],
  );
  const orgId = provisioned.rows[0].result.organization_id;
  await db.query(`select public.crm_accept_invitation($1::uuid, 'owner@example.test', $2)`, [userId, hash(token)]);
  return orgId;
}

test('stale draft base revision is rejected while the winning save remains draft', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await applyMigrations(db);
    const orderId = '11111111-1111-4111-8111-111111111111';
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const token = 'a'.repeat(64);
    const orgId = await provisionWebsiteCrm(db, {
      orderId, userId, token,
      requestId: '10000000-0000-4000-8000-000000000501',
      businessName: 'Harbor Dental',
    });
    const site = await db.query(`select draft_revision_id from public.websites where organization_id = $1`, [orgId]);
    const base = site.rows[0].draft_revision_id;
    const content = fixtureWebsiteContent({
      businessName: 'Harbor Dental',
      description: 'Family dentistry with clear scheduling and practical aftercare for local patients.',
      maxPages: 5,
      bookingPath: '/book/harbor-dental',
    });
    content.unfinished = [];
    const first = await db.query(
      `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
      [orgId, userId, base, JSON.stringify(content), content.pages.length],
    );
    assert.ok(first.rows[0].result.revision_id);
    await assert.rejects(
      db.query(
        `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
        [orgId, userId, base, JSON.stringify(content), content.pages.length],
      ),
      /draft changed during edit/i,
    );
    const current = await db.query(`select draft_revision_id, published_revision_id, status from public.websites where organization_id = $1`, [orgId]);
    assert.equal(current.rows[0].draft_revision_id, first.rows[0].result.revision_id);
    assert.equal(current.rows[0].published_revision_id, null);
    assert.equal(current.rows[0].status, 'draft');
  } finally {
    await db.close();
  }
});

test('parallel booking attempts for one slot admit a single appointment', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await applyMigrations(db);
    const orderId = '22222222-2222-4222-8222-222222222222';
    const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const token = 'b'.repeat(64);
    const orgId = await provisionWebsiteCrm(db, {
      orderId, userId, token,
      requestId: '10000000-0000-4000-8000-000000000502',
      businessName: 'Harbor Studio',
    });
    const slug = (await db.query(`select slug from public.organizations where id = $1`, [orgId])).rows[0].slug;

    await useRole(db, 'authenticated', { id: userId, email: 'owner@example.test' });
    const service = (await db.query(
      `insert into public.services (organization_id, name, duration_minutes) values ($1, 'Consultation', 60) returning id`,
      [orgId],
    )).rows[0];
    const calendar = (await db.query(
      `insert into public.calendars (organization_id, name) values ($1, 'Staff calendar') returning id`,
      [orgId],
    )).rows[0];
    await db.query(
      `insert into public.weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 1, 540, 600)`,
      [orgId, calendar.id],
    );
    await db.query(`update public.organization_settings set booking_published = true where organization_id = $1`, [orgId]);
    await db.exec('reset role');

    await useRole(db, 'anon');
    const slots = (await db.query(`select public.booking_open_slots($1, $2) as slots`, [slug, service.id])).rows[0].slots;
    const start = (typeof slots === 'string' ? JSON.parse(slots) : slots)[0].starts_at;
    const keyOne = 'c'.repeat(32);
    const keyTwo = 'd'.repeat(32);
    const attempts = await Promise.allSettled([
      db.query(
        `select public.booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'ada@example.test', '555-0100', $4) as result`,
        [slug, service.id, start, keyOne],
      ),
      db.query(
        `select public.booking_create_appointment($1, $2, $3::timestamptz, 'Bea Guest', 'bea@example.test', '555-0199', $4) as result`,
        [slug, service.id, start, keyTwo],
      ),
    ]);
    await db.exec('reset role');
    const fulfilled = attempts.filter(item => item.status === 'fulfilled');
    const rejected = attempts.filter(item => item.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(String(rejected[0].reason?.message || rejected[0].reason), /slot is not open/i);
    const count = await db.query(`select count(*)::int as n from public.appointments where organization_id = $1 and status = 'confirmed'`, [orgId]);
    assert.equal(count.rows[0].n, 1);
  } finally {
    await db.close();
  }
});

test('second generation request is blocked while one job is queued or running; stale draft blocks apply', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await applyMigrations(db);
    const orderId = '33333333-3333-4333-8333-333333333333';
    const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const token = 'c'.repeat(64);
    const orgId = await provisionWebsiteCrm(db, {
      orderId, userId, token,
      requestId: '10000000-0000-4000-8000-000000000503',
      businessName: 'Cedar Clinic',
    });
    await db.query(
      `update public.business_profiles
       set industry = 'clinic',
           description = 'Primary care visits and preventive checkups for local families with clear appointment options.',
           public_email = 'hello@cedar.example',
           intake_complete = true
       where organization_id = $1`,
      [orgId],
    );

    const first = await db.query(
      `select public.website_enqueue_generation($1::uuid, $2::uuid, $3, 'full_site', null) as result`,
      [orgId, userId, 'gen_m5_request_000001'],
    );
    assert.equal(first.rows[0].result.duplicate, false);
    await assert.rejects(
      db.query(
        `select public.website_enqueue_generation($1::uuid, $2::uuid, $3, 'full_site', null) as result`,
        [orgId, userId, 'gen_m5_request_000002'],
      ),
      /generation already in progress/i,
    );

    const jobId = first.rows[0].result.job_id;
    await db.query(`select public.website_mark_generation_running($1::uuid)`, [jobId]);
    const site = await db.query(`select draft_revision_id from public.websites where organization_id = $1`, [orgId]);
    const content = fixtureWebsiteContent({
      businessName: 'Cedar Clinic',
      description: 'Primary care visits and preventive checkups for local families with clear appointment options.',
      maxPages: 5,
    });
    content.unfinished = [];
    await db.query(
      `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
      [orgId, userId, site.rows[0].draft_revision_id, JSON.stringify(content), content.pages.length],
    );
    await assert.rejects(
      db.query(
        `select public.website_apply_generation_result($1::uuid, $2::jsonb, $3::integer, 'fixture', 'req-m5', true) as result`,
        [jobId, JSON.stringify(content), content.pages.length],
      ),
      /draft changed during generation/i,
    );
    const published = await db.query(`select published_revision_id, status from public.websites where organization_id = $1`, [orgId]);
    assert.equal(published.rows[0].published_revision_id, null);
    assert.equal(published.rows[0].status, 'draft');
  } finally {
    await db.close();
  }
});
