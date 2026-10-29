import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const orderA = '11111111-1111-4111-8111-111111111111';
const orderB = '22222222-2222-4222-8222-222222222222';
const orderPending = '33333333-3333-4333-8333-333333333333';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const userC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);
const tokenC = 'c'.repeat(64);
const hash = token => createHash('sha256').update(token).digest('hex');

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

test('two synthetic organizations cannot read or write each other', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    const applied = await applyMigrations(db);
    assert.ok(applied.includes('202610170002_real_payments.sql'));
    assert.ok(applied.includes('20261029120100_crm_foundation.sql'));

    const tables = (await db.query(`select table_name from information_schema.tables where table_schema = 'public'`)).rows.map(row => row.table_name);
    for (const name of ['blog_posts', 'newsletter_subscriptions', 'service_orders', 'payment_events', 'customer_intakes', 'fulfillment_contacts', 'fulfillment_projects', 'fulfillment_outbox', 'project_status_history', 'service_subscriptions', 'organizations', 'organization_entitlements', 'organization_members', 'organization_invitations', 'organization_settings', 'provisioning_records', 'audit_events']) {
      assert.ok(tables.includes(name), name);
    }
    const orderColumns = (await db.query(`select column_name from information_schema.columns where table_name = 'service_orders'`)).rows.map(row => row.column_name);
    assert.ok(orderColumns.includes('token_hash'));
    assert.equal((await db.query(`select has_function_privilege('authenticated', 'public.crm_provision_organization(uuid,text,text)', 'execute') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.crm_provision_organization(uuid,text,text)', 'execute') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('service_role', 'public.crm_provision_organization(uuid,text,text)', 'execute') as ok`)).rows[0].ok, true);
    assert.equal((await db.query(`select rolbypassrls from pg_roles where rolname = 'service_role'`)).rows[0].rolbypassrls, true);

    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test'), ($2, 'owner-b@example.test'), ($3, 'extra@example.test')`, [userA, userB, userC]);
    await db.query(`insert into service_orders (id, request_id, package_id, amount, currency, email, status) values
      ($1, '10000000-0000-4000-8000-000000000001', 'website-crm', 149900, 'usd', 'owner-a@example.test', 'paid'),
      ($2, '10000000-0000-4000-8000-000000000002', 'booking-only', 79900, 'usd', 'owner-b@example.test', 'paid'),
      ($3, '10000000-0000-4000-8000-000000000003', 'website-crm', 149900, 'usd', 'pending@example.test', 'pending')`, [orderA, orderB, orderPending]);
    await db.query(`insert into customer_intakes (order_id, business_name, requirements) values ($1, 'Harbor Studio', 'Weekday hours')`, [orderA]);
    await db.query(`insert into blog_posts (title, slug, excerpt, content, category, status) values
      ('Public note', 'public-note', 'Visible', 'Visible body', 'Web Development', 'published'),
      ('Draft note', 'draft-note', 'Hidden', 'Hidden body', 'Web Development', 'draft')`);
    await db.query(`insert into newsletter_subscriptions (email) values ('reader@example.test')`);

    await useRole(db, 'service_role');
    await assert.rejects(db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com')`, [orderPending, hash(tokenC)]), /order is not paid/);
    await db.exec('reset role');
    await useRole(db, 'service_role');
    const createdA = (await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderA, hash(tokenA)])).rows[0].result;
    const createdB = (await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderB, hash(tokenB)])).rows[0].result;
    const replayA = (await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderA, hash('d'.repeat(64))])).rows[0].result;
    assert.equal(createdA.duplicate, false);
    assert.equal(createdB.duplicate, false);
    assert.equal(replayA.duplicate, true);
    assert.equal(replayA.organization_id, createdA.organization_id);
    assert.notEqual(createdA.organization_id, createdB.organization_id);
    assert.equal((await db.query(`select count(*)::int as count from organizations`)).rows[0].count, 2);
    const caps = await db.query(`select package_id, max_users, max_services, max_customers, crm_enabled from organization_entitlements order by package_id`);
    const booking = caps.rows.find(row => row.package_id === 'booking-only');
    const website = caps.rows.find(row => row.package_id === 'website-crm');
    assert.equal(booking.crm_enabled, false);
    assert.equal(booking.max_users, 1);
    assert.equal(booking.max_customers, 0);
    assert.equal(website.crm_enabled, true);
    assert.equal(website.max_users, 2);
    assert.equal(website.max_services, 10);
    assert.equal(website.max_customers, 1000);
    const storedHash = (await db.query(`select token_hash from organization_invitations where organization_id = $1`, [createdA.organization_id])).rows[0].token_hash;
    assert.equal(storedHash, hash(tokenA));
    const audits = (await db.query(`select metadata::text as metadata from audit_events`)).rows.map(row => row.metadata).join('\n');
    assert.equal(audits.includes(tokenA), false);
    assert.equal(audits.includes(storedHash), false);
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userA, hash(tokenA)]);
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-b@example.test', $2)`, [userB, hash(tokenB)]);
    await assert.rejects(db.query(`select crm_accept_invitation($1::uuid, 'owner-b@example.test', $2)`, [userB, hash(tokenA)]), /invalid or expired invitation/);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const visible = await db.query(`select id, name from organizations`);
    assert.deepEqual(visible.rows.map(row => row.id), [createdA.organization_id]);
    assert.equal(visible.rows[0].name, 'Harbor Studio');
    assert.equal((await db.query(`select id from organizations where id = $1`, [createdB.organization_id])).rows.length, 0);
    assert.equal((await db.query(`select organization_id from organization_settings where organization_id = $1`, [createdB.organization_id])).rows.length, 0);
    assert.equal((await db.query(`select user_id from organization_members where organization_id = $1`, [createdB.organization_id])).rows.length, 0);
    await assert.rejects(db.query(`update organization_settings set business_name = 'Hacked' where organization_id = $1`, [createdB.organization_id]), /permission denied/i);
    await assert.rejects(db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [createdB.organization_id, userA]), /permission denied/i);
    await assert.rejects(db.query(`select token_hash from organization_invitations`), /permission denied/i);
    await assert.rejects(db.query(`select metadata from audit_events`), /permission denied/i);
    await assert.rejects(db.query(`select email, unsubscribe_token from newsletter_subscriptions`), /permission denied/i);
    assert.equal((await db.query(`select slug from blog_posts where status = 'draft'`)).rows.length, 0);
    assert.deepEqual((await db.query(`select slug from blog_posts where status = 'published'`)).rows.map(row => row.slug), ['public-note']);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    assert.deepEqual((await db.query(`select id from organizations`)).rows.map(row => row.id), [createdB.organization_id]);
    assert.equal((await db.query(`select id from organizations where id = $1`, [createdA.organization_id])).rows.length, 0);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userA, email: 'joshua@nextwavedigitalsolution.com' });
    assert.deepEqual((await db.query(`select slug from blog_posts where status = 'draft'`)).rows.map(row => row.slug), ['draft-note']);
    await db.exec('reset role');

    await useRole(db, 'service_role');
    await db.query(`insert into organization_invitations (organization_id, email, role, token_hash, expires_at) values ($1, 'extra@example.test', 'member', $2, now() + interval '1 day')`, [createdB.organization_id, hash(tokenC)]);
    await assert.rejects(db.query(`select crm_accept_invitation($1::uuid, 'extra@example.test', $2)`, [userC, hash(tokenC)]), /user cap exceeded/);
    await db.query(`select crm_set_organization_status($1::uuid, 'suspended', 'joshua@nextwavedigitalsolution.com')`, [createdA.organization_id]);
    await db.exec('reset role');
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from organizations`)).rows.length, 0);
    await db.exec('reset role');
    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'active', 'joshua@nextwavedigitalsolution.com')`, [createdA.organization_id]);
    await db.exec('reset role');
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.deepEqual((await db.query(`select id from organizations`)).rows.map(row => row.id), [createdA.organization_id]);
    await db.exec('reset role');

    await db.exec('set role anon');
    await assert.rejects(db.query(`select id from organizations`), /permission denied/i);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
