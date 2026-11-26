import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('M6 launch artifacts exist', async () => {
  for (const relative of [
    'docs/staging-launch-runbook.md',
    'docs/migration-apply-checklist.md',
    'docs/payment-test-mode-checklist.md',
    'docs/commercial-decisions.md',
    'docs/milestone-6-report.md',
    'scripts/migration-status.mjs',
    'playwright.config.ts',
    'e2e/public-smoke.spec.ts',
  ]) {
    await access(path.join(root, relative));
  }
});

test('package scripts include migrate status and e2e smoke', async () => {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['migrate:status'], 'node scripts/migration-status.mjs');
  assert.equal(pkg.scripts['test:e2e'], 'playwright test');
  assert.match(pkg.scripts['test:m6'], /tests\/m6-\*\.test\.mjs/);
  assert.ok(pkg.devDependencies['@playwright/test']);
});

test('migration-status reports required local website migrations without applying', () => {
  const result = spawnSync(process.execPath, ['scripts/migration-status.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /20261126120000_milestone1_foundation\.sql/);
  assert.match(result.stdout, /20261126190000_website_connected_tools\.sql/);
  assert.match(result.stdout, /Remote status skipped/);
  assert.doesNotMatch(result.stdout, /\bdb push\b(?!.*dry-run)/i);
});

test('staging runbook gates live Stripe behind hosted verification', async () => {
  const runbook = await readFile(path.join(root, 'docs/staging-launch-runbook.md'), 'utf8');
  assert.match(runbook, /db push --dry-run/);
  assert.match(runbook, /business-website/);
  assert.match(runbook, /website-crm/);
  assert.match(runbook, /Live Stripe enabled/);
  assert.match(runbook, /commercial-decisions/);
});
