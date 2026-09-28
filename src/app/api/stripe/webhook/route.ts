import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { isPremiumSubscriptionStatus, isStripeConfigured } from '@/lib/stripe';
import { processStripeEvent, type PremiumChange } from '@/lib/stripe-webhook';

/** HealthHub user for a subscription: its metadata, else the original checkout's. */
async function resolveSubscriptionUserId(
  stripe: Stripe,
  subscription: Stripe.Subscription
): Promise<string> {
  const fromMetadata = subscription.metadata?.userId;
  if (fromMetadata) return fromMetadata;
  // Checkouts created before subscription metadata was set still carry the user ID.
  const checkouts = await stripe.checkout.sessions.list({
    subscription: subscription.id,
    limit: 1,
  });
  const checkout = checkouts.data[0];
  return checkout?.metadata?.userId || checkout?.client_reference_id || '';
}

/**
 * True when the user has another subscription that still grants Pro.
 * Guards against revoking access because an old subscription lapsed while a newer one is paid.
 */
async function hasOtherLiveSubscription(
  stripe: Stripe,
  userId: string,
  subscriptionId: string
): Promise<boolean> {
  // Search can't mix AND/OR, so query by user and filter statuses here
  if (!/^[\w-]+$/.test(userId)) return false;
  const result = await stripe.subscriptions.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 20,
  });
  return result.data.some(
    (other) =>
      other.id !== subscriptionId && isPremiumSubscriptionStatus(other.status)
  );
}

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
          isPremium: isPremiumSubscriptionStatus(subscription.status),
        };
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = await resolveSubscriptionUserId(stripe, subscription);
        if (!userId) {
          // Not a HealthHub subscription (e.g. created in the dashboard); a retry can't fix that
          console.warn(
            '[HealthHub stripe] Ignoring update for unmapped subscription',
            subscription.id
          );
          break;
        }
        // Fetch current state so an out-of-order update cannot restore stale access.
        const current = await stripe.subscriptions.retrieve(subscription.id);
        const isPremium = isPremiumSubscriptionStatus(current.status);
        if (
          !isPremium &&
          (await hasOtherLiveSubscription(stripe, userId, subscription.id))
        )
          break;
        premiumChange = { userId, isPremium };
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = await resolveSubscriptionUserId(stripe, subscription);
        if (!userId)
          throw new Error('Canceled subscription has no HealthHub user');
        if (await hasOtherLiveSubscription(stripe, userId, subscription.id))
          break;
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
