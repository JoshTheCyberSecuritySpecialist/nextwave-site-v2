import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createStripe, createStripePayments, createSupabaseDb, isAllowedPreviewOrigin } from '../server/stripe-payments.mjs';
import { sign } from '../server/payments.mjs';
import { createProductionApp, listenTarget, productionServer, readProductionConfig, REQUIRED_PRODUCTION_ENV } from '../server/production-server.mjs';

const secret = 'whsec_fake_test_secret';
const tokenSecret = 'dedicated-test-secret-at-least-32-bytes';
const plantedKey = 'sk_live_plantedlivekeyvalue';
const plantedWebhook = 'whsec_plantedwebhooksecret';
const plantedServiceKey = 'planted-service-role-key-value';
const root = fileURLToPath(new URL('..', import.meta.url));

function cleanEnv(extra = {}) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    PATHEXT: process.env.PATHEXT,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    ...extra,
  };
}
function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: secret,
    PAYMENT_TOKEN_SECRET: tokenSecret,
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: plantedServiceKey,
    APP_BASE_URL: 'https://nextwavedigitalsolution.com',
    STRIPE_MODE: 'test',
    ...overrides,
  };
}
async function withServer(env, payments, fn) {
  const server = productionServer({ payments, env });
  const host = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  await new Promise((resolve, reject) => {
    const onError = error => reject(error);
    server.once('error', onError);
    server.listen(0, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('start:api is the production Stripe backend and does not load env files', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['start:api'], 'node server/production-server.mjs');
  const source = readFileSync(new URL('../server/production-server.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('mock-server'), false);
  assert.equal(source.includes('dotenv'), false);
  assert.equal(/readFileSync\(/.test(source), false);
});

test('listen target uses PORT and binds all interfaces only in production', () => {
  assert.deepEqual(listenTarget({}), { port: 8788, host: '127.0.0.1' });
  assert.deepEqual(listenTarget({ PORT: '', NODE_ENV: 'development' }), { port: 8788, host: '127.0.0.1' });
  assert.deepEqual(listenTarget({ PORT: '10000', NODE_ENV: 'production' }), { port: 10000, host: '0.0.0.0' });
  assert.throws(() => listenTarget({ PORT: '0' }), /Invalid PORT/);
  assert.throws(() => listenTarget({ PORT: 'nope', NODE_ENV: 'production' }), /Invalid PORT/);
  const production = productionServer({
    payments: { origin: 'https://nextwavedigitalsolution.com', corsOrigins: ['https://nextwavedigitalsolution.com', 'https://www.nextwavedigitalsolution.com'] },
    env: { NODE_ENV: 'production' },
  });
  assert.throws(() => production.listen(0, '127.0.0.1'), /0\.0\.0\.0/);
  const local = productionServer({ payments: { origin: 'http://127.0.0.1:5173', corsOrigins: ['http://127.0.0.1:5173'] }, env: {} });
  assert.throws(() => local.listen(0, '0.0.0.0'), /Loopback binding required/);
});

test('startup fails closed without echoing credential values', () => {
  assert.throws(() => readProductionConfig({ NODE_ENV: 'production' }), error => {
    assert.match(error.message, /Missing required environment variable: STRIPE_SECRET_KEY/);
    for (const name of REQUIRED_PRODUCTION_ENV) assert.match(error.message, new RegExp(name));
    return true;
  });
  assert.throws(() => readProductionConfig(productionEnv({ STRIPE_SECRET_KEY: plantedKey, STRIPE_MODE: 'test', STRIPE_WEBHOOK_SECRET: plantedWebhook })), error => {
    assert.match(error.message, /Stripe live\/test environment mismatch/);
    assert.equal(error.message.includes(plantedKey), false);
    assert.equal(error.message.includes(plantedWebhook), false);
    assert.equal(error.message.includes(plantedServiceKey), false);
    return true;
  });
  assert.throws(() => readProductionConfig(productionEnv({ STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_MODE: 'live' })), /Stripe live\/test environment mismatch/);
  assert.throws(() => readProductionConfig(productionEnv({ STRIPE_MODE: 'production' })), /STRIPE_MODE must be test or live/);
  assert.throws(() => readProductionConfig(productionEnv({ APP_BASE_URL: 'https://user:SUPERSECRET@nextwavedigitalsolution.com' })), error => {
    assert.match(error.message, /APP_BASE_URL is not allowed/);
    assert.equal(error.message.includes('SUPERSECRET'), false);
    return true;
  });
  assert.throws(() => readProductionConfig(productionEnv({ APP_BASE_URL: 'http://127.0.0.1:5173' })), /APP_BASE_URL is not allowed/);
  assert.throws(() => readProductionConfig(productionEnv({ SUPABASE_URL: 'http://127.0.0.1:54321' })), /Invalid Supabase URL/);
  assert.throws(() => readProductionConfig(productionEnv({ VITE_STRIPE_SECRET_KEY: plantedKey })), error => {
    assert.match(error.message, /browser environment variables/);
    assert.equal(error.message.includes(plantedKey), false);
    return true;
  });
  assert.throws(() => readProductionConfig(productionEnv({ VITE_GEMINI_API_KEY: 'gemini-key-not-for-browser' })), error => {
    assert.match(error.message, /browser environment variables/);
    assert.equal(error.message.includes('gemini-key-not-for-browser'), false);
    return true;
  });
  const local = readProductionConfig({ ...productionEnv({ NODE_ENV: 'development', APP_BASE_URL: 'http://127.0.0.1:5173', SUPABASE_URL: 'http://127.0.0.1:54321' }) });
  assert.equal(local.origin, 'http://127.0.0.1:5173');
  assert.equal(local.livemode, false);
  assert.throws(() => createSupabaseDb({ url: 'http://127.0.0.1:54321', serviceKey: 'fake-service', env: { NODE_ENV: 'production' }, production: true }), /Invalid Supabase URL/);
  const app = createProductionApp(productionEnv());
  assert.equal(typeof app.listen, 'function');
});

test('configured Stripe mode rejects the opposite key, session, and event', async () => {
  assert.throws(() => createStripe({ secretKey: plantedKey, env: { NODE_ENV: 'production' }, production: true, livemode: false }), error => {
    assert.match(error.message, /Stripe live\/test environment mismatch/);
    assert.equal(error.message.includes(plantedKey), false);
    return true;
  });
  let called = false;
  const liveAdapter = createStripe({
    secretKey: 'sk_live_fixture', env: { NODE_ENV: 'production' }, production: true, livemode: true,
    fetchImpl: async () => { called = true; return { ok: true, json: async () => ({ id: 'cs_test_fake', livemode: false }) }; },
  });
  assert.throws(() => liveAdapter.retrieve('cs_test_fake'), /Invalid session/);
  assert.equal(called, false);
  await assert.rejects(liveAdapter.retrieve('cs_live_fake'), /Stripe live\/test environment mismatch/);
  const payments = createStripePayments({
    stripe: { async retrieve() { throw Error('Stripe retrieve must not run'); } },
    db: { async rpc() { throw Error('Database must not run'); } },
    webhookSecret: secret, tokenSecret, origin: 'https://nextwavedigitalsolution.com',
    env: { NODE_ENV: 'production' }, production: true, livemode: false,
  });
  const raw = JSON.stringify({ id: 'evt_live_event', type: 'checkout.session.completed', livemode: true, data: { object: { id: 'cs_live_x' } } });
  await assert.rejects(payments.webhook(raw, sign(raw, secret)), /Stripe live\/test environment mismatch/);
  await assert.rejects(payments.webhook(Buffer.from(raw), sign(raw, secret)), /Stripe live\/test environment mismatch/);
});

test('health, CORS, mock route, and raw webhook body', async () => {
  const website = 'https://nextwavedigitalsolution.com';
  const www = 'https://www.nextwavedigitalsolution.com';
  let checkouts = 0;
  await withServer({ NODE_ENV: 'production' }, {
    origin: website,
    corsOrigins: [website, www],
    async checkout() { checkouts += 1; return { id: 'order-1', mode: 'stripe-test' }; },
    async webhook() { throw Error('stub'); },
  }, async base => {
    let response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '{"ok":true}');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    response = await fetch(`${base}/health?debug=1`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/health`, { headers: { Origin: www } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), www);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
    response = await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers: { Origin: website, 'Access-Control-Request-Headers': 'authorization,content-type' } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), website);
    assert.match(response.headers.get('access-control-allow-headers'), /Authorization, Content-Type/);
    assert.equal(response.headers.get('access-control-allow-origin') === '*', false);
    response = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { Origin: 'https://nextwavedigitalsolution.com.evil.example' }, body: '{}' });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/api/mock/complete`, { method: 'POST', headers: { Origin: website }, body: '{}' });
    assert.equal(response.status, 404);
    assert.equal(checkouts, 0);
    response = await fetch(`${base}/api/checkout`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 403);
    assert.equal(isAllowedPreviewOrigin('https://nextwave-site-v2-czwn5yacr.vercel.app'), true);
    assert.equal(isAllowedPreviewOrigin('https://nextwave-site-v2.vercel.app'), true);
    assert.equal(isAllowedPreviewOrigin('https://evil.vercel.app'), false);
    assert.equal(isAllowedPreviewOrigin('https://nextwave-site-v2-czwn5yacr.vercel.app.evil.example'), false);
    assert.equal(isAllowedPreviewOrigin('http://nextwave-site-v2.vercel.app'), false);
    const preview = 'https://nextwave-site-v2-czwn5yacr.vercel.app';
    response = await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers: { Origin: preview, 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), preview);
    response = await fetch(`${base}/api/checkout`, { method: 'OPTIONS', headers: { Origin: 'https://evil.vercel.app', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  let databaseCalls = 0;
  const session = {
    id: 'cs_test_raw', livemode: false, mode: 'payment', amount_total: 79900, currency: 'usd',
    metadata: { order_id: 'order-1' }, client_reference_id: 'order-1', payment_intent: 'pi_raw', payment_status: 'paid', status: 'complete',
  };
  const payments = createStripePayments({
    stripe: { async retrieve(id) { assert.equal(id, session.id); return session; } },
    db: { async rpc() { databaseCalls += 1; return { duplicate: false, outcome: 'paid', order_id: 'order-1' }; } },
    webhookSecret: secret, tokenSecret, origin: website, env: { NODE_ENV: 'production' }, production: true, livemode: false,
  });
  const raw = '{"id": "evt_raw", "type": "checkout.session.completed", "livemode": false, "data": {"object": {"id": "cs_test_raw", "amount_total": 79900, "currency": "usd", "metadata": {"order_id": "order-1"}}}}';
  const signature = sign(raw, secret);
  await withServer({ NODE_ENV: 'production' }, payments, async base => {
    let response = await fetch(`${base}/api/webhook`, { method: 'POST', headers: { 'Stripe-Signature': signature }, body: raw });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(databaseCalls, 1);
    response = await fetch(`${base}/api/webhook`, { method: 'POST', headers: { 'Stripe-Signature': signature }, body: JSON.stringify(JSON.parse(raw)) });
    assert.equal(response.status, 503);
    assert.equal(databaseCalls, 1);
    const text = await response.text();
    assert.equal(text.includes(secret), false);
    assert.equal(text.includes(tokenSecret), false);
  });
  await withServer({}, {
    origin: 'http://127.0.0.1:5173',
    corsOrigins: ['http://127.0.0.1:5173'],
    async checkout() { return { id: 'order-1', mode: 'stripe-test' }; },
  }, async base => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const foreign = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { Origin: 'http://localhost:5173' }, body: '{}' });
    assert.equal(foreign.status, 403);
    const local = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: '{"packageId":"booking-only"}' });
    assert.equal(local.status, 200);
  });
});

test('production process exits before listen when credentials are missing or mismatched', () => {
  const missing = spawnSync(process.execPath, ['server/production-server.mjs'], {
    cwd: root, env: cleanEnv({ NODE_ENV: 'production', STRIPE_WEBHOOK_SECRET: plantedWebhook }), encoding: 'utf8',
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing required environment variable/);
  assert.equal(missing.stderr.includes(plantedWebhook), false);
  assert.equal(missing.stdout.includes(plantedWebhook), false);
  const mismatch = spawnSync(process.execPath, ['server/production-server.mjs'], {
    cwd: root,
    env: cleanEnv(productionEnv({ STRIPE_SECRET_KEY: plantedKey, STRIPE_WEBHOOK_SECRET: plantedWebhook })),
    encoding: 'utf8',
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Stripe live\/test environment mismatch/);
  for (const secretValue of [plantedKey, plantedWebhook, plantedServiceKey]) {
    assert.equal(mismatch.stderr.includes(secretValue), false);
    assert.equal(mismatch.stdout.includes(secretValue), false);
  }
  const testBackend = spawnSync(process.execPath, ['server/stripe-server.mjs'], {
    cwd: root, env: cleanEnv({ NODE_ENV: 'production' }), encoding: 'utf8',
  });
  assert.notEqual(testBackend.status, 0);
  assert.match(testBackend.stderr, /Test backend forbidden in production/);
});
