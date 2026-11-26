# Milestone 3 completion report

Status: **implemented and tested locally**. Publishing migration not pushed to hosted Supabase in this step. Not production-ready until migration is applied and browser flows are verified.

## 1. What was implemented

- Draft save / publish / rollback RPCs + public page resolver (`supabase/migrations/20261126180000_website_publishing.sql`)
- Publishing service (`server/website-publishing.mjs`) with content validation and unfinished-block gate
- API routes: `POST …/website/draft|publish|rollback`, `GET …/website/revisions|preview`
- Owner UI: structured editor, private preview, studio publish/rollback + public path
- Public route `/site/:slug` via `website_public_page` (drafts stay private)

## 2. What works end to end (local)

Owner with website entitlement can:

1. Edit draft sections/pages and save a new draft revision (base-revision concurrency check)
2. Preview the draft privately in CRM (`/crm/website/preview`)
3. Publish a finished draft to `/site/{slug}` without exposing unfinished fixture drafts
4. Republish a later draft and roll back to a prior published revision
5. Failed publish (unknown revision) leaves the live `published_revision_id` unchanged

## 3. Tests exercised

Local Node tests passing:

- `tests/website-publishing.test.mjs` (RPC publish/rollback safety, auth on publish route, draft validation)
- Prior M1/M2 suites remain the regression baseline

Browser flows and hosted publish were **not** exercised here.

## 4. Missing or blocked

- Hosted apply of `20261126160000_website_generation.sql` and `20261126180000_website_publishing.sql`
- Section-level AI regeneration UI
- Staging browser pass for editor → publish → public URL → rollback
- Real Gemini verification in staging

## 5. Required migrations and configuration

New migration:

- `supabase/migrations/20261126180000_website_publishing.sql`

Depends on:

- `20261126120000_milestone1_foundation.sql`
- `20261126160000_website_generation.sql`

Config: existing Supabase + CRM auth; public page uses anon-callable `website_public_page`.

## 6. Decisions still open

Unchanged from earlier milestones: monthly pricing, generation overage, refund access, legacy booking-only upgrades.

## 7. Next concrete milestone

**Milestone 4 (suggested):** hosted migration apply + staging E2E publish verification, then section regeneration / polish before paying-business readiness.

## 8. Paying-business readiness

**No.** Evidence: publishing migration may not be on host yet; browser E2E not run; Gemini not verified in staging.
