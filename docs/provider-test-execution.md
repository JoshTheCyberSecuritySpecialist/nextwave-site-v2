# Provider test execution — 2026-10-17

## Executed
Phase 3 preserved locally in c6c7d09 on development/launch-readiness: 17 explicit files, no unrelated files staged. Fresh 29/29 tests, typecheck, lint, build and whitespace checks passed. Secret-pattern scan of tracked/unignored candidates found zero matches; no tracked .env files or root .env files found. This is a targeted scan, not proof against every possible secret format. Production mock startup refuses NODE_ENV=production, browser bundle excludes mock completion, real backend has no mock route. Deployed configuration remains unverified.

Follow-up: accept restricted rk_test_ credentials in Stripe adapter while retaining rejection of both live-key classes; dedicated regression added.

## Tooling / isolation
Node v22.23.2 installed. npm and winget available. supabase, psql, docker and stripe not on PATH; standard Docker Desktop and PostgreSQL locations absent. No supabase/config.toml or linked-project metadata found in inspected supabase tree. Required backend process variables absent. No connected provider connectors or stored platform keys. No dedicated development database/account can be established from available evidence; this does NOT prove none exists in the owner's accounts.

Minimum system installation: NONE if using an existing approved hosted development Supabase project and browser Stripe Checkout plus a CLI binary for forwarding. Fully local Windows Supabase requires a Docker-compatible runtime; a separate PostgreSQL install is unnecessary. Do not install anything without owner approval.

Proposed Windows commands, not executed:
```
winget install --exact --id Docker.DockerDesktop
npm install --save-dev supabase
npx supabase init
npx supabase start
```
Docker startup may require virtualization/WSL prerequisites and restart. CLI init/start must use an isolated scratch directory, not blindly replay unrelated historical blog migrations. Pin the installed Supabase version. Supabase official installation reference: https://supabase.com/docs/guides/local-development/cli/getting-started

## Shortest hosted alternative
Owner signs in to Supabase and identifies an existing dedicated development project, or creates a new development-only project, with no production data or shared secrets. Confirm its project identity and authorization before remote SQL. Use SQL editor to apply only the two reviewed payment migrations in sequence AFTER explicit approval. Configure development-only URL/service credential server-side. No CLI, Docker or standalone PostgreSQL is required for hosted REST integration.

## Migration review
Apply 202610170001_payment_fulfillment.sql before 202610170002_real_payments.sql on a new isolated database. Second migration expects the default-generated service_orders_status_check constraint and is not rerunnable. Both use transactions. Tables use foreign keys, unique order/session/payment/event/intake/project/job constraints. All payment tables enable RLS without browser policies; second migration revokes PUBLIC/anon/authenticated access, limits RPC EXECUTE to service_role, and grants required tables and identity sequence privileges. Service role/RLS bypass must be verified against real database grants. Event advisory locks plus order row locks serialize processing; intake and outbox creation are atomic. Outbox uses SKIP LOCKED leases.

Issues / unproven boundaries: no executed SQL evidence; preexisting table/constraint names can conflict; generic PostgreSQL lacks Supabase anon/authenticated/service_role roles. Backend accepts any HTTPS Supabase URL, so development identity is an operator gate rather than enforced allowlist. Receipt IDs for email are returned by worker but not durably stored by outbox_finish; HubSpot ID is persisted on contact. Delivery is at-least-once. No production rate limiting. These remain release blockers, not reasons to apply to production.

Execution gate: inspect database identity, empty payment schema, roles and privileges; capture migration results; test unauthorized roles, incorrect/duplicate/concurrent events, rollback on invalid inputs and intake replay. On migration failure its current transaction rolls back; migration 001 remains if 002 fails. For fresh disposable development only, discard/recreate the isolated database as rollback. Never drop a shared/production schema. Preserve test evidence first. No destructive rollback or remote migration executed.

## Credentials and forwarding
Backend names: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYMENT_TOKEN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Delivery constructor mapping names: RESEND_API_KEY, RESEND_FROM, RESEND_TEST_TO, HUBSPOT_PRIVATE_APP_TOKEN; worker needs explicit wiring, not automatic env loading. NODE_ENV must not be production. Never put these in VITE_* or browser code.

Owner selects an isolated Stripe sandbox/test environment, creates a restricted test key with Checkout Sessions create/read and permissions for inline price/product creation as required by Stripe. Prefer minimum grants and verify permission errors without widening silently. No live keys. Store credentials in a local ignored .env.payments.test (or secure process environment), never chat or version control. Node supports loading it with:
```
node --env-file=.env.payments.test server/stripe-server.mjs
```
Generate a stable >=32-byte PAYMENT_TOKEN_SECRET locally without displaying it. Stripe CLI login is performed by owner in the selected sandbox. After approved CLI installation/authentication:
```
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://127.0.0.1:8788/api/webhook
```
Securely transfer listener signing secret into STRIPE_WEBHOOK_SECRET; do not capture it in reports. Restart backend after configuration. Frontend: npm run dev -- --host 127.0.0.1. Use http://127.0.0.1:5173 consistently. Forwarding is prepared as exact command, NOT running or verified. No fake CLI-trigger event substitutes for an actual Checkout purchase. Stripe CLI reference: https://docs.stripe.com/stripe-cli/use-cli

## Next gated execution
Obtain database identity/credentials and explicit remote-migration authorization OR approved local runtime installation. Obtain selected Stripe sandbox credentials, CLI authentication, and explicit test-transaction authorization. Approve sandbox email/CRM destinations separately. Then run actual $799 and $1,499 checkouts, verify signed events and persisted paid orders, intake, one project/order and deduplicated outbox; capture sanitized provider IDs and failures/retries. No external test performed in this run. User request ends at 'Create one test'; no missing deliverable is inferred from that truncation.
