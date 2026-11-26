import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fixtureWebsiteContent } from '../server/website-schema.mjs';
import { createBookingMessageDeliver, startBookingMessageWorker } from '../server/booking-message-worker.mjs';

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

test('fixture booking path and contact_form keep website-only contact separate from CRM', async () => {
  const withBooking = fixtureWebsiteContent({
    businessName: 'Harbor Dental',
    industry: 'dentistry',
    description: 'Family dentistry with clear scheduling and practical aftercare for local patients.',
    maxPages: 3,
    bookingPath: '/book/harbor-dental',
  });
  assert.equal(withBooking.pages[0].sections[0].ctaHref, '/book/harbor-dental');
  const contact = withBooking.pages.find(page => page.slug === 'contact');
  assert.ok(contact.sections.some(section => section.type === 'contact_form'));

  const websiteOnly = fixtureWebsiteContent({
    businessName: 'Cedar Studio',
    description: 'Portrait sessions and simple packages for local families who want clear scheduling options.',
    maxPages: 3,
  });
  assert.equal(websiteOnly.pages[0].sections[0].ctaHref, '/contact');
  assert.ok(websiteOnly.pages.find(page => page.slug === 'contact').sections.some(section => section.type === 'contact_form'));
});

test('inquiry RPC stores messages without creating customers; public page exposes booking path when published', async () => {
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
       values ($1, '10000000-0000-4000-8000-000000000401', 'website-crm', 149900, 'usd', 'owner-a@example.test', 'paid')`,
      [orderId],
    );
    const provisioned = await db.query(
      `select public.crm_provision_organization($1::uuid, $2, 'joshua@nextwavedigitalsolution.com') as result`,
      [orderId, hash(token)],
    );
    const orgId = provisioned.rows[0].result.organization_id;
    await db.query(`select public.crm_accept_invitation($1::uuid, 'owner-a@example.test', $2)`, [userId, hash(token)]);

    const site = await db.query(`select id, slug, draft_revision_id from public.websites where organization_id = $1`, [orgId]);
    const org = await db.query(`select slug from public.organizations where id = $1`, [orgId]);
    const content = fixtureWebsiteContent({
      businessName: 'Harbor Dental',
      description: 'Family dentistry with clear scheduling and practical aftercare for local patients.',
      maxPages: 5,
      bookingPath: `/book/${org.rows[0].slug}`,
    });
    content.unfinished = [];
    const saved = await db.query(
      `select public.website_save_draft($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5::integer) as result`,
      [orgId, userId, site.rows[0].draft_revision_id, JSON.stringify(content), content.pages.length],
    );
    await db.query(
      `select public.website_publish($1::uuid, $2::uuid, $3::uuid) as result`,
      [orgId, userId, saved.rows[0].result.revision_id],
    );

    const beforeCustomers = await db.query(`select count(*)::int as n from public.customers where organization_id = $1`, [orgId]);
    const inquiry = await db.query(
      `select public.website_submit_inquiry($1, 'Ada Guest', 'ada@example.test', '555-0100', 'Looking for a cleaning appointment next week.') as result`,
      [site.rows[0].slug],
    );
    assert.equal(inquiry.rows[0].result.created, true);
    const afterCustomers = await db.query(`select count(*)::int as n from public.customers where organization_id = $1`, [orgId]);
    assert.equal(afterCustomers.rows[0].n, beforeCustomers.rows[0].n);
    const stored = await db.query(`select email, body from public.website_inquiries where organization_id = $1`, [orgId]);
    assert.equal(stored.rows[0].email, 'ada@example.test');
    assert.match(stored.rows[0].body, /cleaning appointment/i);

    const unpublished = await db.query(`select public.website_public_page($1) as page`, [site.rows[0].slug]);
    assert.equal(unpublished.rows[0].page.booking_enabled, false);
    assert.equal(unpublished.rows[0].page.booking_path, null);
    assert.equal(unpublished.rows[0].page.contact_enabled, true);

    // Bypass booking-setup validation to assert public-page path wiring only.
    await db.exec(`alter table public.organization_settings disable trigger user`);
    await db.query(`update public.organization_settings set booking_published = true where organization_id = $1`, [orgId]);
    await db.exec(`alter table public.organization_settings enable trigger user`);
    const publicPage = await db.query(`select public.website_public_page($1) as page`, [site.rows[0].slug]);
    assert.equal(publicPage.rows[0].page.booking_enabled, true);
    assert.equal(publicPage.rows[0].page.booking_path, `/book/${org.rows[0].slug}`);
    assert.equal(publicPage.rows[0].page.contact_enabled, true);
  } finally {
    await db.close();
  }
});

test('booking message worker delivers through Resend when configured and stays off otherwise', async () => {
  const calls = [];
  const deliver = createBookingMessageDeliver({
    resendKey: 're_test_key_12345678',
    fromEmail: 'bookings@example.test',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ id: 'email_1' }) };
    },
  });
  await deliver({
    to: 'guest@example.test',
    subject: 'Confirmed',
    text: 'See you soon',
    html: '<p>See you soon</p>',
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  });
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].body.to[0], 'guest@example.test');

  const disabled = startBookingMessageWorker({
    url: 'https://example.supabase.co',
    serviceKey: 'service-role-key-not-for-browser-use',
    resendKey: '',
    fromEmail: '',
  });
  assert.equal(disabled.enabled, false);
});
