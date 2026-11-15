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
    assert.ok(applied.includes('20261030140000_crm_customers.sql'));

    const tables = (await db.query(`select table_name from information_schema.tables where table_schema = 'public'`)).rows.map(row => row.table_name);
    for (const name of ['blog_posts', 'newsletter_subscriptions', 'service_orders', 'payment_events', 'customer_intakes', 'fulfillment_contacts', 'fulfillment_projects', 'fulfillment_outbox', 'project_status_history', 'service_subscriptions', 'organizations', 'organization_entitlements', 'organization_members', 'organization_invitations', 'organization_settings', 'provisioning_records', 'audit_events', 'customers', 'customer_notes', 'customer_activities', 'customer_capacity', 'services', 'calendars', 'weekly_hours', 'service_capacity']) {
      assert.ok(tables.includes(name), name);
    }
    const customerSql = await readFile(new URL('../supabase/migrations/20261030140000_crm_customers.sql', import.meta.url), 'utf8');
    assert.equal(/\b(drop table|truncate|delete from)\b/i.test(customerSql), false);
    assert.equal(/count\s*\(\s*\*\s*\)/i.test(customerSql), false);
    const definers = await db.query(`
      select p.proname, r.rolname as owner, r.rolsuper, r.rolbypassrls, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p
      join pg_roles r on r.oid = p.proowner
      where p.pronamespace = 'public'::regnamespace
        and p.proname in ('crm_directory_enabled', 'crm_prepare_customer', 'crm_prepare_note', 'crm_record_customer_activity', 'crm_record_note_activity')
    `);
    for (const name of ['crm_directory_enabled', 'crm_prepare_customer', 'crm_record_customer_activity', 'crm_record_note_activity']) {
      const row = definers.rows.find(item => item.proname === name);
      assert.equal(row.owner, 'service_role', name);
      assert.equal(row.rolsuper, false, name);
      assert.equal(row.rolbypassrls, true, name);
      assert.equal(row.prosecdef, true, name);
      assert.match(row.config, /search_path=pg_catalog, public/, name);
    }
    const notePreparer = definers.rows.find(item => item.proname === 'crm_prepare_note');
    assert.equal(notePreparer.prosecdef, false);
    const forced = await db.query(`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where relname in ('customers', 'customer_notes', 'customer_activities', 'customer_capacity')
    `);
    assert.equal(forced.rows.length, 4);
    for (const row of forced.rows) {
      assert.equal(row.relrowsecurity, true, row.relname);
      assert.equal(row.relforcerowsecurity, true, row.relname);
    }
    assert.equal((await db.query(`select pg_has_role('authenticated', 'service_role', 'member') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.crm_record_customer_activity()', 'execute') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.customer_activities', 'insert') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.customer_capacity', 'select') as ok`)).rows[0].ok, false);
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
    assert.equal((await db.query(`update organization_settings set business_name = 'Hacked' where organization_id = $1 returning organization_id`, [createdB.organization_id])).rows.length, 0);
    await assert.rejects(db.query(`insert into organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [createdB.organization_id, userA]), /permission denied/i);
    await assert.rejects(db.query(`select token_hash from organization_invitations`), /permission denied/i);
    await assert.rejects(db.query(`select metadata from audit_events`), /permission denied/i);
    await assert.rejects(db.query(`select email, unsubscribe_token from newsletter_subscriptions`), /permission denied/i);
    assert.equal((await db.query(`select slug from blog_posts where status = 'draft'`)).rows.length, 0);
    assert.deepEqual((await db.query(`select slug from blog_posts where status = 'published'`)).rows.map(row => row.slug), ['public-note']);
    await db.exec('reset role');
    assert.equal((await db.query(`select business_name from organization_settings where organization_id = $1`, [createdB.organization_id])).rows[0].business_name, 'New workspace');

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
    await assert.rejects(db.query(`select id from customers`), /permission denied/i);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const customer = (await db.query(
      `insert into customers (organization_id, display_name, email, phone, tags)
       values ($1, 'Ada Harbor', 'Ada@Example.test', ' 555-0100 ', array['VIP', 'vip'])
       returning id, email, phone, tags`,
      [createdA.organization_id],
    )).rows[0];
    assert.equal(customer.email, 'ada@example.test');
    assert.equal(customer.phone, '555-0100');
    assert.deepEqual(customer.tags, ['vip']);
    await db.query(
      `insert into customer_notes (organization_id, customer_id, body) values ($1, $2, 'Prefers weekday mornings')`,
      [createdA.organization_id, customer.id],
    );
    const activity = (await db.query(
      `select kind, summary from customer_activities where customer_id = $1 order by created_at, kind`,
      [customer.id],
    )).rows;
    assert.deepEqual(activity.map(row => row.summary).sort(), ['Customer record created', 'Note added']);
    assert.equal(activity.map(row => row.summary).join(' ').includes('Prefers weekday mornings'), false);
    await assert.rejects(
      db.query(
        `insert into customers (organization_id, display_name, email) values ($1, 'Ada Again', 'ada@example.test')`,
        [createdA.organization_id],
      ),
      /customers_org_email/,
    );
    await db.query(`update customers set status = 'archived' where id = $1`, [customer.id]);
    const archivedAgain = (await db.query(
      `insert into customers (organization_id, display_name, email) values ($1, 'Ada Active', 'ada@example.test') returning id`,
      [createdA.organization_id],
    )).rows[0];
    await db.query(`update customers set display_name = 'Ada Renamed' where id = $1`, [archivedAgain.id]);
    assert.equal((await db.query(
      `select summary from customer_activities where customer_id = $1 and kind = 'updated'`,
      [archivedAgain.id],
    )).rows[0].summary, 'name updated');
    await assert.rejects(
      db.query(`update customers set organization_id = $1 where id = $2`, [createdB.organization_id, archivedAgain.id]),
      /organization cannot change/,
    );
    await assert.rejects(
      db.query(`insert into customer_activities (organization_id, customer_id, kind, summary) values ($1, $2, 'note', 'Forged')`, [createdA.organization_id, archivedAgain.id]),
      /permission denied/i,
    );
    await assert.rejects(
      db.query(`insert into customer_notes (organization_id, customer_id, body) values ($1, $2, 'Wrong organization')`, [createdB.organization_id, archivedAgain.id]),
      /customer is not in this organization/,
    );
    await assert.rejects(db.query(`select public.crm_record_customer_activity()`), /trigger functions can only be called as triggers/i);
    await assert.rejects(db.query(`select public.crm_prepare_customer()`), /trigger functions can only be called as triggers/i);
    await assert.rejects(db.query(`select customer_count from customer_capacity`), /permission denied/i);
    await db.exec('reset role');
    const slotBefore = (await db.query(`select customer_count from customer_capacity where organization_id = $1`, [createdA.organization_id])).rows[0].customer_count;
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    await db.exec('begin');
    await db.query(`insert into customers (organization_id, display_name) values ($1, 'Lock probe')`, [createdA.organization_id]);
    const heldLocks = await db.query(`
      select mode from pg_locks
      where relation = 'public.customer_capacity'::regclass and granted
    `);
    assert.ok(heldLocks.rows.some(row => String(row.mode).includes('Row')));
    await db.exec('rollback');
    await db.exec('reset role');
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [createdA.organization_id])).rows[0].customer_count, slotBefore);
    const entitlementCheck = (await db.query(`select pg_get_constraintdef(oid) as definition from pg_constraint where conname = 'organization_entitlements_check'`)).rows[0].definition;
    await db.exec('alter table organization_entitlements drop constraint organization_entitlements_check');
    await db.exec('alter table organization_entitlements disable trigger organization_entitlements_package');
    await db.query(`update organization_entitlements set max_customers = 1 where organization_id = $1`, [createdA.organization_id]);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    await assert.rejects(
      db.query(`insert into customers (organization_id, display_name) values ($1, 'Over cap')`, [createdA.organization_id]),
      /customer cap exceeded/,
    );
    await db.exec('reset role');
    const archivedCount = (await db.query(`select count(*)::int as count from customers where organization_id = $1 and status = 'archived'`, [createdA.organization_id])).rows[0].count;
    const capacityAtCap = (await db.query(`select customer_count from customer_capacity where organization_id = $1`, [createdA.organization_id])).rows[0].customer_count;
    assert.ok(archivedCount >= 1);
    assert.equal(capacityAtCap, (await db.query(`select count(*)::int as count from customers where organization_id = $1`, [createdA.organization_id])).rows[0].count);
    await db.query(`update customers set status = 'archived' where organization_id = $1 and status = 'active'`, [createdA.organization_id]);
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [createdA.organization_id])).rows[0].customer_count, capacityAtCap);
    await db.query(`update organization_entitlements set max_customers = 1000 where organization_id = $1`, [createdA.organization_id]);
    await db.exec(`alter table organization_entitlements add constraint organization_entitlements_check ${entitlementCheck}`);
    await db.exec('alter table organization_entitlements enable trigger organization_entitlements_package');
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const reused = (await db.query(
      `insert into customers (organization_id, display_name, email) values ($1, 'Ada Current', 'ada@example.test') returning id`,
      [createdA.organization_id],
    )).rows[0];
    await assert.rejects(
      db.query(`update customers set status = 'active' where id = $1 and status = 'archived'`, [customer.id]),
      /customers_org_email/,
    );
    await db.query(`insert into customers (organization_id, display_name) values ($1, 'No Email One'), ($1, 'No Email Two')`, [createdA.organization_id]);
    await db.exec('reset role');
    await assert.rejects(
      db.query(`insert into customer_activities (organization_id, customer_id, kind, summary) values ($1, $2, 'note', 'Mismatch')`, [createdB.organization_id, reused.id]),
      /customer_activities_same_organization/,
    );
    await db.exec('alter table customer_notes disable trigger customer_notes_prepare');
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    await assert.rejects(
      db.query(`insert into customer_notes (organization_id, customer_id, body) values ($1, $2, 'Cross link')`, [createdA.organization_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd']),
      /customer_notes_same_organization/,
    );
    await db.exec('reset role');
    await db.exec('alter table customer_notes enable trigger customer_notes_prepare');
    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'suspended', 'joshua@nextwavedigitalsolution.com')`, [createdA.organization_id]);
    await db.exec('reset role');
    const preserved = (await db.query(`select count(*)::int as count from customers where organization_id = $1`, [createdA.organization_id])).rows[0].count;
    assert.ok(preserved >= 2);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from customers`)).rows.length, 0);
    assert.equal((await db.query(`select id from customer_notes`)).rows.length, 0);
    assert.equal((await db.query(`select id from customer_activities`)).rows.length, 0);
    assert.equal((await db.query(`update customers set display_name = 'Hidden' returning id`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into customers (organization_id, display_name) values ($1, 'While suspended')`, [createdA.organization_id]),
      /customer directory is not included/,
    );
    await db.exec('reset role');
    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'active', 'joshua@nextwavedigitalsolution.com')`, [createdA.organization_id]);
    await db.exec('reset role');
    await db.query(`update organization_members set status = 'disabled' where user_id = $1`, [userA]);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from customers`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into customer_notes (organization_id, customer_id, body) values ($1, $2, 'Disabled note')`, [createdA.organization_id, reused.id]),
      /customer directory is not included|customer is not in this organization/,
    );
    await db.exec('reset role');
    await db.query(`update organization_members set status = 'active' where user_id = $1`, [userA]);
    assert.equal((await db.query(`select count(*)::int as count from customers where organization_id = $1`, [createdA.organization_id])).rows[0].count, preserved);

    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    assert.equal((await db.query(`select id from customers`)).rows.length, 0);
    assert.equal((await db.query(`select id from customer_notes`)).rows.length, 0);
    assert.equal((await db.query(`select id from customer_activities`)).rows.length, 0);
    assert.equal((await db.query(`update customers set display_name = 'Stolen' returning id`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into customers (organization_id, display_name) values ($1, 'Booking Person')`, [createdB.organization_id]),
      /customer directory is not included/,
    );
    await assert.rejects(
      db.query(`insert into customers (organization_id, display_name) values ($1, 'Cross tenant')`, [createdA.organization_id]),
      /customer directory is not included/,
    );
    await assert.rejects(
      db.query(`insert into customer_notes (organization_id, customer_id, body) values ($1, $2, 'Booking note')`, [createdB.organization_id, reused.id]),
      /customer directory is not included|customer is not in this organization/,
    );
    await assert.rejects(
      db.query(`insert into customer_activities (organization_id, customer_id, kind, summary) values ($1, $2, 'note', 'Booking activity')`, [createdB.organization_id, reused.id]),
      /permission denied/i,
    );
    await db.exec('reset role');
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [createdB.organization_id])).rows.length, 0);
  } finally {
    await db.close();
  }
});
