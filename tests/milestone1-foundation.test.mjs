import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { packages, legacyPackages, allPackageAmounts } from '../server/payments.mjs';
import { createStripePayments } from '../server/stripe-payments.mjs';
import { createCrmProvisioning } from '../server/crm-provision.mjs';
import { sign } from '../server/payments.mjs';
import { PURCHASABLE_PACKAGE_IDS } from '../src/lib/payments-client.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

const bootstrap = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create or replace function auth.jwt()
returns jsonb language sql stable as $$
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
    try {
      await db.exec(sql);
    } catch (error) {
      throw Error(`${name}: ${error instanceof Error ? error.message : 'migration failed'}`);
    }
  }
  return names;
}

async function useRole(db, role, user) {
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user.id]);
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user.id, email: user.email })]);
  }
  await db.exec(`set role ${role}`);
}

test('purchasable packages exclude legacy booking-only and keep historical amounts', () => {
  assert.deepEqual([...PURCHASABLE_PACKAGE_IDS], ['business-website', 'website-crm']);
  assert.equal(packages['business-website'], 79900);
  assert.equal(packages['website-crm'], 149900);
  assert.equal(legacyPackages['booking-only'], 79900);
  assert.equal(allPackageAmounts['booking-only'], 79900);
  assert.equal(Object.hasOwn(packages, 'booking-only'), false);
});

test('live Stripe payments adapter refuses to construct while DB is test-only', () => {
  assert.throws(
    () => createStripePayments({
      stripe: {},
      db: { async rpc() { return {}; } },
      webhookSecret: 'whsec_fake_test_secret',
      tokenSecret: 'dedicated-test-secret-at-least-32-bytes',
      env: {},
      livemode: true,
    }),
    /Live Stripe checkout is disabled/,
  );
});

test('refund webhook records money state without suspending access', async () => {
  const orderId = '11111111-1111-4111-8111-111111111111';
  const calls = [];
  const db = {
    async rpc(op, args) {
      calls.push({ op, args });
      if (op === 'p3_refund_event') {
        assert.equal(args.p_payment_intent_id, 'pi_refund_fixture');
        assert.equal(args.p_amount_refunded, 79900);
        return { duplicate: false, outcome: 'refunded', order_id: orderId, refunded_amount: 79900, access_unchanged: true };
      }
      throw Error(`unexpected ${op}`);
    },
  };
  const payments = createStripePayments({
    stripe: { async retrieve() { throw Error('session retrieve should not run for refunds'); } },
    db,
    webhookSecret: 'whsec_fake_test_secret',
    tokenSecret: 'dedicated-test-secret-at-least-32-bytes',
    env: {},
  });
  const raw = JSON.stringify({
    id: 'evt_refund_1',
    type: 'charge.refunded',
    livemode: false,
    data: { object: { payment_intent: 'pi_refund_fixture', amount_refunded: 79900, currency: 'usd' } },
  });
  const result = await payments.webhook(raw, sign(raw, 'whsec_fake_test_secret'));
  assert.equal(result.outcome, 'refunded');
  assert.equal(result.access_unchanged, true);
  assert.equal(calls[0].op, 'p3_refund_event');
});

test('invitation preview and account setup keep email locked to the invite', async () => {
  const token = 'ab'.repeat(32);
  const users = [];
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('/rpc/crm_invitation_preview')) {
      return {
        ok: true,
        json: async () => ({ email: 'owner@example.test', organization_name: 'Acme', package_id: 'business-website', expires_at: '2099-01-01T00:00:00Z' }),
      };
    }
    if (href.includes('/auth/v1/admin/users') && options.method === 'GET') {
      return { ok: true, json: async () => ({ users }) };
    }
    if (href.includes('/auth/v1/admin/users') && options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.email, 'owner@example.test');
      assert.equal(body.email_confirm, true);
      assert.match(JSON.stringify(body), /business_owner/);
      const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      users.push({ id, email: body.email });
      return { ok: true, json: async () => ({ id, email: body.email }) };
    }
    throw Error(`unexpected ${href}`);
  };
  const crm = createCrmProvisioning({
    url: 'https://example.supabase.co',
    serviceKey: 'service-role-key-not-for-browser-use',
    fetchImpl,
  });
  const preview = await crm.previewInvitation(token);
  assert.equal(preview.email, 'owner@example.test');
  const created = await crm.setupAccount(token, 'password123');
  assert.equal(created.created, true);
  const again = await crm.setupAccount(token, 'password123');
  assert.equal(again.created, false);
});

