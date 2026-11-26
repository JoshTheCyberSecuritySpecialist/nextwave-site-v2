# Milestone 2 completion report

Status: **implemented and tested locally**. Generation migration not pushed to hosted Supabase in this step. Not production-ready for paying businesses (no public publish/editor yet).

## 1. What was implemented

- Versioned website content schema + validation (`server/website-schema.mjs`)
- Durable generation RPCs (`supabase/migrations/20261126160000_website_generation.sql`)
- Provider interface with Gemini + labeled fixtures (`server/website-generator.mjs`)
- API routes: `GET/POST /api/crm/organizations/:id/website[/generate]`
- Owner UI: `/crm/website` studio + `/crm/website/intake`
- Draft preview renderer with desktop/mobile toggle
- Package-aware CRM nav (website vs booking)

## 2. What works end to end (local)

Owner with website entitlement can:

1. Complete business intake on `business_profiles`
2. Generate a draft (fixture without `GEMINI_API_KEY`, or Gemini when configured)
3. Persist a new draft revision without touching `published_revision_id`
4. Preview the draft in the CRM

Failed/invalid generation does not apply a revision. Fixture output is labeled unfinished and reported as fixture, not live AI success.

## 3. Tests exercised

Local Node tests passing:

- `tests/website-schema.test.mjs`
- `tests/website-generator.test.mjs`
- prior `tests/milestone1-foundation.test.mjs`

Browser flows and hosted generation were **not** exercised here.

## 4. Missing or blocked

- Structured editor, publish, rollback, public URL (Milestone 3)
- Section-level regeneration UI
- Hosted apply of `20261126160000_website_generation.sql`
- Real Gemini verification in staging (requires `GEMINI_API_KEY` on API host)
- Production fixture disabled (`allowFixture: false` when `NODE_ENV=production`)

## 5. Required migrations and configuration

New migration:

- `supabase/migrations/20261126160000_website_generation.sql`

Config:

- Existing Supabase + CRM auth
- Optional `GEMINI_API_KEY` / `GEMINI_MODEL` on the API server for real generation
- Without the key: local/dev can use labeled fixtures; production returns not configured

## 6. Decisions still open

Unchanged from Milestone 1: monthly pricing, generation overage policy, refund access, legacy booking-only upgrades.

## 7. Next concrete milestone

**Milestone 3: Editor and publishing** — structured edits, persistent draft states, private preview route hardening, unique public URL, publish/republish/rollback.

## 8. Paying-business readiness

**No.** Evidence: no public publish path, no editor, generation migration may not be on host yet, Gemini not verified in staging.
