# Migration apply checklist (Milestone 5)

Apply only after review on a database copy. Do not treat a green local PGlite suite as hosted apply approval.

## Hosted order

Apply chronologically from `supabase/migrations/`. Website platform milestones that must be present before paying-business website flows:

| Order | File | Milestone |
| --- | --- | --- |
| …prior CRM/booking… | `202610*`–`20261125170000_*` | CRM + booking foundation |
| 1 | `20261126120000_milestone1_foundation.sql` | M1 packages / website tables |
| 2 | `20261126143000_site_messages.sql` | Platform admin contact inbox |
| 3 | `20261126160000_website_generation.sql` | M2 generation jobs |
| 4 | `20261126180000_website_publishing.sql` | M3 draft / publish / rollback |
| 5 | `20261126190000_website_connected_tools.sql` | M4 inquiries + public booking hints |

Every file above still carries a “pending review / do not apply” header until explicitly cleared.

## Pre-apply

1. Confirm target project URL (copy vs production).
2. `supabase db dump` or snapshot the target.
3. Dry-run against remote: `npx supabase db push --dry-run --linked` (or `--remote` when required by CLI).
4. Review SQL for `security definer` RPCs and grants (`anon` only where intentional: booking create, public page, inquiry submit).

## Post-apply smoke

1. `website_public_page` and `website_submit_inquiry` executable by anon.
2. `website_save_draft` / `website_publish` / `website_rollback` service_role only.
3. Provision a test `business-website` and `website-crm` order in test mode.
4. Generate → edit → publish → `/site/{slug}` → inquiry.
5. For `website-crm` only: publish booking → `/book/{slug}` → appointment → confirmation row queued.

## Rollback note

These migrations create tables/functions; there is no automated down migration. Restore from the pre-apply snapshot if apply fails mid-sequence.
