import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import handler from '../api/[...path].js';
import { RENDER_API_ORIGIN, apiUrl, checkoutAvailability, resolveApiBase } from '../src/lib/payments-client.mjs';

test('checkout stays disabled in production unless test mode is explicit', () => {
  assert.equal(checkoutAvailability({ dev: false }), 'disabled');
  assert.equal(checkoutAvailability({ dev: false, configured: '' }), 'disabled');
  assert.equal(checkoutAvailability({ dev: false, configured: 'test' }), 'test');
  assert.equal(checkoutAvailability({ dev: false, configured: 'live' }), 'live-blocked');
  assert.equal(checkoutAvailability({ dev: true, configured: 'live' }), 'live-blocked');
  assert.equal(checkoutAvailability({ dev: true, configured: 'disabled' }), 'disabled');
  assert.equal(checkoutAvailability({ dev: true }), 'test');
  assert.equal(checkoutAvailability({ dev: true, configured: 'test' }), 'test');
});

test('production browser calls the Render API and local dev stays on loopback', () => {
  assert.equal(resolveApiBase({ dev: false, configured: 'https://evil.example' }), RENDER_API_ORIGIN);
  assert.equal(apiUrl('/api/checkout', { dev: false }), `${RENDER_API_ORIGIN}/api/checkout`);
  assert.equal(apiUrl('/api/orders/order-1', { dev: true }), '/api/orders/order-1');
  assert.equal(resolveApiBase({ dev: true, configured: 'http://127.0.0.1:8788' }), 'http://127.0.0.1:8788');
  assert.equal(resolveApiBase({ dev: true, configured: RENDER_API_ORIGIN }), '');
  assert.throws(() => apiUrl('https://evil.example/api/checkout', { dev: false }), /Invalid API path/);
});

test('Vercel does not proxy API requests or the Stripe webhook', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/' }]);
  const source = await readFile(new URL('../api/[...path].js', import.meta.url), 'utf8');
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes(RENDER_API_ORIGIN), true);
  const responses = [];
  for (const url of ['/api/checkout', '/api/webhook']) {
    const res = {
      statusCode: 0,
      body: undefined,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; },
    };
    handler({ url, resume() { this.resumed = true; } }, res);
    responses.push(res);
  }
  assert.equal(responses[0].statusCode, 404);
  assert.match(responses[0].body.error, /nextwave-site-v2\.onrender\.com/);
  assert.doesNotMatch(responses[0].body.error, /webhook/);
  assert.equal(responses[1].statusCode, 404);
  assert.match(responses[1].body.error, /https:\/\/nextwave-site-v2\.onrender\.com\/api\/webhook/);
});

test('checkout page follows only Stripe test sessions', async () => {
  const source = await readFile(new URL('../src/pages/Checkout.tsx', import.meta.url), 'utf8');
  assert.equal(source.includes('const enabled = import.meta.env.DEV'), false);
  assert.match(source, /result\.mode !== 'stripe-test'/);
  assert.match(source, /checkout\.stripe\.com/);
  assert.match(source, /live-blocked/);
});
