# Phase 3 release evidence — 2026-10-17

## Verdict
NO-GO for production or paid/Groupon launch. Local implementation exists and 29 automated tests pass, but no actual Stripe test-mode event, SQL migration execution, Resend delivery, or HubSpot delivery has been verified. Phase 3 is not fully complete. No push, merge, deployment, remote migration, external transaction, customer contact or recurring billing performed.

## Repository / preservation
Project C:\Users\krypt\Myprojects\nextwave-site-v2. Remote git@github.com:JoshTheCyberSecuritySpecialist/nextwave-site-v2.git. Branch development/launch-readiness. Phase 2 preserved in local commit ea2a073 (parent f41d06d). Phase 3 files remain uncommitted for review.

## Exact Phase 3 file inventory
Modified: server/mock-server.mjs; src/App.tsx; src/pages/Checkout.tsx; vite.config.ts.
Added: server/stripe-payments.mjs; server/stripe-server.mjs; server/outbox-worker.mjs; server/test-delivery.mjs; supabase/migrations/202610170002_real_payments.sql; docs/phase3-db-contract.md; docs/phase-3-release-report.md; tests/outbox-worker.test.mjs; tests/phase3-schema.test.mjs; tests/production-isolation.test.mjs; tests/stripe-payments.test.mjs; tests/stripe-server.test.mjs; tests/test-delivery.test.mjs.

## Implemented, not externally verified
- Stripe test-key-only REST session creation/retrieval, payment mode only. Prices server-owned: booking-only 79900 and website-crm 149900 USD cents. No raw card collection.
- Fixed local success/cancel redirects, Stripe-hosted checkout URL allowlist. Success URL never changes order payment state.
- Raw-body signed webhook with tolerance verification, fetched session cross-check, SQL order/session/amount/currency verification. Duplicate events and distinct paid events handled transactionally in SQL; JavaScript tests use fake DB/Stripe adapters.
- Stable checkout request UUID and Stripe idempotency key. Unattached orders older than 23h fail closed to avoid fresh sessions beyond Stripe idempotency retention. Reconciliation still needs an operator.
- Supabase RPC adapter uses server-only service key; no JSON persistence in real adapter. Mock remains isolated separate code.
- New SQL migration adds hashed bearer invitations, seven-day expiry, failed/expired states, payment event fingerprint, outbox leases/retries/receipts, project status history and disabled-only subscription architecture. Prerequisite migration 202610170001_payment_fulfillment.sql is also unapplied.
- Checkout attachment installs bearer hash before payment, allowing authorized pending/failed/expired status. Intake independently requires paid state. Server HMAC invitation secret reconstructs token for delivery without storing raw token. Never rotate the secret without an invitation migration plan.
- Intake transaction creates customer contact, intake, one fulfillment project, initial history and unique email/CRM jobs. Paid transition queues confirmation. Foreign keys, unique constraints, RLS and service-only RPC grants are defined, not proven by executing SQL.
- Test delivery adapters use only configured sandbox recipient, never order email; disabled by default. Outbox batch processes leases and writes sanitized failures/receipts with retry state. Provider delivery is at-least-once, not an exactly-once claim. HubSpot sandbox adapter upserts the isolated email; per-order project properties and full production CRM mapping remain incomplete.
- Optional hosting fixed at 14900 cents architecture, status constrained disabled, no Stripe subscription ID allowed. No subscription API calls.

## Verification executed by lead
`npm run typecheck && npm run lint && npm run build && node --test tests/*.test.mjs && git diff --check` returned exit 0 after final edits. 29 tests, 29 passed, 0 failed. Lint: zero errors, existing warnings in AuthContext.tsx and BlogPost.tsx. Build: existing outdated Browserslist and ~698.79 kB bundle warnings. Git reports normal LF/CRLF conversion warnings, no whitespace errors.
Tests cover server prices/retries, signature/timestamp rejection, amount/currency/metadata/live-mode mismatch, duplicate events, failed/expired events, DB failure retry, bearer authorization and unpaid intake rejection, unsafe redirects, stale checkout retry, loopback origin/host/body/no-store boundaries, no mock route on real backend, outbox lease/provider/DB finish failures and isolated provider payloads. One SQL test is STATIC contract inspection, explicitly not SQL execution. Earlier test assertion incorrectly used assert.rejects for a synchronous validation throw; inspected implementation/test, changed to assert.throws and reran full suite successfully. A separate credentials-presence diagnostic had an extra parenthesis; corrected diagnostic passed without code repair.
Production isolation: mock server explicitly refuses NODE_ENV=production; built JS has no mock completion endpoint or simulate button. Real dev frontend is disabled in production; real test backend also refuses production. This proves local build/startup boundaries, not deployed hosting configuration. No server remains running. No browser-driven checkout test performed.

## Configuration still required (names only)
STRIPE_SECRET_KEY (sk_test class only), STRIPE_WEBHOOK_SECRET, PAYMENT_TOKEN_SECRET (stable dedicated >=32 bytes), SUPABASE_URL (isolated project/local), SUPABASE_SERVICE_ROLE_KEY. Adapter constructor configuration for RESEND_API_KEY, RESEND_FROM, RESEND_TEST_TO, HUBSPOT_PRIVATE_APP_TOKEN and isolated test email must be wired explicitly; these are planned environment names, not an auto-running worker. No VITE secret variables.
Checked process environment presence only: Stripe secret/webhook, Supabase URL/service key, Resend key and HubSpot token all absent. No station platform keys/connectors connected. Ignored .env secret values were not read; absence from process environment does not establish no local .env exists.
Stripe needs authorized test credentials and signed event forwarding to loopback port 8788 /api/webhook, subscribed to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed and checkout.session.expired. Use an isolated development Stripe environment. No external transaction authorization inferred.
Run instructions after configuration and approvals: `node server/stripe-server.mjs` (127.0.0.1:8788); `npm run dev` (frontend proxy targets 8788; configured backend origin defaults 127.0.0.1:5173). Use matching origin, not mixed localhost/127.0.0.1. Outbox is an explicit imported batch function and is not scheduled or started automatically.

## Remaining launch gates
1. Provision approved isolated PostgreSQL/Supabase runtime. docker, psql and supabase are absent on PATH. Do not apply remotely without approval. Run both migrations, permission/RLS checks, concurrent event/intake/outbox tests and rollback/retry tests. SQL has only static review evidence.
2. Obtain explicit approval for external test transactions and test-provider sends; configure sandbox credentials/destinations. Receive/process actual Stripe test events for both packages and prove stored paid orders, duplicate safety and authorized intake. Real Stripe integration remains UNVERIFIED.
3. Execute Resend and HubSpot sandbox delivery with receipts, retries and failure persistence; complete CRM project/package mapping and worker startup configuration. Verify test account isolation.
4. Browser-test success, cancel, expired/failure status, refresh, invitation fragment, token expiry and invalid intake authorization against actual isolated DB. Pending bearer installation was corrected after review; SQL execution still required.
5. Production-grade rate limiting, deployment packaging/secrets, logging redaction, reconciliation/refund handling and operational alerts remain required. Loopback-only backend is intentionally not a production deployment.
6. Approve final subscription terms/cancellation/consent/schedule separately before changing disabled constraints or activating billing.
7. Verify deployed commit/config and production mock isolation after separately authorized release. Keep Groupon gated.

## Scheduled evidence maintenance
Existing routines retained. Added Next Wave payment release evidence check, Fridays 4pm America/New_York, read-only evidence delta and three verification priorities delivered to originating conversation. No migrations, transactions, changes or delivery actions in routine.
