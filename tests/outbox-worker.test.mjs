import test from 'node:test';
import assert from 'node:assert/strict';
import { runOutboxBatch } from '../server/outbox-worker.mjs';
const job = { id: 'j', order_id: 'o', kind: 'payment_confirmation', lease_id: 'lease', lease_until: '2099-01-01T00:00:00Z' };
test('leased outbox success and isolated invitation handoff', async () => {
  const calls = [];
  await runOutboxBatch({ rpc: async (name, args) => { calls.push([name, args]); return name === 'p3_outbox_claim' ? [job] : {}; }, invitationUrl: () => 'http://localhost:5173/checkout#token', deliver: async input => { assert.match(input.intakeUrl, /#token/); return { externalId: null }; } });
  assert.equal(calls[1][1].p_success, true);
  assert.equal(calls[1][1].p_lease_id, 'lease');
});
test('delivery failure records sanitized retry and lease expiry prevents send', async () => {
  const finishes = [];
  await runOutboxBatch({ rpc: async (name, args) => name === 'p3_outbox_claim' ? [job] : finishes.push(args), invitationUrl: () => 'local', deliver: async () => { throw Error('SECRET must not persist'); } });
  assert.equal(finishes[0].p_success, false);
  assert.ok(!finishes[0].p_error.includes('SECRET'));
  await runOutboxBatch({ rpc: async () => [{ ...job, lease_until: '2000-01-01T00:00:00Z' }], deliver: async () => assert.fail('Expired lease sent'), invitationUrl: () => '' });
});
test('database finish failure propagates without marking accepted send as provider failure', async () => {
  let finishes = 0;
  await assert.rejects(runOutboxBatch({ rpc: async name => { if (name === 'p3_outbox_claim') return [job]; finishes++; throw Error('database unavailable'); }, deliver: async () => ({ externalId: 'x' }), invitationUrl: () => 'local' }), /database unavailable/);
  assert.equal(finishes, 1);
});
