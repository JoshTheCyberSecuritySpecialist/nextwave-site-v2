import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('mock backend refuses production startup', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import { mockServer } from './server/mock-server.mjs'; mockServer();"], { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Mock payments are forbidden/);
});

// Run after npm run build: prove the emitted browser assets contain no mock endpoint.
test('production browser bundle contains no mock completion route', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  assert.ok(assets.some(name => name.endsWith('.js')));
  for (const name of assets.filter(name => name.endsWith('.js'))) {
    const source = await readFile(new URL(`../dist/assets/${name}`, import.meta.url), 'utf8');
    assert.ok(!source.includes('/api/mock/complete'));
    assert.ok(!source.includes('Simulate signed paid webhook'));
  }
});
