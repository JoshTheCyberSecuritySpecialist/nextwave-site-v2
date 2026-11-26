#!/usr/bin/env node
/**
 * Milestone 6 operator helper.
 * Lists local website migrations and optionally queries the linked remote list.
 * Never applies migrations.
 */
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = [
  '20261126120000_milestone1_foundation.sql',
  '20261126160000_website_generation.sql',
  '20261126180000_website_publishing.sql',
  '20261126190000_website_connected_tools.sql',
];

const dir = path.join(root, 'supabase', 'migrations');
const names = (await readdir(dir)).filter(name => name.endsWith('.sql')).sort();

console.log('Local migrations:', names.length);
for (const name of REQUIRED) {
  const present = names.includes(name);
  let pending = false;
  if (present) {
    const sql = await readFile(path.join(dir, name), 'utf8');
    pending = /Pending review|Do not apply|pending review/i.test(sql);
  }
  console.log(`  ${present ? 'OK' : 'MISSING'} ${name}${pending ? ' (header still pending review)' : ''}`);
}

const dryRun = process.argv.includes('--dry-run');
const linked = process.argv.includes('--linked') || dryRun;

if (!linked) {
  console.log('\nRemote status skipped. Re-run with --linked or --dry-run after Supabase login.');
  process.exit(0);
}

const args = dryRun
  ? ['supabase', 'db', 'push', '--dry-run', '--linked']
  : ['supabase', 'migration', 'list', '--linked'];

console.log(`\nRunning: npx ${args.join(' ')}`);
const result = spawnSync('npx', args, {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  console.error('\nRemote Supabase command failed. Fix auth/link locally; this script never applies migrations.');
  process.exit(result.status ?? 1);
}

console.log(dryRun
  ? '\nDry-run finished. Review the plan, then apply manually with: npx supabase db push --linked'
  : '\nRemote migration list finished. Compare Local vs Remote before applying.');
