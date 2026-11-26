# Package migration plan (Milestone 1)

Local documentation only. Does not change live Stripe Catalog products, prices, or existing customer access until separately reviewed and applied.

## Intended sellable packages

| Package ID | Setup price | Website | Booking | CRM |
| --- | --- | --- | --- | --- |
| `business-website` | $799.00 | Yes (max 3 pages) | No | No |
| `website-crm` | $1,499.00 | Yes (max 5 pages) | Yes | Yes |

Monthly hosting/support pricing remains unresolved. `service_subscriptions` stays disabled. No recurring billing is activated.

## Legacy identifier: `booking-only`

Historical meaning: $799 booking system without CRM or generated website.

Rules:

1. Existing `service_orders` and `organizations` with `package_id = 'booking-only'` keep that identifier and existing entitlements.
2. New public checkout offers only `business-website` and `website-crm`.
3. Admin provisioning continues to accept paid historical `booking-only` orders.
4. Server amount maps still recognize `booking-only` = 79900 for webhook/order validation of historical sessions.
5. No automatic upgrade of booking-only workspaces to a website package.

## Entitlement summary after Milestone 1

- `business-website`: website_enabled, max_pages=3, booking calendars/services off for CRM customers, crm_enabled false
- `website-crm`: website_enabled, max_pages=5, existing booking + CRM caps unchanged
- `booking-only`: website_enabled false, max_pages=0, prior booking-only caps unchanged

## Commercial decisions still required before launch

- Monthly price after the included period ($49 vs $149 or other)
- Whether hosting, support, AI generation, and software access are billed separately
- Generation usage allowances and overage policy
- Refund-related workspace access policy (Milestone 1 records refunds only)
- Whether any legacy booking-only customer receives a complimentary website upgrade