test('website tables are isolated across organizations after milestone 1 migration', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    const applied = await applyMigrations(db);
    assert.ok(applied.includes('20261126120000_milestone1_foundation.sql'));

    const orderA = '11111111-1111-4111-8111-111111111111';
    const orderB = '22222222-2222-4222-8222-222222222222';
    const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const tokenA = 'a'.repeat(64);
    const tokenB = 'b'.repeat(64);

    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test'), ($2, 'owner-b@example.test')`, [userA, userB]);
    await db.query(
      `insert into public.service_orders (id, request_id, package_id, amount, currency, email, status)
       values
       ($1, '10000000-0000-4000-8000-000000000001', 'business-website', 79900, 'usd', 'owner-a@example.test', 'paid'),
       ($2, '10000000-0000-4000-8000-000000000002', 'website-crm', 149900, 'usd', 'owner-b@example.test', 'paid')`,
      [orderA, orderB],
    );

    const provisionA = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderA, hash(tokenA)],
    );
    const provisionB = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderB, hash(tokenB)],
    );
    const orgA = provisionA.rows[0].result.organization_id;
    const orgB = provisionB.rows[0].result.organization_id;
    assert.equal(provisionA.rows[0].result.package_id, 'business-website');
    assert.ok(provisionA.rows[0].result.website_id);

    await db.query(`select public.crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userA, hash(tokenA)]);
    await db.query(`select public.crm_accept_invitation($1::uuid, 'owner-b@example.test', $2)`, [userB, hash(tokenB)]);

    const caps = await db.query(`select package_id, website_enabled, max_pages, crm_enabled from public.organization_entitlements order by package_id`);
    const websiteOnly = caps.rows.find(row => row.package_id === 'business-website');
    const websiteCrm = caps.rows.find(row => row.package_id === 'website-crm');
    assert.equal(websiteOnly.website_enabled, true);
    assert.equal(websiteOnly.max_pages, 3);
    assert.equal(websiteOnly.crm_enabled, false);
    assert.equal(websiteCrm.website_enabled, true);
    assert.equal(websiteCrm.max_pages, 5);
    assert.equal(websiteCrm.crm_enabled, true);

    const sites = await db.query(`select organization_id, slug, status from public.websites order by slug`);
    assert.equal(sites.rows.length, 2);

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const visible = await db.query(`select organization_id from public.websites`);
    assert.deepEqual(visible.rows.map(row => row.organization_id), [orgA]);
    const foreign = await db.query(`select id from public.websites where organization_id = $1`, [orgB]);
    assert.equal(foreign.rows.length, 0);
    await db.exec('reset role');

    const refund = await db.query(
      `select public.p3_refund_event($1, 'charge.refunded', $2, 79900, 'usd', false, $3) as result`,
      ['evt_refund_local', 'pi_missing', 'a'.repeat(64)],
    ).catch(error => error);
    assert.ok(refund instanceof Error);

    await db.query(
      `update public.service_orders set stripe_payment_intent_id = 'pi_order_a', status = 'paid' where id = $1`,
      [orderA],
    );
    const recorded = await db.query(
      `select public.p3_refund_event($1, 'charge.refunded', $2, 40000, 'usd', false, $3) as result`,
      ['evt_refund_partial', 'pi_order_a', 'b'.repeat(64)],
    );
    assert.equal(recorded.rows[0].result.outcome, 'partially_refunded');
    assert.equal(recorded.rows[0].result.access_unchanged, true);
    const orgStatus = await db.query(`select status from public.organizations where id = $1`, [orgA]);
    assert.equal(orgStatus.rows[0].status, 'active');

    const replay = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderA, hash('c'.repeat(64))],
    );
    assert.equal(replay.rows[0].result.duplicate, true);
    assert.equal(replay.rows[0].result.organization_id, orgA);
  } finally {
    await db.close();
  }
});
