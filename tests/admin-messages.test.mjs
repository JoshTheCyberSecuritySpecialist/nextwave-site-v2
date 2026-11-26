import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createAdminMessages } from '../server/admin-messages.mjs';
import { productionServer } from '../server/production-server.mjs';

const serviceKey = 'service-role-key-not-for-browser-use';
const adminJwt = 'header.payload.signature';
const messageId = '11111111-1111-4111-8111-111111111111';
const replyId = '22222222-2222-4222-8222-222222222222';
const fromEmail = 'NextWave Digital Solutions <joshua@nextwavedigitalsolution.com>';

function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function messageRecord(overrides = {}) {
  return {
    id: messageId,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '555-0100',
    business_name: 'Analytical Engines',
    service: 'Website + Booking + CRM — $1,499',
    body: 'We need a booking page for weekday appointments.',
    status: 'open',
    created_at: '2026-11-26T15:00:00Z',
    ...overrides,
  };
}

test('admin messages stay limited to the admin and the stored recipient', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const href = String(url);
    calls.push({ href, options });
    if (href.endsWith('/auth/v1/user')) {
      const email = options.headers.Authorization.endsWith(adminJwt) ? 'Joshua@nextwavedigitalsolution.com' : 'other@example.com';
      return json({ email });
    }
    if (href === 'https://api.resend.com/emails') return json({ id: 'email-1' });
    if (href.includes('/site_messages') && options.method === 'GET') {
      const id = new URL(href).searchParams.get('id');
      if (id && !id.endsWith(messageId)) return json([]);
      return json([messageRecord()]);
    }
    if (href.includes('/site_message_replies') && options.method === 'GET') {
      return json([{ id: replyId, body: 'Earlier note', sent_at: '2026-11-26T16:00:00Z' }]);
    }
    if (href.includes('/site_message_replies') && options.method === 'POST') {
      const payload = JSON.parse(options.body);
      return json([{ id: replyId, body: payload.body, sent_at: '2026-11-26T17:00:00Z' }]);
    }
    if (href.includes('/site_messages') && options.method === 'PATCH') {
      assert.equal(new URL(href).searchParams.get('id'), `eq.${messageId}`);
      return json([{ ...messageRecord(), status: 'replied' }]);
    }
    return json([], 500);
  };
  const messages = createAdminMessages({
    url: 'https://example.supabase.co',
    serviceKey,
    fetchImpl,
    resendKey: 're_test_key_value',
    fromEmail,
  });

  await assert.rejects(messages.list('not-a-jwt'), /Unauthorized/);
  await assert.rejects(messages.list(serviceKey), /Unauthorized/);
  await assert.rejects(messages.list('aa.bb.cc'), /Unauthorized/);

  const list = await messages.list(adminJwt);
  assert.equal(list.messages[0].email, 'ada@example.com');
  assert.equal(list.messages[0].preview.includes('weekday'), true);
  assert.equal(list.messages[0].body, undefined);
  assert.equal(JSON.stringify(list).includes(serviceKey), false);

  const detail = await messages.get(adminJwt, messageId.toUpperCase());
  assert.equal(detail.message.body, 'We need a booking page for weekday appointments.');
  assert.equal(detail.replies[0].body, 'Earlier note');
  await assert.rejects(messages.get(adminJwt, '00000000-0000-4000-8000-000000000000'), /Not found/);
  await assert.rejects(messages.reply(adminJwt, messageId, { body: '  ' }), /Invalid reply/);
  const sent = await messages.reply(adminJwt, messageId, { body: 'Thanks for writing.', to: 'evil@example.com' });
  assert.equal(sent.status, 'replied');
  assert.equal(sent.reply.body, 'Thanks for writing.');
  const emailCall = calls.find(call => call.href === 'https://api.resend.com/emails');
  const email = JSON.parse(emailCall.options.body);
  assert.deepEqual(email.to, ['ada@example.com']);
  assert.equal(email.reply_to, 'joshua@nextwavedigitalsolution.com');
  assert.equal(email.subject, 'Re: Website + Booking + CRM — $1,499');
  assert.match(email.text, /^Thanks for writing\./);
  assert.equal(JSON.stringify(email).includes('evil@example.com'), false);
  assert.equal(JSON.stringify(sent).includes(serviceKey), false);
  const stored = JSON.parse(calls.find(call => call.href.includes('/site_message_replies') && call.options.method === 'POST').options.body);
  assert.equal(stored.message_id, messageId);
  assert.equal(stored.body, 'Thanks for writing.');
  assert.equal(stored.to, undefined);
});

