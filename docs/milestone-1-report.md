# Milestone 1 completion report

Status: **implemented and tested locally**. Not applied to staging or production. Not ready for a paying business end-to-end (generator, editor, and publish are Milestone 2–3).

## 1. What was implemented

- Package reconciliation: sellable `business-website` ($799) and `website-crm` ($1,499); legacy `booking-only` preserved for history only ([docs/package-migration.md](package-migration.md)).
- Payment safety: live Checkout construction refused while payment RPCs remain test-only; refund webhook recording via `p3_refund_event` without suspending workspaces.
- Owner onboarding: `/crm/invite` account setup + sign-in, invitation preview/setup APIs, invitation message enqueue on provision/reissue.
- Website foundation schema: `business_profiles`, `websites`, `website_revisions`, `website_assets`, `website_generation_jobs`, entitlements (`website_enabled`, `max_pages`, `max_generation_runs`), RLS via `crm_active_member`.
- Provisioning creates an empty draft website + revision for website packages.
- Restored cancelled-booking idempotency rejection overwritten by the confirmation migration.

## 2. What works end to end (local)

- New checkout package IDs and server prices.
- Live Stripe adapter/startup refusal.
- Refund event recording with `access_unchanged`.
- Invitation preview and password setup with email locked to invite.
- Provision `business-website` / `website-crm` → entitlements + draft website; org A cannot read org B websites (PGlite).
- Existing booking/CRM isolation and public booking flows still pass locally.

## 3. Tests exercised

Local Node test run (37 passing), including:

- `tests/milestone1-foundation.test.mjs`
- `tests/payments.test.mjs`, `tests/stripe-payments.test.mjs`, `tests/checkout-routing.test.mjs`
- `tests/crm-provision.test.mjs`, `tests/crm-isolation.test.mjs`
- `tests/public-booking.test.mjs`, `tests/booking-setup.test.mjs`, `tests/booking-confirmation.test.mjs`
- `tests/production-server.test.mjs`

Browser flows, staging, and production were **not** exercised.

## 4. Missing or blocked

- Website generation AI, editor, preview renderer, publish/rollback (Milestone 2–3).
- Invitation email worker delivery wiring in production boot (messages are queued; sandbox send still needs explicit worker run).
- Live Stripe enablement (intentionally blocked).
- Monthly/recurring billing (still disabled).
- Custom domains.
- Hosted migration apply.

## 5. Required migrations and configuration

Migration (review on a copy first; do not apply to production blindly):

- `supabase/migrations/20261126120000_milestone1_foundation.sql`

Config (no secret values):

- Keep `STRIPE_MODE=test`.
- Frontend needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- API needs existing Stripe/Supabase/`APP_BASE_URL` vars.
- Optional email: `RESEND_API_KEY` / `RESEND_FROM` for later delivery of queued invitations.

## 6. Decisions still needed

- Monthly hosting/support price and start timing.
- Generation usage allowances and overage.
- Refund → workspace access policy (refunds are recorded only today).
- Whether legacy `booking-only` customers get a website upgrade path.

## 7. Next concrete milestone

**Milestone 2: Generator** — business intake UI, Gemini (or fixture) generation behind an interface, validated website schema output, business-specific draft render.

## 8. Paying-business readiness

**No.** Evidence: no generation, no editor, no public business site publish path, live payments blocked, migrations not verified on hosted Supabase.
