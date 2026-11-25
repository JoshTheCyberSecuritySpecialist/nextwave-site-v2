import test from 'node:test';
import assert from 'node:assert/strict';
import { runBookingMessageBatch } from '../server/booking-messages.mjs';

test('booking message batch escapes html and records a fixed delivery error', async () => {
  const job = {
    id: '11111111-1111-4111-8111-111111111111',
    lease_id: '22222222-2222-4222-8222-222222222222',
    lease_until: new Date(Date.now() + 60_000).toISOString(),
    recipient_email: 'ada@example.test',
    subject: 'Appointment confirmed — Harbor Studio',
    body: 'Hello <Ada> & friend\nSee you',
    kind: 'confirmation',
  };
  const delivered = [];
  const results = await runBookingMessageBatch({
    rpc: async (name, args) => {
      if (name === 'booking_messages_claim') return [job];
      assert.equal(args.p_success, true);
      assert.equal(args.p_error, undefined);
      return { status: 'sent' };
    },
    deliver: async message => { delivered.push(message); },
  });
  assert.equal(results[0].status, 'sent');
  assert.equal(delivered[0].to, 'ada@example.test');
  assert.equal(delivered[0].text, job.body);
  assert.equal(delivered[0].html.includes('<Ada>'), false);
  assert.match(delivered[0].html, /Hello &lt;Ada&gt; &amp; friend<br>See you/);
  assert.equal(delivered[0].idempotencyKey, job.id);

  const failures = [];
  const failed = await runBookingMessageBatch({
    rpc: async (name, args) => {
      if (name === 'booking_messages_claim') return [job];
      failures.push(args);
      return { status: 'pending' };
    },
    deliver: async () => { throw Error('provider body must not be stored'); },
  });
  assert.equal(failed[0].status, 'retry_queued');
  assert.equal(failures[0].p_success, false);
  assert.equal(failures[0].p_error, 'Booking message delivery failed.');
  assert.equal(JSON.stringify(failures).includes('<Ada>'), false);
});
