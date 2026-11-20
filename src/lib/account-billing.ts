import type Stripe from 'stripe';

/** The parts of the Stripe client that account deletion uses (a fake in tests). */
export type StripeClient = {
  subscriptions: Pick<Stripe['subscriptions'], 'search' | 'list' | 'cancel'>;
  customers: Pick<Stripe['customers'], 'list'>;
  invoices: Pick<Stripe['invoices'], 'retrieve'>;
  refunds: Pick<Stripe['refunds'], 'list' | 'create'>;
};

const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired']);

/** Refund metadata key that marks a refund as made for an account deletion. */
const REFUND_MARKER = 'accountDeletionSubscription';

function idOf(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

/**
 * Refunds the unused part of the current billing period to the original payment
 * method, pro rata by time. Returns the refunded amount in the smallest currency
 * unit, or 0 when there is nothing to refund.
 *
 * Runs before the subscription is cancelled, so a Stripe failure leaves everything
 * as it was. Safe to repeat: a refund already made for this subscription's deletion
 * is not made again, and the refund never exceeds what is left of the payment.
 */
export async function refundUnusedTime(
  subscription: Stripe.Subscription,
  userId: string,
  stripe: StripeClient,
  now: Date = new Date()
): Promise<number> {
  // Trials have paid nothing, and a past-due period has not been paid for.
  if (subscription.status !== 'active') return 0;
  const start = subscription.current_period_start;
  const end = subscription.current_period_end;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (!start || !end || end <= start || nowSeconds >= end) return 0;

  const invoiceId = idOf(subscription.latest_invoice);
  if (!invoiceId) return 0;
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const paymentIntentId = idOf(invoice.payment_intent);
  // Paid from account credit or not paid at all: no card payment to refund.
  if (!invoice.paid || invoice.amount_paid <= 0 || !paymentIntentId) return 0;

  const unusedFraction = (end - Math.max(nowSeconds, start)) / (end - start);
  let amount = Math.floor(invoice.amount_paid * unusedFraction);

  let alreadyRefunded = 0;
  for await (const refund of stripe.refunds.list({
    payment_intent: paymentIntentId,
    limit: 100,
  })) {
    if (refund.metadata?.[REFUND_MARKER] === subscription.id) return 0;
    if (refund.status !== 'failed' && refund.status !== 'canceled') {
      alreadyRefunded += refund.amount;
    }
  }
  amount = Math.min(amount, invoice.amount_paid - alreadyRefunded);
  if (amount <= 0) return 0;

  await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount,
    reason: 'requested_by_customer',
    metadata: { [REFUND_MARKER]: subscription.id, userId },
  });
  return amount;
}

/**
 * Cancels the user's HealthHub Pro subscriptions immediately and refunds the unused
 * part of the current billing period.
 *
 * Finds them by the `userId` metadata that checkout sets, and by customers with the
 * user's email for older checkouts. The Stripe account may bill other products, so a
 * subscription found by email is only cancelled if it is for the Pro price and is not
 * tagged with another user's id.
 * Returns the ids of the cancelled subscriptions.
 */
export async function cancelProSubscriptions(
  user: { id: string; email: string },
  stripe: StripeClient,
  proPriceId: string | undefined,
  now: Date = new Date()
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
        // The email typed at checkout is free text, so it can match a customer who
        // pays for someone else's account. Never cancel a subscription tagged with
        // another user's id.
        const owner = subscription.metadata?.userId;
        const belongsToSomeoneElse = Boolean(owner) && owner !== user.id;
        if (isPro && !belongsToSomeoneElse) {
          toCancel.set(subscription.id, subscription);
        }
      }
    }
  }

  const cancelled: string[] = [];
  for (const subscription of toCancel.values()) {
    if (ENDED_STATUSES.has(subscription.status)) continue;
    // Refund first: if Stripe fails here, the subscription is still intact.
    await refundUnusedTime(subscription, user.id, stripe, now);
    await stripe.subscriptions.cancel(subscription.id);
    cancelled.push(subscription.id);
  }
  return cancelled;
}
