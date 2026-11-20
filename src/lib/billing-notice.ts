import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  billingNoticeTag,
  isPaymentRetryStatus,
  isSafeStripeSearchId,
  isStripeConfigured,
  subscriptionsForUserQuery,
} from '@/lib/stripe';

export type BillingNotice = { paymentFailed: boolean };

const NO_NOTICE: BillingNotice = { paymentFailed: false };

/** How long a Stripe answer is reused; the webhook refreshes it sooner on a status change. */
const BILLING_NOTICE_REVALIDATE_SECONDS = 300;

/** The user's subscription that Stripe is still retrying a failed payment for, if any. */
export async function findPaymentRetrySubscription(userId: string) {
  if (!isSafeStripeSearchId(userId)) return null;
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const result = await stripe.subscriptions.search({
    query: subscriptionsForUserQuery(userId),
    limit: 20,
  });
  const subscription = result.data.find((sub) =>
    isPaymentRetryStatus(sub.status)
  );
  return subscription ? { stripe, subscription } : null;
}

const loadPaymentFailed = (userId: string) =>
  unstable_cache(
    async () => (await findPaymentRetrySubscription(userId)) !== null,
    ['billing-notice', userId],
    {
      revalidate: BILLING_NOTICE_REVALIDATE_SECONDS,
      tags: [billingNoticeTag(userId)],
    }
  )();

/**
 * Whether to show the "update your card" banner: the user still has Pro (grace period) but
 * their last payment failed. Only Pro users cost a Stripe lookup, and that lookup is cached.
 * Never throws: a billing lookup must not break the page it is shown on.
 */
export async function getBillingNotice(userId: string): Promise<BillingNotice> {
  if (!isStripeConfigured()) return NO_NOTICE;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPremium: true },
    });
    if (!user?.isPremium) return NO_NOTICE;
    return { paymentFailed: await loadPaymentFailed(userId) };
  } catch (error) {
    console.error('[HealthHub stripe] Billing notice lookup failed:', error);
    return NO_NOTICE;
  }
}
