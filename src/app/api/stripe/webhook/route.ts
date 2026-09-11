import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';
import { processStripeEvent, type PremiumChange } from '@/lib/stripe-webhook';

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('[HealthHub stripe] Invalid webhook signature:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    let premiumChange: PremiumChange | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const checkout = event.data.object;
        if (
          checkout.mode !== 'subscription' ||
          checkout.payment_status === 'unpaid'
        )
          break;
        const userId =
          checkout.metadata?.userId || checkout.client_reference_id;
        if (!userId || !checkout.subscription) {
          throw new Error(
            'Subscription checkout has no HealthHub user or subscription'
          );
        }
        const subscriptionId =
          typeof checkout.subscription === 'string'
            ? checkout.subscription
            : checkout.subscription.id;
        // Fetch current state so a delayed checkout event cannot reactivate a cancellation.
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        premiumChange = {
          userId,
          isPremium:
            subscription.status === 'active' ||
            subscription.status === 'trialing',
        };
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        let userId = subscription.metadata.userId;
        if (!userId) {
          // Checkouts created before subscription metadata was set still carry the user ID.
          const checkouts = await stripe.checkout.sessions.list({
            subscription: subscription.id,
            limit: 1,
          });
          const checkout = checkouts.data[0];
          userId =
            checkout?.metadata?.userId || checkout?.client_reference_id || '';
        }
        if (!userId)
          throw new Error('Canceled subscription has no HealthHub user');
        premiumChange = { userId, isPremium: false };
        break;
      }
    }

    const result = await processStripeEvent(event, premiumChange);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error(
      '[HealthHub stripe] Webhook processing failed:',
      event.type,
      event.id,
      error
    );
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
