import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeServer } from '../server/stripe-server.mjs';

test('loopback HTTP origin, no-store, body cap, bearer boundary, no mock endpoint', async t => {
  const payments = {
    origin: 'http://127.0.0.1:5173',
    async checkout(input) { return { tokenSeen: input.token, amount: 79900 }; },
    async webhook() { return { accepted: true }; },
    async status(id, token) { if (!token) throw Error('Unauthorized'); return { id, status: 'pending' }; },
  };
  const server = stripeServer({ payments, env: {} });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => fetch(base + path, options);
  const origin = { Origin: payments.origin, 'Content-Type': 'application/json' };
  let response = await request('/api/mock/complete', { method: 'POST', headers: origin, body: '{}' });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  response = await request('/api/checkout', { method: 'POST', headers: { Origin: 'https://evil.invalid' }, body: '{}' });
  assert.equal(response.status, 403);
  response = await request('/api/checkout', { method: 'POST', body: '{}' });
  assert.equal(response.status, 403);
  response = await request('/api/checkout', { method: 'POST', headers: origin, body: 'x'.repeat(65537) });
  assert.equal(response.status, 413);
  response = await request('/api/orders/order-1');
  assert.equal(response.status, 400);
  response = await request('/api/checkout', { method: 'POST', headers: { ...origin, Authorization: `Bearer ${'ab'.repeat(32)}` }, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).tokenSeen, 'ab'.repeat(32));
  response = await request('/api/webhook', { method: 'POST', body: '{}' });
  assert.equal(response.status, 200);
});
