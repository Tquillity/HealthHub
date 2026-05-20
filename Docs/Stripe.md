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
