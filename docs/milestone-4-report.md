# Milestone 4 completion report

Status: **implemented and tested locally**. Connected-tools migration not pushed to hosted Supabase in this step. Not production-ready until migration is applied and browser flows are verified.

## 1. What was implemented

- Generated/fixture sites wire booking CTAs to `/book/{orgSlug}` when the package includes services
- Working tenant `contact_form` section + `website_inquiries` storage (never creates CRM customers)
- Public page hints: `booking_enabled`, `booking_path`, `contact_enabled`
- CRM inquiries inbox at `/crm/inquiries` (website packages only)
- Customer detail booking history (appointments linked by `customer_id`)
- Booking confirmation/reminder worker started from the API process when Resend is configured
- Overview UI no longer shows booking setup for website-only packages

## 2. What works end to end (local)

1. `website-crm` generation prefers booking CTAs; `business-website` uses contact CTAs + form
2. Published `/site/:slug` can submit inquiries into `website_inquiries` without touching `customers`
3. When booking is published and entitled, public page exposes `/book/{organization_slug}`
4. CRM owners with `crm_enabled` see linked appointment history on a customer
5. With `RESEND_API_KEY` + `RESEND_FROM`, the API boots a booking message delivery loop

## 3. Tests exercised

Local Node tests passing:

- `tests/website-connected-tools.test.mjs`
- Prior `tests/website-generator.test.mjs`, `tests/website-schema.test.mjs`, `tests/website-publishing.test.mjs`

Browser flows and hosted apply were **not** exercised here.

## 4. Missing or blocked

- Hosted apply of M2–M4 migrations (`20261126160000`, `20261126180000`, `20261126190000`)
- Date-specific closures / blackout days
- Guest cancellation email kind (cancel still stops pending confirmation/reminder rows only)
- Staging browser pass: publish → public site → book → inquiry → customer history → email delivery

## 5. Required migrations and configuration

New migration:

- `supabase/migrations/20261126190000_website_connected_tools.sql`

Config for transactional booking mail:

- `RESEND_API_KEY`
- `RESEND_FROM`

Without Resend, booking messages still queue; the worker stays off.

## 6. Decisions still open

Unchanged: monthly pricing, generation overage, refund access, legacy booking-only upgrades. Closures deferred.

## 7. Next concrete milestone

**Milestone 5: Release verification** — browser testing, real DB concurrency, payment test-mode verification, deployment/migration review, remaining commercial decisions.

## 8. Paying-business readiness

**No.** Evidence: connected-tools migration may not be on host yet; browser E2E and live Resend delivery not verified in staging.
