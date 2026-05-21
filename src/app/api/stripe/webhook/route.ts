import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';
import {
  isStripeEventProcessed,
  markStripeEventProcessed,
  setUserPremium,
} from '@/lib/stripe-webhook';

/**
 * Stripe webhook — signature verify, idempotency, and User.isPremium updates.
 * Gated: requires STRIPE_* env and `pnpm db:push` for stripe_webhook_event table.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    console.error('[HealthHub stripe] Webhook called but Stripe env is not configured');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 400 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const body = await request.text();

  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const event = stripe.webhooks.constructEvent(body, signature, secret);

    if (await isStripeEventProcessed(event.id)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const userId =
          checkoutSession.metadata?.userId ?? checkoutSession.client_reference_id;
        if (userId) {
          await setUserPremium(userId, true);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (userId) {
          await setUserPremium(userId, false);
        }
        break;
      }
      case 'invoice.paid':
        break;
      default:
        break;
    }

    await markStripeEventProcessed(event.id, event.type);
    console.error('[HealthHub stripe] event processed:', event.type, event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[HealthHub stripe] webhook verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
