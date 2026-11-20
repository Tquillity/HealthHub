import type Stripe from 'stripe';

/** The parts of the Stripe client that account deletion uses (a fake in tests). */
export type StripeClient = {
  subscriptions: Pick<Stripe['subscriptions'], 'search' | 'list' | 'cancel'>;
  customers: Pick<Stripe['customers'], 'list'>;
};

const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired']);

/**
 * Cancels the user's HealthHub Pro subscriptions immediately.
 *
 * Finds them by the `userId` metadata that checkout sets, and by customers with the
 * user's email for older checkouts. The Stripe account may bill other products, so a
 * subscription found by email is only cancelled if it is for the Pro price.
 * Returns the ids of the cancelled subscriptions.
 */
export async function cancelProSubscriptions(
  user: { id: string; email: string },
  stripe: StripeClient,
  proPriceId: string | undefined
): Promise<string[]> {
  const toCancel = new Map<string, Stripe.Subscription>();

  if (/^[\w-]+$/.test(user.id)) {
    for await (const subscription of stripe.subscriptions.search({
      query: `metadata['userId']:'${user.id}'`,
      limit: 100,
    })) {
      if (subscription.metadata?.userId === user.id) {
        toCancel.set(subscription.id, subscription);
      }
    }
  }

  if (proPriceId) {
    for await (const customer of stripe.customers.list({
      email: user.email,
      limit: 100,
    })) {
      for await (const subscription of stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 100,
      })) {
        const isPro = subscription.items.data.some(
          (item) => item.price?.id === proPriceId
        );
        if (isPro) toCancel.set(subscription.id, subscription);
      }
    }
  }

  const cancelled: string[] = [];
  for (const subscription of toCancel.values()) {
    if (ENDED_STATUSES.has(subscription.status)) continue;
    await stripe.subscriptions.cancel(subscription.id);
    cancelled.push(subscription.id);
  }
  return cancelled;
}
