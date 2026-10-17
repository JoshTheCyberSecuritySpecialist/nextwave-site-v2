import test from 'node:test';
import assert from 'node:assert/strict';
import { testDelivery } from '../server/test-delivery.mjs';
test('external delivery disabled by default', async () => {
  let calls = 0;
  const deliver = testDelivery({ testEmail: 'sandbox@example.com', fetchImpl: async () => { calls++; } });
  await assert.rejects(deliver({ id: 'job', orderId: 'order', kind: 'payment_confirmation' }), /disabled/);
  assert.equal(calls, 0);
});
test('email and CRM use isolated destinations, idempotency, and propagate failures', async () => {
  const calls = [];
  const deliver = testDelivery({ enabled: true, testEmail: 'sandbox@example.com', fromEmail: 'test@example.com', resendKey: 'fake', hubspotToken: 'fake', fetchImpl: async (url, init) => { calls.push({ url, ...init }); return { ok: true, json: async () => ({ id: 'external' }) }; } });
  await deliver({ id: 'job', orderId: 'order', email: 'customer@example.com', kind: 'payment_confirmation' });
  await deliver({ id: 'job2', orderId: 'order', email: 'customer@example.com', kind: 'hubspot_sync' });
  assert.equal(calls[0].headers['Idempotency-Key'], 'job');
  assert.ok(calls.every(c => c.body.includes('sandbox@example.com') && !c.body.includes('customer@example.com')));
  const failing = testDelivery({ enabled: true, testEmail: 'sandbox@example.com', resendKey: 'fake', fromEmail: 'test@example.com', fetchImpl: async () => ({ ok: false, status: 429 }) });
  await assert.rejects(failing({ id: 'job', orderId: 'order', kind: 'payment_confirmation' }), /429/);
});
