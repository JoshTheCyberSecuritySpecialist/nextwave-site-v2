import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createStripe, createSupabaseDb, createStripePayments, deriveIntakeToken } from '../server/stripe-payments.mjs';
import { sign } from '../server/payments.mjs';
const secret = 'whsec_fake_test_secret';
const tokenSecret = 'dedicated-test-secret-at-least-32-bytes';
const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const hash = s => createHash('sha256').update(s).digest('hex');
function fixture() {
  let order, session, jobs = 0, fail = false;
  const events = new Map();
  const calls = [];
  const db = { async rpc(op, p) {
    calls.push({ op, p });
    if (fail) { fail = false; throw Error('DB offline'); }
    if (op === 'p3_checkout_prepare') {
      if (order && (order.email !== p.p_email || order.package_id !== p.p_package_id)) throw Error('Conflict');
      return order ??= { order_id: id, created_at: new Date().toISOString(), request_id: p.p_request_id, package_id: p.p_package_id, email: p.p_email, amount: p.p_package_id === 'booking-only' ? 79900 : 149900, currency: 'usd', status: 'pending' };
    }
    if (op === 'p3_checkout_attach') {
      if (order.stripe_session_id && order.stripe_session_id !== p.p_session_id) throw Error('Conflict');
      order.stripe_session_id = p.p_session_id; order.token_hash = p.p_token_hash; return { order_id: id };
    }
    if (op === 'p3_payment_event') {
      if (p.p_order_id !== id || p.p_session_id !== order.stripe_session_id || p.p_amount !== order.amount || p.p_currency !== 'usd') throw Error('Mismatch');
      if (events.has(p.p_event_id)) { if (events.get(p.p_event_id) !== p.p_payload_fingerprint) throw Error('Conflicting event'); return { duplicate: true }; }
      if (p.p_payment_status === 'paid') { if (order.status !== 'paid') { jobs++; order.token_hash = p.p_token_hash; } order.status = 'paid'; }
      else if (order.status !== 'paid') order.status = p.p_event_type.endsWith('expired') ? 'expired' : p.p_event_type.endsWith('failed') ? 'failed' : 'pending';
      events.set(p.p_event_id, p.p_payload_fingerprint); return { duplicate: false, outcome: order.status, order_id: id };
    }
    if (op === 'p3_order_status' || op === 'p3_submit_intake') {
      if (p.p_order_id !== id || !order.token_hash || order.token_hash !== p.p_token_hash) throw Error('Unauthorized');
      if (op === 'p3_submit_intake' && order.status !== 'paid') throw Error('Payment not confirmed');
      return op === 'p3_order_status' ? { order_id: id, status: order.status, package_id: order.package_id, intake_received: false } : { order_id: id, project_id: 'project', duplicate: false };
    }
    throw Error(`Unknown RPC ${op}`);
  } };
  const stripe = {
    async create(o) { return session = { id: 'cs_test_fixture', livemode: false, mode: 'payment', amount_total: o.amount, currency: 'usd', metadata: { order_id: o.id }, client_reference_id: o.id, payment_intent: 'pi_fixture', payment_status: 'unpaid', status: 'open', url: 'https://checkout.stripe.com/c/pay/test_fixture' }; },
    async retrieve(sid) { assert.equal(sid, session.id); return session; },
  };
  const payments = createStripePayments({ stripe, db, webhookSecret: secret, tokenSecret, env: {} });
  return { payments, stripe, db, calls, get order() { return order; }, get session() { return session; }, get jobs() { return jobs; }, fail() { fail = true; },
    checkout(extra = {}) { return payments.checkout({ packageId: 'booking-only', email: 'test@example.invalid', requestId, ...extra }); },
    event(type = 'checkout.session.completed', eid = 'evt_fixture') { const raw = JSON.stringify({ id: eid, type, livemode: false, data: { object: session } }); return payments.webhook(raw, sign(raw, secret)); },
  };
}
test('server prices; deterministic checkout retries; redirect does not authorize status', async () => {
  const f = fixture(); const first = await f.checkout({ amount: 1 });
  assert.equal(f.order.amount, 79900); assert.equal(first.token, deriveIntakeToken(id, tokenSecret));
  assert.deepEqual(await f.checkout(), first);
  assert.equal(f.order.token, undefined);
  assert.equal((await f.payments.status(id, first.token)).status, 'pending');
  await assert.rejects(f.payments.intake(id, first.token, { businessName: 'X', requirements: 'Y' }));
  await assert.rejects(f.checkout({ packageId: 'website-crm' }));
});
test('verified paid event; duplicate and distinct event queue only once; bearer intake', async () => {
  const f = fixture(); const checkout = await f.checkout(); Object.assign(f.session, { payment_status: 'paid', status: 'complete' });
  await f.event(); assert.equal((await f.event()).duplicate, true);
  await f.event('checkout.session.async_payment_succeeded', 'evt_other'); assert.equal(f.jobs, 1);
  assert.equal(f.order.token_hash, hash(checkout.token));
  assert.equal((await f.payments.status(id, checkout.token)).status, 'paid');
  await assert.rejects(f.payments.status(id, 'ff'.repeat(32)));
  await assert.rejects(f.payments.intake(id, 'ff'.repeat(32), { businessName: 'X', requirements: 'Y' }));
  assert.equal((await f.payments.intake(id, checkout.token, { businessName: 'X', requirements: 'Y' })).project_id, 'project');
});
test('invalid signature and stale signature never call database', async () => {
  const f = fixture(); await assert.rejects(f.payments.webhook('{}', sign('{}', 'wrong')));
  await assert.rejects(f.payments.webhook('{}', sign('{}', secret, 1))); assert.equal(f.calls.length, 0);
});
test('amount/currency/session metadata/live mismatch rejected', async () => {
  for (const change of [{ amount_total: 1 }, { currency: 'eur' }, { metadata: { order_id: 'other' } }, { livemode: true }, { client_reference_id: 'other' }]) {
    const f = fixture(); await f.checkout(); Object.assign(f.session, change); await assert.rejects(f.event()); assert.equal(f.jobs, 0);
  }
});
test('cancel leaves pending; failure and expiry never fulfill; DB failure can retry', async () => {
  const f = fixture(); await f.checkout(); assert.equal(f.order.status, 'pending');
  await f.event('checkout.session.async_payment_failed'); assert.equal(f.order.status, 'failed');
  f.session.status = 'expired'; await f.event('checkout.session.expired', 'evt_expired'); assert.equal(f.order.status, 'expired');
  Object.assign(f.session, { payment_status: 'paid', status: 'complete' }); f.fail(); await assert.rejects(f.event('checkout.session.completed', 'evt_paid'));
  await f.event('checkout.session.completed', 'evt_paid'); assert.equal(f.jobs, 1);
});
test('unsafe redirect and production rejected', async () => {
  const f = fixture(); const create = f.stripe.create; f.stripe.create = async (...args) => ({ ...await create(...args), url: 'https://evil.invalid' });
  await assert.rejects(f.checkout()); assert.throws(() => createStripePayments({ env: { NODE_ENV: 'production' } }));
  assert.throws(() => createStripePayments({ ...f, webhookSecret: secret, tokenSecret, origin: 'https://example.com', env: {} }));
});
test('Stripe REST uses test key, server form amount, idempotency and rejects errors', async () => {
  const calls = []; const adapter = createStripe({ secretKey: 'sk_test_fake', env: {}, fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ id: 'cs_test_fake', livemode: false }) }; } });
  await adapter.create({ id, email: 'test@example.invalid', amount: 79900, packageId: 'booking-only' }, 'http://127.0.0.1:5173');
  assert.equal(new URLSearchParams(calls[0].options.body).get('line_items[0][price_data][unit_amount]'), '79900');
  assert.equal(calls[0].options.headers['Idempotency-Key'], `checkout:${id}`);
  await adapter.retrieve('cs_test_fake'); assert.throws(() => adapter.retrieve('../other'));
  assert.throws(() => createStripe({ secretKey: 'sk_live_forbidden', env: {} }));
  const broken = createStripe({ secretKey: 'sk_test_fake', env: {}, fetchImpl: async () => ({ ok: false }) }); await assert.rejects(broken.retrieve('cs_test_fake'));
});
test('Supabase exact RPC keys, service headers, outbox arrays, DB failures', async () => {
  let observed; const db = createSupabaseDb({ url: 'http://127.0.0.1:54321', serviceKey: 'fake-service', env: {}, fetchImpl: async (url, options) => { observed = { url, options }; return { ok: true, json: async () => url.endsWith('p3_outbox_claim') ? [] : { accepted: true } }; } });
  await db.rpc('p3_payment_event', { p_event_id: 'evt_fake' });
  assert.equal(observed.options.headers.apikey, 'fake-service'); assert.equal(observed.options.headers.Authorization, 'Bearer fake-service');
  assert.equal(JSON.parse(observed.options.body).p_event_id, 'evt_fake'); assert.match(observed.url, /rpc\/p3_payment_event$/);
  assert.deepEqual(await db.rpc('p3_outbox_claim', {}), []);
  const broken = createSupabaseDb({ url: 'https://test.supabase.co', serviceKey: 'fake', env: {}, fetchImpl: async () => ({ ok: false }) }); await assert.rejects(broken.rpc('p3_order_status', {}));
});

test('unattached checkout older than 23h refuses session creation', async () => {
  const f = fixture(); await f.checkout();
  f.order.stripe_session_id = null;
  f.order.created_at = new Date(Date.now() - 24 * 3600000).toISOString();
  let called = false; f.stripe.create = async () => { called = true; throw Error('Must not create'); };
  await assert.rejects(f.checkout(), /reconciliation/); assert.equal(called, false);
});
