# Commercial decisions log (Milestone 5)

Status of launch blockers that code alone cannot close. Update this file when a decision is made.

| Decision | Status | Notes |
| --- | --- | --- |
| Monthly hosting/support price after included period | **Open** | Candidates include $49 vs $149; `service_subscriptions` remains disabled |
| Separate billing for hosting vs support vs AI generation vs software access | **Open** | Affects Stripe Catalog and entitlement caps |
| Generation allowances / overage | **Open** | Caps exist (`max_generation_runs`); overage product not defined |
| Refund → workspace access | **Open** | Refunds are recorded; access is not auto-suspended |
| Legacy `booking-only` complimentary website upgrade | **Open** | No automatic upgrade path; checkout no longer sells `booking-only` |
| Date-specific booking closures | **Deferred** | Weekly hours only for M4/M5 |
| Guest cancellation email | **Deferred** | Cancel clears pending confirmation/reminder; no cancellation kind |

## Active sellable packages (unchanged)

- `business-website` — $799 — website only
- `website-crm` — $1,499 — website + booking + CRM

Live Stripe checkout remains disabled in the API until livemode payment RPCs are reviewed.
