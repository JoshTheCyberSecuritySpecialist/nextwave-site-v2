# Milestone 6 completion report

Status: **local launch-readiness tooling implemented**. Hosted apply, Stripe sandbox pass, authenticated staging browser pass, and commercial decisions remain operator/business gates. Not paying-business ready.

## 1. Why Milestone 6

Milestone 5 packaged verification artifacts. The remaining launch work is operational:

1. Hosted migration apply
2. Staging browser product pass
3. Manual Stripe test-mode pass
4. Closing commercial decisions before live charges

Milestone 6 adds the runbooks, migration status helper, and automated public-route browser smoke so those gates are executable.

## 2. What was implemented

- `docs/staging-launch-runbook.md` — end-to-end go/no-go sequence
- `scripts/migration-status.mjs` + `npm run migrate:status` (optional `--linked` / `--dry-run`; never applies)
- Playwright public smoke: `/`, `/crm/login`, checkout packages, missing `/site` and `/book` (`e2e/public-smoke.spec.ts`)
- `npm run test:e2e`, `npm run test:m6`
- Local readiness asserts in `tests/m6-launch-readiness.test.mjs`

## 3. What was verified locally

- `npm run migrate:status` lists M1–M4 migrations and skips remote without credentials
- `npm run test:m6` passes
- `npm run test:e2e` exercises the built preview app (public routes only)

## 4. Still blocked / operator-owned

| Gate | Owner |
| --- | --- |
| `supabase db push` on the real project | Operator (after dry-run review) |
| Stripe test checkout + webhook on Render | Operator |
| Authenticated CRM browser pass | Operator with seeded test workspace |
| Commercial decisions | Business (`docs/commercial-decisions.md`) |
| Enable live Stripe | Only after all gates pass |

## 5. Paying-business readiness

**No.** Evidence: hosted migrations, Stripe sandbox, authenticated staging E2E, and commercial pricing/refund policy are not closed by this milestone alone.