test('a reply is not stored when email is not configured or the provider rejects it', async () => {
  let writes = 0;
  const fetchImpl = async (url, options) => {
    const href = String(url);
    if (href.endsWith('/auth/v1/user')) return json({ email: 'joshua@nextwavedigitalsolution.com' });
    if (href.includes('/site_messages') && options.method === 'GET') return json([messageRecord({ body: `${'word '.repeat(80)}tail-secret` })]);
    if (href === 'https://api.resend.com/emails') return json({ error: 'rejected' }, 422);
    writes += options.method === 'POST' || options.method === 'PATCH' ? 1 : 0;
    return json([], 500);
  };
  const unconfigured = createAdminMessages({ url: 'https://example.supabase.co', serviceKey, fetchImpl });
  await assert.rejects(unconfigured.reply(adminJwt, messageId, { body: 'Hello' }), /Email replies are not configured/);
  const configured = createAdminMessages({
    url: 'https://example.supabase.co', serviceKey, fetchImpl, resendKey: 're_test_key_value', fromEmail,
  });
  const listed = await configured.list(adminJwt);
  assert.match(listed.messages[0].preview, /…$/);
  assert.equal(listed.messages[0].preview.includes('tail-secret'), false);
  await assert.rejects(configured.reply(adminJwt, messageId, { body: 'Hello' }), /The reply could not be sent/);
  assert.equal(writes, 0);
});

test('message routes require the admin session and do not replace orders', async () => {
  const server = productionServer({
    payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'] },
    messages: {
      async list() { return { messages: [] }; },
      async get() { throw Error('Not found'); },
      async reply() { throw Error('Invalid reply'); },
    },
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const origin = { Origin: 'http://127.0.0.1:5173' };
    let response = await fetch(`${base}/api/admin/messages`, { headers: origin });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/admin/messages`, { headers: { ...origin, Authorization: 'Bearer header.payload.signature' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { messages: [] });
    response = await fetch(`${base}/api/admin/messages/${messageId}`, { headers: { ...origin, Authorization: 'Bearer header.payload.signature' } });
    assert.equal(response.status, 404);
    response = await fetch(`${base}/api/admin/messages/${messageId}/reply`, {
      method: 'POST',
      headers: { ...origin, Authorization: 'Bearer header.payload.signature', 'Content-Type': 'application/json' },
      body: '{',
    });
    assert.equal(response.status, 400);
    const closed = productionServer({
      payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'] },
      env: {},
    });
    await new Promise((resolve, reject) => closed.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
    try {
      response = await fetch(`http://127.0.0.1:${closed.address().port}/api/admin/messages`, { headers: { ...origin, Authorization: 'Bearer header.payload.signature' } });
      assert.equal(response.status, 404);
    } finally {
      await new Promise(resolve => { closed.close(resolve); closed.closeAllConnections?.(); });
    }
    const source = await readFile(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');
    const page = await readFile(new URL('../src/pages/AdminMessages.tsx', import.meta.url), 'utf8');
    const contact = await readFile(new URL('../supabase/functions/create-hubspot-contact/index.ts', import.meta.url), 'utf8');
    assert.match(source, /\/admin\/messages/);
    assert.match(page, /\/api\/admin\/messages/);
    assert.equal(page.includes('service_role'), false);
    assert.equal(page.includes('RESEND'), false);
    assert.match(contact, /\/rest\/v1\/site_messages/);
    assert.match(contact, /escapeHtml\(contactData\.message\)/);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
});

test('contact messages are not readable by the browser roles', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin noinherit;
      create role authenticated nologin noinherit;
      create role service_role nologin bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `);
    const sql = await readFile(new URL('../supabase/migrations/20261126143000_site_messages.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    assert.equal((await db.query(`select has_table_privilege('anon', 'public.site_messages', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.site_messages', 'insert') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('authenticated', 'public.site_message_replies', 'select') as ok`)).rows[0].ok, false);
    assert.equal((await db.query(`select has_table_privilege('service_role', 'public.site_messages', 'update') as ok`)).rows[0].ok, true);
    await assert.rejects(db.query(`insert into site_messages (name, email, body) values ('Ada', 'Not-An-Email', 'Hello there')`));
    const inserted = await db.query(
      `insert into site_messages (name, email, business_name, service, body) values ('Ada', 'ada@example.com', 'Analytical Engines', 'Booking', 'We need weekday hours') returning id`,
    );
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from site_messages'));
    await db.exec('reset role');
    await db.query(`insert into site_message_replies (message_id, body) values ($1, 'We can set that up.')`, [inserted.rows[0].id]);
  } finally {
    await db.close();
  }
});
