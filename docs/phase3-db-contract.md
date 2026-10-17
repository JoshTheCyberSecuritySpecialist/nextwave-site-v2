# Phase 3 database RPC contract

Migration: `supabase/migrations/202610170002_real_payments.sql`, after `202610170001_payment_fulfillment.sql`. LOCAL DRAFT ONLY; not applied or SQL-executed. No Docker/psql/Supabase installation attempted. All RPCs are SECURITY INVOKER, executable only by service_role (PUBLIC/anon/authenticated revoked). Never expose service-role credentials or call these directly from the browser. Arguments below are exact PostgREST JSON keys. UUIDs and timestamps serialize as strings; scalar JSONB results serialize as objects.

## Checkout

`p3_checkout_prepare(p_request_id uuid, p_package_id text, p_email text) -> jsonb`

Returns `{order_id,request_id,package_id,amount,currency,email,status,stripe_session_id,checkout_url,stripe_idempotency_key}`. Package IDs `booking-only` (79900 cents) / `website-crm` (149900 cents), USD only. Email trimmed/lowercased. Reusing request ID with different package/email raises error. Same request returns existing order. Create a test Stripe Checkout Session server-side using returned price/email/order metadata and `stripe_idempotency_key = checkout:<order UUID>`. Do not create another session if attached. No subscription/recurring line items. Prevent retries outside Stripe's idempotency retention window from creating another session: reconcile the existing session or require operator resolution; database alone cannot make an external Stripe call atomic.

`p3_checkout_attach(p_order_id uuid, p_session_id text, p_checkout_url text) -> jsonb`

Returns `{order_id,stripe_session_id,checkout_url}`. Accepts only `cs_test_…` and `https://checkout.stripe.com/…`. Exact retry allowed; changing an attached session/URL errors. Attach BEFORE accepting corresponding payment event; if webhook races attachment, return retryable non-2xx and retry. Never infer payment from redirect. Browser cancellation alone does not alter order; use Stripe expiry event.

## Verified payment events

`p3_payment_event(p_event_id text, p_event_type text, p_order_id uuid, p_session_id text, p_payment_intent_id text, p_amount integer, p_currency text, p_payment_status text, p_livemode boolean, p_payload_fingerprint text, p_token_hash text DEFAULT NULL) -> jsonb`

Returns `{duplicate:boolean,outcome:string,order_id:uuid}`. Outcomes `paid`, `already_paid`, `awaiting_payment`, `failed`, `expired`, `ignored`.

Backend MUST verify Stripe signature over raw bytes BEFORE RPC; reject live mode and unsupported events. SQL does not verify signatures. Supported event types: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Extract order UUID from trusted session metadata; pass Stripe session id, payment_intent id (nullable for unpaid/failure/expiry), amount_total, currency, payment_status, livemode directly from verified event/session. `p_payload_fingerprint`: lowercase hex SHA-256 of original raw event body. Do not JSON reserialize to fingerprint. Persist/reuse exact fingerprint on retries.

For a paid transition supply `p_token_hash`: lowercase hex SHA-256 of a cryptographically random >=32-byte invitation token. Never store or log raw token in database, metadata, or job error. Invitation expires seven days after paid transition. Duplicate event IDs return stored result; conflicting order/type/fingerprint errors. Entire event/state/job insert transaction rolls back on mismatch or DB failure; return retryable HTTP failure and do not acknowledge success. Order/session/amount/currency must match. Existing paid/intake/fulfilled states never regress on delayed failure/expiry. First paid transition enqueues `payment_confirmation`; intake creates contact/project. Refund events unsupported in this phase; manual operations needed.

**Token delivery handoff:** RPC stores hash only; it never returns raw token. Backend must preserve/reconstruct the corresponding raw token across webhook retries and outbox delivery. Recommended deterministic high-entropy HMAC token from dedicated stable server secret + order UUID + version (then SHA-256 it for DB). Do not generate a disposable random token and discard it: outbox cannot recover it. Secret rotation requires retaining the relevant version; no invitation rotation RPC exists. Test invitation URL must use an allowlisted development origin. No user-supplied redirect URL.

## Status and intake

`p3_order_status(p_order_id uuid,p_token_hash text) -> jsonb`

Returns `{order_id,package_id,status,intake_received:boolean}`. Requires matching hash and unexpired invitation; otherwise generic error. Backend hashes raw bearer token then invokes RPC. No email, raw token, or checkout URL is returned.

`p3_submit_intake(p_order_id uuid,p_token_hash text,p_business_name text,p_requirements text) -> jsonb`

