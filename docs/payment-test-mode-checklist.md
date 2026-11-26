# Payment test-mode checklist (Milestone 5)

Automated coverage already refuses live keys/events when `STRIPE_MODE=test` and blocks `createProductionApp` when livemode is true. This checklist is the **manual** Stripe Test Mode pass before launch.

## Preconditions

- `STRIPE_MODE=test`
- `STRIPE_SECRET_KEY` starts with `sk_test_`
- Webhook endpoint: `https://nextwave-site-v2.onrender.com/api/webhook` (or Stripe CLI forward to local `8788`)
- Frontend `VITE_CHECKOUT_MODE` empty or `test` (never `live` for this pass)

## Cases

1. **business-website ($799)**  
   Checkout → pay with Stripe test card → webhook marks order paid → admin provision → invite → CRM login → website tools only (no booking nav).

2. **website-crm ($1,499)**  
   Same through provision → booking + customers + website tools available.

3. **Reject live event while in test mode**  
   Confirm API returns non-2xx / ignores livemode event (unit-covered; re-check on host logs if a live event is misrouted).

4. **Amount mismatch**  
   Tampered session amount must not mark paid (unit-covered).

5. **Refund recording**  
   Issue a Stripe test refund; confirm refund is stored and workspace is **not** auto-suspended until a commercial policy decides otherwise.

## Pass criteria

- Both packages create paid orders only via verified webhooks.
- No live Checkout Session is created.
- Provisioning remains admin/manual and idempotent.
