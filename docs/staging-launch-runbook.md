# Staging launch runbook (Milestone 6)

Operator steps after local M1–M5 code is on `main`. Do not enable live Stripe until every section passes.

## 1. Hosted migrations

1. Confirm target is the intended Supabase project (`teuebkyqqoygvluxggfa` or current linked project).
2. Snapshot / dump the database.
3. Dry-run: `npm run migrate:status` then `npx supabase db push --dry-run --linked` (use `--remote` if the CLI requires it).
4. Apply only after dry-run looks correct: `npx supabase db push --linked`.
5. Confirm M1–M4 website migrations appear as applied (`20261126120000`, `20261126160000`, `20261126180000`, `20261126190000`).

See also `docs/migration-apply-checklist.md`.

## 2. Render API

1. Deploy `main` with `npm run start:api`.
2. Env: `STRIPE_MODE=test`, test Stripe keys, Supabase URL + service role, `APP_BASE_URL=https://nextwavedigitalsolution.com`, `PAYMENT_TOKEN_SECRET`.
3. Optional: `GEMINI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`.
4. Hit `GET /api/health` (or existing health route) and confirm process stays up without Resend.

## 3. Vercel web

1. Deploy frontend with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, empty or `test` for `VITE_CHECKOUT_MODE`.
2. Confirm `/`, `/crm/login`, `/checkout` load.
3. Confirm API calls go to Render, not Vercel rewrites.

## 4. Stripe test-mode pass

Follow `docs/payment-test-mode-checklist.md` for both packages:

- `business-website` $799
- `website-crm` $1,499

Webhook must hit Render `/api/webhook`.

## 5. Browser product pass (staging)

1. Admin provision a paid test `website-crm` order → accept invite.
2. Intake → generate → edit → clear unfinished → publish.
3. Open `/site/{slug}` → submit contact form → see row in `/crm/inquiries` (not Customers).
4. Configure service + hours → publish booking → book on `/book/{slug}`.
5. Confirm appointment appears; customer links when CRM enabled; confirmation email sends if Resend is set.
6. Repeat publish/rollback once; confirm public page updates and failed publish would not wipe live pointer (already unit-covered).

## 6. Go / no-go

| Gate | Required for paying businesses |
| --- | --- |
| Migrations applied on host | Yes |
| Stripe test pass both packages | Yes |
| Browser product pass | Yes |
| Commercial decisions closed | Yes (`docs/commercial-decisions.md`) |
| Live Stripe enabled | Only after the above |

Commercial pricing, refund policy, and booking-only upgrades stay blocked until decided — code cannot close them.
