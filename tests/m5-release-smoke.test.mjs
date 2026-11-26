import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createProductionApp, REQUIRED_PRODUCTION_ENV } from '../server/production-server.mjs';

const productionEnv = (overrides = {}) => ({
  NODE_ENV: 'production',
  STRIPE_SECRET_KEY: 'sk_test_fixture',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake_test_secret',
  PAYMENT_TOKEN_SECRET: 'dedicated-test-secret-at-least-32-bytes',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-not-for-browser-use',
  APP_BASE_URL: 'https://nextwavedigitalsolution.com',
  STRIPE_MODE: 'test',
  ...overrides,
});

test('release routes and public surfaces are registered in App.tsx', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const route of [
    'path="/"',
    'path="/checkout',
    'path="/crm/login"',
    'path="/book/:slug"',
    'path="/site/:slug"',
    'path="website"',
    'path="website/edit"',
    'path="website/preview"',
    'path="inquiries"',
    'path="customers"',
  ]) {
    assert.match(source, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('env example documents test Stripe mode, Render API start, and optional Resend', async () => {
  const env = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(env, /STRIPE_MODE=test/);
  assert.match(env, /RESEND_API_KEY=/);
  assert.match(env, /RESEND_FROM=/);
  assert.match(env, /start:api/);
  for (const name of REQUIRED_PRODUCTION_ENV) {
    assert.match(env, new RegExp(name));
  }
});

test('createProductionApp refuses matched live Stripe mode', () => {
  assert.throws(
    () => createProductionApp(productionEnv({
      STRIPE_SECRET_KEY: 'sk_live_fixture',
      STRIPE_MODE: 'live',
    })),
    /Live Stripe checkout is disabled/,
  );
  const app = createProductionApp(productionEnv());
  assert.equal(typeof app.listen, 'function');
});

test('M1–M4 website migrations exist and remain marked pending review', async () => {
  const dir = new URL('../supabase/migrations/', import.meta.url);
  const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();
  const required = [
    '20261126120000_milestone1_foundation.sql',
    '20261126160000_website_generation.sql',
    '20261126180000_website_publishing.sql',
    '20261126190000_website_connected_tools.sql',
  ];
  for (const name of required) {
    assert.ok(names.includes(name), name);
    const sql = await readFile(new URL(name, dir), 'utf8');
    assert.match(sql, /Pending review|Do not apply|pending review/i);
  }
});

test('release verification docs are present', async () => {
  for (const path of [
    '../docs/milestone-5-report.md',
    '../docs/migration-apply-checklist.md',
    '../docs/payment-test-mode-checklist.md',
    '../docs/commercial-decisions.md',
  ]) {
    const text = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.ok(text.length > 100, path);
  }
});
