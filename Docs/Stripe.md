# Stripe — premium spike (Phase 8)

**Status:** Webhook skeleton only. **No checkout UI or `User.isPremium` updates in this phase.**

## Gate (production)

- Lawyer-approved Terms (subscriptions section)
- Product pricing finalized
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel (not committed)

## Environment variables

```env
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_ID_PRO=""
```

## Planned flow (future)

1. User clicks **Go Pro** on `/pro` → Stripe Checkout Session.
2. `checkout.session.completed` webhook → set `User.isPremium = true`.
3. `customer.subscription.deleted` → set `isPremium = false`.
4. Idempotency: store processed `event.id` or use Stripe idempotency keys.

## Webhook route

- `POST /api/stripe/webhook`
- Verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`
- Log event type; return 400 if misconfigured
- **Out of scope for this spike:** `User.isPremium` updates, Checkout, Customer Portal, `/pro` button changes

## Test mode

Use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Related

- `src/lib/stripe.ts` — `isStripeConfigured()`
- `prisma/schema.prisma` — `User.isPremium`

## Failed payments (grace period)

A subscription whose renewal payment fails becomes `past_due` in Stripe. HealthHub keeps Pro
on during that time and shows an "Update your card" banner on every signed-in page
(`src/lib/billing-notice.ts`, `POST /api/stripe/portal`). Pro ends when Stripe stops retrying
and moves the subscription to `canceled` or `unpaid`.

How long the grace period lasts is a Stripe setting, not code. In the Stripe Dashboard under
**Billing → Revenue recovery**:

- **Retries:** retry for about 1 week (Smart Retries).
- **If all retries fail:** cancel the subscription.
- **Emails:** turn on the failed-payment emails to customers.

Under **Settings → Billing → Customer portal**, save the portal settings once so the banner can
open the page where a customer updates their card. Until then it opens the unpaid invoice's
payment page instead.
