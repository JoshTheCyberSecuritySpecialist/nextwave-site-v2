import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformAdmin, PLATFORM_ADMIN_EMAIL } from '../src/lib/platform-admin.mjs';

test('only the platform admin email is treated as the platform administrator', () => {
  assert.equal(isPlatformAdmin(PLATFORM_ADMIN_EMAIL), true);
  assert.equal(isPlatformAdmin('Joshua@NextWaveDigitalSolution.com'), true);
  assert.equal(isPlatformAdmin(' owner@example.test '), false);
  assert.equal(isPlatformAdmin(''), false);
  assert.equal(isPlatformAdmin(null), false);
});