Returns `{order_id,project_id,duplicate:boolean}`. Matching unexpired hash and paid/intake_received/fulfilled order required. Trimmed business name length 1–200; requirements 1–20000. Exact replay succeeds; differing resubmission errors. Transaction inserts intake, upserts customer contact by normalized order email, creates one project, adds initial `ready_for_review` history, marks intake_received, queues `intake_confirmation` and `hubspot_sync`. Unique order/project and order/job-kind constraints prevent duplicate fulfillment. Do not treat token as authority for other orders. Add backend rate limits and avoid logging token-bearing URLs.

## Outbox lease contract

`p3_outbox_claim(p_limit integer DEFAULT 10) -> SETOF fulfillment_outbox`

PostgREST returns an array. Each row: `{id,order_id,kind,status,attempts,next_attempt_at,lease_id,lease_until,last_error,delivered_at}`. `lease_id` is the lease token UUID; must be echoed to finish. `FOR UPDATE SKIP LOCKED` claims due queued or expired processing jobs, up to 1–100, increments attempt count, assigns fresh lease token, lease length five minutes. Up to ten claims. Network delivery occurs OUTSIDE transaction. Do not send beyond lease expiry; there is no heartbeat RPC. A tenth-attempt worker crash is marked terminal `failed` by the next claim sweep after lease expiry; no automatic eleventh claim. Operator recovery is required for terminal failures.

`p3_outbox_finish(p_job_id uuid,p_lease_id uuid,p_success boolean,p_error text DEFAULT NULL,p_external_crm_id text DEFAULT NULL) -> jsonb`

Returns `{status,duplicate,attempts}`; delivered exact retry returns `{status:'delivered',duplicate:true}`. Stale/wrong lease errors. Successful HubSpot job requires external CRM ID (1–200 chars), stored on project contact. Failure queues exponential retry (capped one hour) or terminal `failed` at attempt ten; errors truncated to 2000 chars. Sanitize error content before passing; never include secrets, tokens, or full customer payloads. Successful delivered rows retain lease_id to support finish retries.

### Minimal delivery payload / isolated test destinations

The claim RPC returns routing IDs only, deliberately **not arbitrary payload JSON**. Backend service-role worker SELECTs order/intake/project/contact by `order_id` after claiming. Build these minimum provider payloads in backend:

* `payment_confirmation`: `{job_id,order_id,to:RESEND_TEST_TO,package_id,intake_url}`.
* `intake_confirmation`: `{job_id,order_id,to:RESEND_TEST_TO,package_id,business_name,project_id}`.
* `hubspot_sync`: `{job_id,order_id,email:HUBSPOT_TEST_EMAIL,business_name,package_id,project_id}` to isolated HubSpot test account only.

`RESEND_TEST_TO` and `HUBSPOT_TEST_EMAIL` are server configuration, not RPC arguments; fail closed if absent/non-allowlisted. NEVER fall back to real order.email for external delivery. Do not send real requirements/customer email to a test CRM. Derive invitation token securely as above. Use stable provider idempotency key `outbox:<job UUID>` and HubSpot upsert/deduplication by `order_id`; outbox provides at-least-once delivery, not exactly-once external effects. Receipt of actual Stripe test events and provider test delivery remain unverified.

## Tables / subscription / validation

Adds `service_orders.token_hash`, `token_expires_at`, `checkout_url`, `updated_at`; failed/expired statuses; event type/outcome/fingerprint; outbox lease/error/delivery fields; `project_status_history`; `service_subscriptions` fixed at USD 14900/month architecture with only `disabled` status and NULL Stripe subscription ID permitted. No recurring billing activated. Existing draft tables and RLS retained. New tables RLS enabled without browser policies. Service-role table access is trusted backend only. Project history currently captures initial project creation; no project-status transition RPC is exposed.

SQL execution is **UNTESTED**: delegated command execution unavailable; lead confirms Docker/psql/Supabase absent on PATH. Do not install. No remote migration or transaction performed. Static read-back only. Before approval to apply, run this migration and its prerequisite in an isolated existing PostgreSQL/Supabase environment and test permissions, duplicate/concurrent event and checkout requests, amount/session/currency mismatches, token expiry, intake replay, lease races, CRM receipt persistence, transaction rollback and retries. Example on an already-provisioned LOCAL database: `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610170001_payment_fulfillment.sql -f supabase/migrations/202610170002_real_payments.sql` from project root; Supabase roles must already exist. Never point this command at production.

## Lead review contract correction
`p3_checkout_prepare` also returns `created_at`. Backend refuses creating an unattached session after 23 hours (or missing/invalid creation date), requiring operator reconciliation before Stripe idempotency retention expires.
`p3_checkout_attach` additionally requires `p_token_hash text`; it installs the deterministic bearer hash and seven-day expiry BEFORE payment, enabling authorized pending/failed/expired status checks. Intake remains separately paid-gated. Payment refreshes the invitation validity. This supersedes any statement above that tokens are installed only on payment. Worker exhausted leases now become explicit failed jobs on the next claim pass.
