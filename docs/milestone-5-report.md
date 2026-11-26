# Milestone 5 completion report

Status: **local release verification packaged**. Hosted migration apply, Stripe CLI/browser E2E, and commercial decisions remain open. Not paying-business ready.

## 1. What was implemented

- Concurrency PGlite suite: stale draft save, parallel same-slot booking, generation-in-progress + stale apply (`tests/m5-concurrency.test.mjs`)
- Release smoke: route registration, env completeness, live Stripe refusal, pending migration headers (`tests/m5-release-smoke.test.mjs`)
- Checklists: `docs/migration-apply-checklist.md`, `docs/payment-test-mode-checklist.md`, `docs/commercial-decisions.md`
- `.env.example` documents `RESEND_*` and Render `start:api`
- npm scripts: `test`, `test:m5`

## 2. Verification matrix

| Item | Local result |
| --- | --- |
| Browser testing | Route registration smoke only — no Playwright/Cypress; authenticated CRM/browser flows not run |
| DB concurrency | Stale draft, parallel booking, generation races covered in PGlite |
| Payment test-mode | Unit/integration refuse live mode; manual Stripe checklist written, not executed against Stripe |
| Deployment / migrations | Config reviewed; M1–M4 still marked pending review; apply checklist written |
| Commercial decisions | Logged as open/deferred in `docs/commercial-decisions.md` |

## 3. Tests exercised

- `npm run test:m5` (M5 suites + publishing/connected-tools/production-server/checkout-routing)
- Full gate: `npm test`

## 4. Still required before launch

1. Hosted apply of pending migrations per `docs/migration-apply-checklist.md`
2. Manual Stripe test-mode pass for both packages (`docs/payment-test-mode-checklist.md`)
3. Staging browser: publish → `/site/{slug}` → inquiry → (CRM) book → confirmation email with Resend
4. Close commercial decisions in `docs/commercial-decisions.md`
5. Only then reconsider enabling live Stripe checkout

## 5. Paying-business readiness

**No.** Evidence: migrations may not be on host; no hosted browser/Stripe pass; commercial pricing and refund policy unresolved; live checkout intentionally disabled.
