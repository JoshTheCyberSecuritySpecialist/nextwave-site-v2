import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminOrders } from '../server/admin-orders.mjs';
import { productionServer } from '../server/production-server.mjs';

const serviceKey = 'service-role-key-not-for-browser-use';
const adminJwt = 'header.payload.signature';
const orderId = '11111111-1111-4111-8111-111111111111';

function json(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('admin orders require the admin user and omit payment secrets', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const href = String(url);
    calls.push(href);
    assert.equal(options.headers.apikey, serviceKey);
    assert.equal(JSON.stringify(options).includes('token_hash'), false);
    if (href.endsWith('/auth/v1/user')) {
      const email = options.headers.Authorization.endsWith(adminJwt) ? 'Joshua@nextwavedigitalsolution.com' : 'other@example.com';
      return json({ email });
    }
    if (href.includes('/service_orders')) return json([{ id: orderId, email: 'buyer@example.com', package_id: 'booking-only', amount: 79900, currency: 'usd', status: 'paid', created_at: '2026-10-29T00:00:00Z', token_hash: 'secret' }]);
    if (href.includes('/customer_intakes')) return json([{ order_id: orderId, business_name: 'Harbor Studio', requirements: 'Weekday hours', submitted_at: '2026-10-29T01:00:00Z' }]);
    if (href.includes('/fulfillment_projects')) return json([{ id: '22222222-2222-4222-8222-222222222222', order_id: orderId, status: 'ready_for_review', contact_id: '33333333-3333-4333-8333-333333333333' }]);
    if (href.includes('/fulfillment_contacts')) return json([{ id: '33333333-3333-4333-8333-333333333333', external_crm_id: 'crm-9' }]);
    return json([], 500);
  };
  const admin = createAdminOrders({ url: 'https://example.supabase.co', serviceKey, fetchImpl });
  await assert.rejects(admin.list('not-a-jwt'), /Unauthorized/);
  await assert.rejects(admin.list('aa.bb.cc'), /Unauthorized/);
  const list = await admin.list(adminJwt);
  assert.equal(list.orders[0].requirements, undefined);
  assert.equal(list.orders[0].businessName, 'Harbor Studio');
  assert.equal(list.orders[0].customerReference, 'crm-9');
  assert.equal(JSON.stringify(list).includes('token_hash'), false);
  assert.equal(JSON.stringify(list).includes(serviceKey), false);
  const detail = await admin.order(adminJwt, orderId);
  assert.equal(detail.order.requirements, 'Weekday hours');
  await assert.rejects(admin.order(adminJwt, '00000000-0000-4000-8000-000000000000'), /Not found/);
  assert.equal(calls.some(href => href.includes('select=id%2Cemail')), true);
});

test('admin route rejects anonymous callers and does not replace checkout', async () => {
  const server = productionServer({
    payments: {
      origin: 'http://127.0.0.1:5173',
      corsOrigins: ['http://127.0.0.1:5173'],
      async checkout() { return { id: 'order-1', mode: 'stripe-test' }; },
    },
    admin: {
      async list() { return { orders: [] }; },
      async order() { throw Error('Unauthorized'); },
    },
    env: {},
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', error => error ? reject(error) : resolve()));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const origin = { Origin: 'http://127.0.0.1:5173' };
    let response = await fetch(`${base}/api/admin/orders`);
    assert.equal(response.status, 403);
    response = await fetch(`${base}/api/admin/orders`, { headers: origin });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/api/admin/orders`, { headers: { ...origin, Authorization: 'Bearer header.payload.signature' } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { orders: [] });
    response = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { ...origin, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 200);
    const source = await readFile(new URL('../src/pages/Dashboard.tsx', import.meta.url), 'utf8');
    assert.match(source, /\/api\/admin\/orders/);
    assert.equal(source.includes('service_role'), false);
    assert.equal(source.includes('supabase.from'), false);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); });
  }
});
