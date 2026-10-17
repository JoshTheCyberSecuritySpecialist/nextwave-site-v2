import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Static contract checks only, NOT SQL execution or database integration evidence.
const sql = readFileSync(new URL('../supabase/migrations/202610170002_real_payments.sql', import.meta.url), 'utf8');
test('migration contains backend-only grants, atomic event locks and disabled recurring architecture (static)', () => {
  for (const pattern of [/pg_advisory_xact_lock/, /for update skip locked/i, /p3_payment_event/, /p3_submit_intake/, /p3_outbox_finish/, /token_expires_at>now\(\)/, /status='disabled'/, /stripe_subscription_id is null/, /from public,anon,authenticated/, /to service_role/]) assert.match(sql, pattern);
  assert.ok(!/returns[^;]*security\s+definer/i.test(sql));
});
