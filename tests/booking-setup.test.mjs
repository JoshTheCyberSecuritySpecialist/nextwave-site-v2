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

test('booking setup isolates services and hours and caps website services at 10', async () => {
  const db = new PGlite();
  try {
    await db.exec(bootstrap);
    const applied = await applyMigrations(db);
    assert.ok(applied.includes('20261103160000_booking_setup.sql'));
    const bookingSql = await readFile(new URL('../supabase/migrations/20261103160000_booking_setup.sql', import.meta.url), 'utf8');
    assert.equal(/\b(drop table|truncate)\b/i.test(bookingSql), false);
    assert.equal(/next_count\s*>\s*10/.test(bookingSql), false);
    assert.match(bookingSql, /seat_cap is not null and next_count > seat_cap/);

    const definers = await db.query(`
      select p.proname, r.rolname as owner, r.rolsuper, r.rolbypassrls, p.prosecdef, coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p
      join pg_roles r on r.oid = p.proowner
      where p.pronamespace = 'public'::regnamespace
        and p.proname in ('crm_prepare_service', 'crm_release_service', 'crm_prepare_calendar', 'crm_prepare_weekly_hours')
    `);
    for (const name of ['crm_prepare_service', 'crm_release_service', 'crm_prepare_calendar']) {
      const row = definers.rows.find(item => item.proname === name);
      assert.equal(row.owner, 'service_role', name);
      assert.equal(row.rolsuper, false, name);
      assert.equal(row.rolbypassrls, true, name);
      assert.equal(row.prosecdef, true, name);
      assert.match(row.config, /search_path=pg_catalog, public/, name);
    }
    const hoursPreparer = definers.rows.find(item => item.proname === 'crm_prepare_weekly_hours');
    assert.equal(hoursPreparer.prosecdef, false);
    const forced = await db.query(`
      select relname, relrowsecurity, relforcerowsecurity
      from pg_class
      where relname in ('services', 'calendars', 'weekly_hours', 'service_capacity')
    `);
    assert.equal(forced.rows.length, 4);
    for (const row of forced.rows) {
      assert.equal(row.relrowsecurity, true, row.relname);
      assert.equal(row.relforcerowsecurity, true, row.relname);
    }
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.service_capacity', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('anon', 'public.services', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.organization_settings', 'update') as ok`)).rows[0].ok, true);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.organization_settings', 'insert') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_function_privilege('anon', 'public.crm_prepare_service()', 'execute') as ok`)).rows[0].ok, false);
    const calendarUnique = await db.query(`
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename = 'calendars' and indexdef like '%UNIQUE%'
    `);
    assert.ok(calendarUnique.rows.some(row => row.indexdef.includes('organization_id')));

    await db.query(`insert into auth.users (id, email) values ($1, 'owner-a@example.test'), ($2, 'owner-b@example.test')`, [userA, userB]);
    await db.query(`insert into service_orders (id, request_id, package_id, amount, currency, email, status) values
      ($1, '10000000-0000-4000-8000-000000000011', 'website-crm', 149900, 'usd', 'owner-a@example.test', 'paid'),
      ($2, '10000000-0000-4000-8000-000000000012', 'booking-only', 79900, 'usd', 'owner-b@example.test', 'paid')`, [orderA, orderB]);
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

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    await db.exec('begin');
    await db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'Lock probe', 30)`, [orgA]);
    const heldLocks = await db.query(`
      select mode from pg_locks
      where relation = 'public.service_capacity'::regclass and granted
    `);
    assert.ok(heldLocks.rows.some(row => String(row.mode).includes('Row')));
    await db.exec('rollback');
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from services where organization_id = $1`, [orgA])).rows[0].count, 0);

    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    const saved = (await db.query(
      `update organization_settings
       set business_name = ' Harbor Studio ', phone = ' 555-0100 ', email = 'Owner@Example.test',
           location = ' 12 Dock Street ', brand_primary = '#112233', brand_accent = '#abcdef',
           booking_intro = ' Book a visit ', policies = ' Cancel one day ahead ',
           timezone = 'America/Chicago',
           hours = '[{"weekday":1,"start_minute":540,"end_minute":1020}]'::jsonb
       where organization_id = $1
       returning business_name, phone, email, location, brand_primary, brand_accent, booking_intro, policies, timezone`,
      [orgA],
    )).rows[0];
    assert.equal(saved.business_name, 'Harbor Studio');
    assert.equal(saved.phone, '555-0100');
    assert.equal(saved.email, 'owner@example.test');
    assert.equal(saved.location, '12 Dock Street');
    assert.equal(saved.brand_primary, '#112233');
    assert.equal(saved.brand_accent, '#ABCDEF');
    assert.equal(saved.booking_intro, 'Book a visit');
    assert.equal(saved.policies, 'Cancel one day ahead');
    assert.equal(saved.timezone, 'America/Chicago');
    await db.query(`update organization_settings set reminder_template = 'See you tomorrow' where organization_id = $1`, [orgA]);
    await assert.rejects(
      db.query(`update organization_settings set organization_id = $1 where organization_id = $2`, [orgB, orgA]),
      /organization cannot change/,
    );
    await assert.rejects(
      db.query(`update organization_settings set hours = to_jsonb(repeat('a', 20)) where organization_id = $1`, [orgA]),
      /hours must be a weekly schedule/,
    );
    const calendarA = (await db.query(
      `insert into calendars (organization_id, name) values ($1, 'Staff calendar') returning id`,
      [orgA],
    )).rows[0];
    await assert.rejects(
      db.query(`insert into calendars (organization_id, name) values ($1, 'Second calendar')`, [orgA]),
      /calendar cap exceeded/,
    );
    await db.query(
      `insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 1, 540, 1020)`,
      [orgA, calendarA.id],
    );
    await assert.rejects(
      db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'Too short', 4)`, [orgA]),
      /duration_minutes/,
    );
    for (let index = 1; index <= 10; index += 1) {
      await db.query(`insert into services (organization_id, name, description, duration_minutes) values ($1, $2, '  ', 30)`, [orgA, `Service ${index}`]);
    }
    const cleaned = (await db.query(`select description from services where organization_id = $1 and name = 'Service 1'`, [orgA])).rows[0];
    assert.equal(cleaned.description, null);
    await assert.rejects(
      db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'Service 11', 30)`, [orgA]),
      /service cap exceeded/,
    );
    await db.query(`delete from services where organization_id = $1 and name = 'Service 10'`, [orgA]);
    await db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'Service 12', 30)`, [orgA]);
    await assert.rejects(
      db.query(`update services set organization_id = $1 where organization_id = $2 and name = 'Service 1'`, [orgB, orgA]),
      /organization cannot change/,
    );
    assert.equal((await db.query(`select id from services where organization_id = $1`, [orgB])).rows.length, 0);
    assert.equal((await db.query(`select id from calendars where organization_id = $1`, [orgB])).rows.length, 0);
    assert.equal((await db.query(`select id from weekly_hours where organization_id = $1`, [orgB])).rows.length, 0);
    assert.equal((await db.query(`update services set name = 'Stolen' where organization_id = $1 returning id`, [orgB])).rows.length, 0);
    assert.equal((await db.query(`update weekly_hours set start_minute = 0 where organization_id = $1 returning id`, [orgB])).rows.length, 0);
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from services where organization_id = $1`, [orgA])).rows[0].count, 10);
    assert.equal((await db.query(`select service_count from service_capacity where organization_id = $1`, [orgA])).rows[0].service_count, 10);
    assert.equal((await db.query(`select start_minute from weekly_hours where organization_id = $1`, [orgA])).rows[0].start_minute, 540);

    await useRole(db, 'authenticated', { id: userB, email: 'owner-b@example.test' });
    assert.equal((await db.query(`select business_name, booking_intro from organization_settings`)).rows.length, 1);
    assert.equal((await db.query(`select booking_intro from organization_settings where organization_id = $1`, [orgA])).rows.length, 0);
    assert.equal((await db.query(`update organization_settings set booking_intro = 'Changed' where organization_id = $1 returning organization_id`, [orgA])).rows.length, 0);
    assert.equal((await db.query(`select id from services`)).rows.length, 0);
    assert.equal((await db.query(`select id from calendars`)).rows.length, 0);
    assert.equal((await db.query(`select id from weekly_hours`)).rows.length, 0);
    assert.equal((await db.query(`update services set name = 'Stolen' returning id`)).rows.length, 0);
    assert.equal((await db.query(`update weekly_hours set start_minute = 1 returning id`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'Cross tenant', 30)`, [orgA]),
      /booking setup is not available/,
    );
    await assert.rejects(
      db.query(`insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 2, 540, 1020)`, [orgA, calendarA.id]),
      /booking setup is not available/,
    );
    const calendarB = (await db.query(
      `insert into calendars (organization_id, name) values ($1, 'Staff calendar') returning id`,
      [orgB],
    )).rows[0];
    await assert.rejects(
      db.query(`insert into calendars (organization_id, name) values ($1, 'Another calendar')`, [orgB]),
      /calendar cap exceeded/,
    );
    await assert.rejects(
      db.query(
        `insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 1, 540, 1020)`,
        [orgB, calendarA.id],
      ),
      /calendar is not in this organization/,
    );
    await db.query(
      `insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 2, 600, 900)`,
      [orgB, calendarB.id],
    );
    const ownProfile = (await db.query(
      `update organization_settings set booking_intro = 'Choose a time', policies = 'Arrive early', timezone = 'America/Denver', hours = '[]'::jsonb where organization_id = $1 returning booking_intro`,
      [orgB],
    )).rows[0];
    assert.equal(ownProfile.booking_intro, 'Choose a time');
    await db.query(`update organization_settings set reminder_template = '   ' where organization_id = $1`, [orgB]);
    assert.equal((await db.query(`select reminder_template from organization_settings where organization_id = $1`, [orgB])).rows[0].reminder_template, null);
    await assert.rejects(
      db.query(`update organization_settings set reminder_template = 'We will text you' where organization_id = $1`, [orgB]),
      /messages are not included/,
    );
    for (let index = 1; index <= 11; index += 1) {
      await db.query(`insert into services (organization_id, name, duration_minutes) values ($1, $2, 45)`, [orgB, `Visit ${index}`]);
    }
    assert.equal((await db.query(`select count(*)::int as count from services`)).rows[0].count, 11);
    await db.exec('reset role');
    assert.equal((await db.query(`select booking_intro from organization_settings where organization_id = $1`, [orgA])).rows[0].booking_intro, 'Book a visit');
    assert.equal((await db.query(`select name from services where organization_id = $1 and name = 'Service 1'`, [orgA])).rows[0].name, 'Service 1');
    assert.equal((await db.query(`select start_minute from weekly_hours where calendar_id = $1`, [calendarA.id])).rows[0].start_minute, 540);
    assert.equal((await db.query(`select service_count from service_capacity where organization_id = $1`, [orgB])).rows[0].service_count, 11);
    assert.equal((await db.query(`select reminder_template from organization_settings where organization_id = $1`, [orgA])).rows[0].reminder_template, 'See you tomorrow');
    assert.equal((await db.query(`select reminder_template from organization_settings where organization_id = $1`, [orgB])).rows[0].reminder_template, null);

    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'suspended', 'joshua@nextwavedigitalsolution.com')`, [orgA]);
    await db.exec('reset role');
    const servicesBefore = (await db.query(`select count(*)::int as count from services where organization_id = $1`, [orgA])).rows[0].count;
    const hoursBefore = (await db.query(`select count(*)::int as count from weekly_hours where organization_id = $1`, [orgA])).rows[0].count;
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from services`)).rows.length, 0);
    assert.equal((await db.query(`select id from weekly_hours`)).rows.length, 0);
    assert.equal((await db.query(`update services set name = 'Hidden' returning id`)).rows.length, 0);
    assert.equal((await db.query(`update weekly_hours set start_minute = 0 returning id`)).rows.length, 0);
    assert.equal((await db.query(`update organization_settings set booking_intro = 'Closed' returning organization_id`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'While suspended', 30)`, [orgA]),
      /booking setup is not available/,
    );
    await assert.rejects(
      db.query(`insert into weekly_hours (organization_id, calendar_id, weekday, start_minute, end_minute) values ($1, $2, 3, 540, 1020)`, [orgA, calendarA.id]),
      /booking setup is not available/,
    );
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from services where organization_id = $1`, [orgA])).rows[0].count, servicesBefore);
    assert.equal((await db.query(`select count(*)::int as count from weekly_hours where organization_id = $1`, [orgA])).rows[0].count, hoursBefore);
    assert.equal((await db.query(`select booking_intro from organization_settings where organization_id = $1`, [orgA])).rows[0].booking_intro, 'Book a visit');
    await useRole(db, 'service_role');
    await db.query(`select crm_set_organization_status($1::uuid, 'active', 'joshua@nextwavedigitalsolution.com')`, [orgA]);
    await db.exec('reset role');

    await db.query(`update organization_members set status = 'disabled' where user_id = $1`, [userA]);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select id from services`)).rows.length, 0);
    assert.equal((await db.query(`select id from weekly_hours`)).rows.length, 0);
    assert.equal((await db.query(`update services set name = 'Disabled edit' returning id`)).rows.length, 0);
    assert.equal((await db.query(`delete from weekly_hours returning id`)).rows.length, 0);
    await assert.rejects(
      db.query(`insert into services (organization_id, name, duration_minutes) values ($1, 'While disabled', 30)`, [orgA]),
      /booking setup is not available/,
    );
    await assert.rejects(
      db.query(`insert into calendars (organization_id, name) values ($1, 'Disabled calendar')`, [orgA]),
      /booking setup is not available/,
    );
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from services where organization_id = $1`, [orgA])).rows[0].count, servicesBefore);
    assert.equal((await db.query(`select count(*)::int as count from weekly_hours where organization_id = $1`, [orgA])).rows[0].count, hoursBefore);
    await db.query(`update organization_members set status = 'active' where user_id = $1`, [userA]);
    await useRole(db, 'authenticated', { id: userA, email: 'owner-a@example.test' });
    assert.equal((await db.query(`select count(*)::int as count from services`)).rows[0].count, servicesBefore);
    await db.exec('reset role');

    await db.exec('set role anon');
    await assert.rejects(db.query(`select id from services`), /permission denied/i);
    await assert.rejects(db.query(`select id from weekly_hours`), /permission denied/i);
    await assert.rejects(db.query(`select organization_id from organization_settings`), /permission denied/i);
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
