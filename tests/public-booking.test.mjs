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
const keyOne = 'a'.repeat(32);
const keyTwo = 'b'.repeat(32);
const keyThree = 'c'.repeat(32);
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
  return names;
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

test('a guest books one open time and cannot double-book or cross tenants', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    const applied = await applyMigrations(db);
    assert.ok(applied.includes('20261104120000_public_booking.sql'));
    const definers = await db.query(`
      select p.proname, r.rolname as owner, p.prosecdef
      from pg_proc p
      join pg_roles r on r.oid = p.proowner
      where p.pronamespace = 'public'::regnamespace
        and p.proname in ('booking_public_page', 'booking_open_slots', 'booking_create_appointment', 'booking_slot_is_open', 'crm_prepare_appointment')
    `);
    assert.equal(definers.rows.length, 5);
    for (const row of definers.rows) {
      assert.equal(row.owner, 'service_role', row.proname);
      assert.equal(row.prosecdef, true, row.proname);
    }
    assert.equal((await db.query(`select has_table_privilege('anon', 'public.appointments', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.appointments', 'insert') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.booking_slot_is_open(uuid,uuid,timestamptz)', 'execute') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.booking_create_appointment(text,uuid,timestamptz,text,text,text,text)', 'execute') as ok`)).rows[0].ok, true);

    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test'), ($2, 'owner-b@example.test')`, [userA, userB]);
    await db.query(`insert into service_orders (id, request_id, package_id, amount, currency, email, status) values
      ($1, '10000000-0000-4000-8000-000000000021', 'website-crm', 149900, 'usd', 'owner-a@example.test', 'paid'),
      ($2, '10000000-0000-4000-8000-000000000022', 'booking-only', 79900, 'usd', 'owner-b@example.test', 'paid')`, [orderA, orderB]);
    await db.query(`insert into customer_intakes (order_id, business_name, requirements) values
      ($1, 'Harbor Studio', 'Weekday hours'),
      ($2, 'North Booking', 'Appointments')`, [orderA, orderB]);
    await useRole(db, 'service_role');
    const createdA = (await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderA, hash(tokenA)])).rows[0].result;
    const createdB = (await db.query(`select crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`, [orderB, hash(tokenB)])).rows[0].result;
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userA, hash(tokenA)]);
    await db.query(`select crm_accept_invitation($1::uuid, 'owner-b@example.test', $2)`, [userB, hash(tokenB)]);
    await db.exec('reset role');
    const orgA = createdA.organization_id;
    const orgB = createdB.organization_id;
    const slugA = (await db.query(`select slug from organizations where id = $1`, [orgA])).rows[0].slug;
    const slugB = (await db.query(`select slug from organizations where id = $1`, [orgB])).rows[0].slug;

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const serviceA = (await db.query(
      `insert into services (organization_id, name, duration_minutes) values ($1, 'Consultation', 60) returning id`,
      [orgA],
    )).rows[0];
    await assert.rejects(
      db.query(`update organization_settings set booking_published = true where organization_id = $1`, [orgA]),
      /publish requires weekly hours/,
    );
    const calendarA = (await db.query(`insert into calendars (organization_id, name) values ($1, 'Staff calendar') returning id`, [orgA])).rows[0];
    await db.query(
      `insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 1, 540, 600)`,
      [orgA, calendarA.id],
    );
    await db.query(`update organization_settings set booking_published = true where organization_id = $1`, [orgA]);
    assert.equal((await db.query(`select id from appointments`)).rows.length, 0);
    await db.exec('reset role');

    await useRole(db, 'anon');
    assert.equal(json((await db.query(`select booking_public_page($1) as page`, [slugB])).rows[0].page), null);
    assert.equal(json((await db.query(`select booking_public_page('missing-studio') as page`)).rows[0].page), null);
    const page = json((await db.query(`select booking_public_page($1) as page`, [slugA])).rows[0].page);
    assert.equal(page.business_name, 'Harbor Studio');
    assert.equal(page.organization_id, undefined);
    assert.equal(page.services.length, 1);
    assert.equal(page.services[0].id, serviceA.id);
    const slots = json((await db.query(`select booking_open_slots($1, $2) as slots`, [slugA, serviceA.id])).rows[0].slots);
    assert.ok(slots.length >= 1);
    const start = slots[0].starts_at;
    const localHour = (await db.query(
      `select extract(hour from ($1::timestamptz at time zone 'America/New_York'))::int as hour,
              extract(minute from ($1::timestamptz at time zone 'America/New_York'))::int as minute`,
      [start],
    )).rows[0];
    assert.equal(localHour.hour, 9);
    assert.equal(localHour.minute, 0);
    await db.exec('begin');
    const locked = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'Ada@Example.test', '555-0100', $4) as result`,
      [slugA, serviceA.id, start, keyOne],
    )).rows[0].result);
    const held = await db.query(`select mode from pg_locks where relation = 'public.calendars'::regclass and granted`);
    assert.ok(held.rows.some(row => String(row.mode).includes('Row')));
    await db.exec('rollback');
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from appointments`)).rows[0].count, 0);

    await useRole(db, 'anon');
    const booked = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'Ada@Example.test', '555-0100', $4) as result`,
      [slugA, serviceA.id, start, keyOne],
    )).rows[0].result);
    assert.equal(booked.duplicate, false);
    assert.equal(booked.business_name, 'Harbor Studio');
    assert.equal(booked.service_name, 'Consultation');
    const replay = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'Ada@Example.test', '555-0100', $4) as result`,
      [slugA, serviceA.id, start, keyOne],
    )).rows[0].result);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.appointment_id, booked.appointment_id);
    await assert.rejects(
      db.query(
        `select booking_create_appointment($1, $2, $3::timestamptz, 'Ada Guest', 'other@example.test', '555-0100', $4)`,
        [slugA, serviceA.id, start, keyOne],
      ),
      /idempotency conflict/,
    );
    await assert.rejects(
      db.query(
        `select booking_create_appointment($1, $2, $3::timestamptz, 'Bea Guest', 'bea@example.test', '555-0199', $4)`,
        [slugA, serviceA.id, start, keyTwo],
      ),
      /slot is not open/,
    );
    await assert.rejects(
      db.query(
        `select booking_create_appointment($1, $2, $3::timestamptz + interval '30 minutes', 'Bea Guest', 'bea@example.test', '555-0199', $4)`,
        [slugA, serviceA.id, start, keyTwo],
      ),
      /slot is not open/,
    );
    await assert.rejects(
      db.query(`select booking_create_appointment($1, $2, $3::timestamptz, 'North Guest', 'north@example.test', '555-0101', $4)`, [slugB, serviceA.id, start, keyThree]),
      /booking is not available/,
    );
    const afterConflict = json((await db.query(`select booking_open_slots($1, $2) as slots`, [slugA, serviceA.id])).rows[0].slots);
    assert.equal(afterConflict.some(slot => slot.starts_at === start || new Date(slot.starts_at).toISOString() === new Date(start).toISOString()), false);
    await db.exec('reset role');

    await useRole(db, 'service_role');
    await assert.rejects(
      db.query(
        `insert into appointments (organization_id, calendar_id, service_id, guest_name, guest_email, guest_phone, starts_at, ends_at, timezone, idempotency_key)
         values ($1, $2, $3, 'Overlap', 'overlap@example.test', '555-0102', $4::timestamptz, $4::timestamptz + interval '60 minutes', 'America/New_York', $5)`,
        [orgA, calendarA.id, serviceA.id, start, 'd'.repeat(32)],
      ),
      /appointment conflict/,
    );
    await db.exec('reset role');
    const stored = (await db.query(`select guest_email, guest_phone, timezone from appointments where id = $1`, [booked.appointment_id])).rows[0];
    assert.equal(stored.guest_email, 'ada@example.test');
    assert.equal(stored.guest_phone, '555-0100');
    assert.equal(stored.timezone, 'America/New_York');
    assert.equal((await db.query(`select count(*)::int as count from appointments`)).rows[0].count, 1);

    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    assert.equal((await db.query(`select id from appointments`)).rows.length, 0);
    assert.equal((await db.query(`update appointments set status = 'cancelled' returning id`)).rows.length, 0);
    await db.exec('reset role');

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select guest_email from appointments`)).rows[0].guest_email, 'ada@example.test');
    await assert.rejects(
      db.query(`update appointments set guest_name = 'Changed' where id = $1`, [booked.appointment_id]),
      /appointment cannot change/,
    );
    await db.query(`update appointments set status = 'cancelled' where id = $1`, [booked.appointment_id]);
    await db.exec('reset role');

    await useRole(db, 'anon');
    const reopened = json((await db.query(`select booking_open_slots($1, $2) as slots`, [slugA, serviceA.id])).rows[0].slots);
    assert.equal(reopened.some(slot => new Date(slot.starts_at).toISOString() === new Date(start).toISOString()), true);
    const again = json((await db.query(
      `select booking_create_appointment($1, $2, $3::timestamptz, 'Bea Guest', 'bea@example.test', '555-0199', $4) as result`,
      [slugA, serviceA.id, start, keyTwo],
    )).rows[0].result);
    assert.equal(again.duplicate, false);
    assert.notEqual(again.appointment_id, booked.appointment_id);
    await db.exec('reset role');

    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'suspended', 'joshua@nextwavedigitalsolution.com')`, [orgA]);
    await db.exec('reset role');
    const preserved = (await db.query(`select count(*)::int as count from appointments where organization_id = $1`, [orgA])).rows[0].count;
    assert.equal(preserved, 2);
    await useRole(db, 'anon');
    assert.equal(json((await db.query(`select booking_public_page($1) as page`, [slugA])).rows[0].page), null);
    await assert.rejects(
      db.query(
        `select booking_create_appointment($1, $2, $3::timestamptz, 'Cara Guest', 'cara@example.test', '555-0133', $4)`,
        [slugA, serviceA.id, start, keyThree],
      ),
      /booking is not available/,
    );
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from appointments where organization_id = $1`, [orgA])).rows[0].count, preserved);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from appointments`)).rows.length, 0);
    await db.exec('reset role');

    await db.exec('set role anon');
    await assert.rejects(db.query(`select id from appointments`), /permission denied/i);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
