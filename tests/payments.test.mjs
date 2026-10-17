import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPayments, sign } from '../server/payments.mjs';
import { mockServer } from '../server/mock-server.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nw-payment-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'db.json'); const secret = 'local-fixture-only';
  const api = createPayments({ file, secret });
  const order = api.checkout({ packageId: 'booking-only', email: 'buyer@example.test', requestId: 'fixture-request-0001' });
  function event(overrides = {}, id = 'evt_1') { return JSON.stringify({ id, livemode: false, type: 'checkout.session.completed', data: { object: { id: order.sessionId, payment_status: 'paid', amount_total: 79900, currency: 'usd', metadata: { order_id: order.id }, ...overrides } } }); }
  return { api, order, file, secret, event };
}
test('payment -> intake -> local CRM/project and durable idempotent jobs', t => {
  const { api, order, file, secret, event } = fixture(t);
  assert.throws(() => api.intake(order.id, order.token, { businessName: 'Test', requirements: 'Booking' }));
  const raw = event(); api.webhook(raw, sign(raw, secret));
  assert.equal(api.webhook(raw, sign(raw, secret)).duplicate, true);
  const second = event({}, 'evt_2'); api.webhook(second, sign(second, secret));
  api.intake(order.id, order.token, { businessName: 'Test', requirements: 'Booking' });
  api.intake(order.id, order.token, { businessName: 'Test', requirements: 'Booking' });
  const db = JSON.parse(readFileSync(file));
  assert.equal(db.jobs.length, 2); assert.equal(db.projects.length, 1); assert.equal(db.contacts.length, 1);
  assert.equal(createPayments({ file, secret }).status(order.id, order.token).status, 'intake_received');
});
test('reject forged/stale signatures, mismatched amounts, unpaid and unauthorized intake', t => {
  const { api, order, secret, event } = fixture(t); const raw = event();
  assert.throws(() => api.webhook(raw, sign(raw, 'wrong')));
  assert.throws(() => api.webhook(raw, sign(raw, secret, 1)));
  for (const overrides of [{ amount_total: 1 }, { currency: 'eur' }, { metadata: {} }]) {
    const bad = event(overrides); assert.throws(() => api.webhook(bad, sign(bad, secret)));
  }
  const unpaid = event({ payment_status: 'unpaid' }); api.webhook(unpaid, sign(unpaid, secret));
  assert.equal(api.status(order.id, order.token).status, 'pending');
  assert.throws(() => api.status(order.id, 'wrong'));
});
test('server price ownership, package allowlist and checkout retry', t => {
  const { api, order } = fixture(t);
  assert.equal(api.checkout({ packageId: 'booking-only', email: 'buyer@example.test', requestId: 'fixture-request-0001', amount: 1 }).id, order.id);
  assert.throws(() => api.checkout({ packageId: 'hosting', email: 'buyer@example.test', requestId: 'fixture-request-0002' }));
  assert.equal(api.checkout({ packageId: 'website-crm', email: 'buyer@example.test', requestId: 'fixture-request-0002' }).amount, 149900);
  assert.throws(() => api.checkout({ packageId: 'website-crm', email: 'buyer@example.test', requestId: 'fixture-request-0001' }));
});
test('HTTP journey and failure responses', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'nw-http-')); const server = mockServer({ file: join(dir, 'db.json') });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, token) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) });
  const response = await post('/api/checkout', { packageId: 'website-crm', email: 'buyer@example.test', requestId: 'http-fixture-00001' });
  assert.equal(response.status, 200); const order = await response.json();
  assert.equal((await post(`/api/orders/${order.id}/intake`, { businessName: 'Test', requirements: 'Build' }, order.token)).status, 400);
  assert.equal((await post('/api/mock/complete', order, order.token)).status, 200);
  assert.equal((await post(`/api/orders/${order.id}/intake`, { businessName: 'Test', requirements: 'Build' }, order.token)).status, 200);
  const status = await fetch(`${base}/api/orders/${order.id}`, { headers: { Authorization: `Bearer ${order.token}` } });
  assert.equal((await status.json()).status, 'intake_received');
  assert.equal((await fetch(`${base}/api/orders/${order.id}`)).status, 400);
});
