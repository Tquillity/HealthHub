import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';

/**
 * Minimal Stripe webhook — signature verify + log only.
 * No Prisma / isPremium updates in Phase 8 (see Docs/Stripe.md).
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

    console.error('[HealthHub stripe] event received:', event.type, event.id);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.deleted':
      case 'invoice.paid':
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[HealthHub stripe] webhook verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
