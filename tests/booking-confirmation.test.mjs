import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const orderA = '11111111-1111-4111-8111-111111111111';
const orderB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tokenA = 'a'.repeat(64);
const tokenB = 'b'.repeat(64);
const hash = token => createHash('sha256').update(token).digest('hex');
const json = value => typeof value === 'string' ? JSON.parse(value) : value;

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

test('a website CRM booking links the guest, queues one confirmation, and schedules the saved reminder', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    await applyMigrations(db);
    assert.equal((await db.query(`select has_table_privilege('anon', 'public.booking_messages', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.booking_customer_intents', 'insert') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.booking_messages_claim(integer)', 'execute') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('service_role', 'public.booking_messages_claim(integer)', 'execute') as ok`)).rows[0].ok, true);

    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test'), ($2, 'owner-b@example.test')`, [userA, userB]);
    await db.query(`insert into service_orders (id, request_id, package_id, amount, currency, email, status) values
      ($1, '10000000-0000-4000-8000-000000000031', 'website-crm', 149900, 'usd', 'owner-a@example.test', 'paid'),
      ($2, '10000000-0000-4000-8000-000000000032', 'booking-only', 79900, 'usd', 'owner-b@example.test', 'paid')`, [orderA, orderB]);
    await db.query(`insert into customer_intakes (order_id, business_name, requirements) values
      ($1, 'Harbor Studio', 'Weekday hours'),
      ($2, 'North Booking', 'Appointments')`, [orderA, orderB]);
    await useRole(db, 'service_role');
    const createdA = json((await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderA, hash(tokenA)])).rows[0].result);
    const createdB = json((await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderB, hash(tokenB)])).rows[0].result);
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userA, hash(tokenA)]);
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-b@example.test', $2)`, [userB, hash(tokenB)]);
    await db.exec('reset role');
    const orgA = createdA.organization_id;
    const orgB = createdB.organization_id;

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const serviceA = await publishAs(db, orgA, 'Consultation');
    await db.query(`update organization_settings set reminder_template = 'See you tomorrow' where organization_id = $1`, [orgA]);
    await db.exec('reset role');
    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    const serviceB = await publishAs(db, orgB, 'Visit');
    await db.exec('reset role');

    const slugA = (await db.query(`select slug from organizations where id = $1`, [orgA])).rows[0].slug;
    const slugB = (await db.query(`select slug from organizations where id = $1`, [orgB])).rows[0].slug;
    await useRole(db, 'anon');
    const slots = json((await db.query(`select booking_open_slots($1, $2) as slots`, [slugA, serviceA])).rows[0].slots);
    const later = slots.find(slot => new Date(slot.starts_at).getTime() > Date.now() + 24 * 60 * 60 * 1000);
    assert.ok(later);
    const booked = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'Ada@Example.test', '555-0100', $4) as result`,
      [slugA, serviceA, later.starts_at, 'e'.repeat(32)],
    )).rows[0].result);
    assert.equal(booked.confirmation_queued, true);
    const replay = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'Ada@Example.test', '555-0100', $4) as result`,
      [slugA, serviceA, later.starts_at, 'e'.repeat(32)],
    )).rows[0].result);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.confirmation_queued, true);
    await db.exec('reset role');

    const customer = (await db.query(`select display_name, email, phone, lead_stage from customers where organization_id = $1`, [orgA])).rows;
    assert.equal(customer.length, 1);
    assert.equal(customer[0].email, 'ada@example.test');
    assert.equal(customer[0].lead_stage, 'booked');
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [orgA])).rows[0].customer_count, 1);
    const linked = (await db.query(`select customer_id from appointments where id = $1`, [booked.appointment_id])).rows[0].customer_id;
    assert.equal(linked, (await db.query(`select id from customers where organization_id = $1`, [orgA])).rows[0].id);
    const messages = (await db.query(
      `select kind, recipient_email, status, body, scheduled_for from booking_messages where appointment_id = $1 order by kind`,
      [booked.appointment_id],
    )).rows;
    assert.deepEqual(messages.map(row => row.kind), ['confirmation', 'reminder']);
    assert.equal(messages[0].recipient_email, 'ada@example.test');
    assert.equal(messages[0].status, 'pending');
    assert.match(messages[1].body, /See you tomorrow/);
    assert.ok(new Date(messages[1].scheduled_for).getTime() > Date.now());
    assert.equal((await db.query(`select count(*)::int as count from booking_customer_intents`)).rows[0].count, 0);

    const next = slots.find(slot => slot.starts_at !== later.starts_at);
    assert.ok(next);
    await useRole(db, 'anon');
    const second = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'ada@example.test', '555-0100', $4) as result`,
      [slugA, serviceA, next.starts_at, 'f'.repeat(32)],
    )).rows[0].result);
    assert.equal(second.confirmation_queued, true);
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from customers where organization_id = $1`, [orgA])).rows[0].count, 1);
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [orgA])).rows[0].customer_count, 1);

    await useRole(db, 'service_role');
    const claimed = (await db.query(`select id, appointment_id, kind, lease_id from booking_messages_claim(10)`)).rows;
    assert.ok(claimed.length >= 1);
    assert.equal(claimed.every(row => row.kind === 'confirmation'), true);
    const firstClaim = claimed.find(row => row.appointment_id === booked.appointment_id);
    assert.ok(firstClaim);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    await db.query(`update appointments set status = 'cancelled' where id = $1`, [booked.appointment_id]);
    await db.exec('reset role');
    const afterCancel = (await db.query(`select kind, status from booking_messages where appointment_id = $1 order by kind`, [booked.appointment_id])).rows;
    assert.deepEqual(afterCancel.map(row => row.status), ['cancelled', 'cancelled']);
    await useRole(db, 'service_role');
    const finished = json((await db.query(
      `select booking_messages_finish($1::uuid, $2::uuid, true) as result`,
      [firstClaim.id, firstClaim.lease_id],
    )).rows[0].result);
    assert.equal(finished.status, 'cancelled');
    await db.exec('reset role');
    assert.equal((await db.query(`select status from booking_messages where id = $1`, [firstClaim.id])).rows[0].status, 'cancelled');

    await useRole(db, 'anon');
    const bookingOnlySlots = json((await db.query(`select booking_open_slots($1, $2) as slots`, [slugB, serviceB])).rows[0].slots);
    const bookedOnly = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Bea Guest', 'bea@example.test', '555-0199', $4) as result`,
      [slugB, serviceB, bookingOnlySlots[0].starts_at, 'g'.repeat(32)],
    )).rows[0].result);
    assert.equal(bookedOnly.confirmation_queued, false);
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from customers where organization_id = $1`, [orgB])).rows[0].count, 0);
    assert.equal((await db.query(`select count(*)::int as count from booking_messages where organization_id = $1`, [orgB])).rows[0].count, 0);

    await db.query(`insert into customer_capacity (organization_id, customer_count) values ($1, 1000) on conflict (organization_id) do update set customer_count = 1000`, [orgA]);
    await useRole(db, 'anon');
    const cappedSlot = slots.find(slot => slot.starts_at !== later.starts_at && slot.starts_at !== next.starts_at);
    assert.ok(cappedSlot);
    const capped = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Cara Guest', 'cara@example.test', '555-0133', $4) as result`,
      [slugA, serviceA, cappedSlot.starts_at, 'h'.repeat(32)],
    )).rows[0].result);
    assert.equal(capped.duplicate, false);
    await db.exec('reset role');
    assert.equal((await db.query(`select customer_id from appointments where id = $1`, [capped.appointment_id])).rows[0].customer_id, null);
    assert.equal((await db.query(`select count(*)::int as count from customers where email = 'cara@example.test'`)).rows[0].count, 0);
    assert.equal((await db.query(`select customer_count from customer_capacity where organization_id = $1`, [orgA])).rows[0].customer_count, 1000);

    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    assert.equal((await db.query(`select id from customers`)).rows.length, 0);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

async function publishAs(db, organizationId, serviceName) {
  const service = (await db.query(
    `insert into services (organization_id, name, duration_minutes) values ($1, $2, 60) returning id`,
    [organizationId, serviceName],
  )).rows[0];
  const calendar = (await db.query(
    `insert into calendars (organization_id, name) values ($1, 'Staff calendar') returning id`,
    [organizationId],
  )).rows[0];
  await db.query(
    `insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute)
     select $1, $2, weekday, 540, 1020 from generate_series(0, 6) as weekday`,
    [organizationId, calendar.id],
  );
  await db.query(`update organization_settings set booking_published = true where organization_id = $1`, [organizationId]);
  return service.id;
}
