/**
 * Stripe client helpers (spike). No checkout or DB writes until production gate.
 */

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
    process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

/**
 * Premium is derived from the Stripe subscription status. `active` and
 * `trialing` grant access, and so does `past_due`: that is the grace period
 * while Stripe retries a failed payment and emails the customer. Pro ends when
 * Stripe gives up and moves the subscription to `canceled` or `unpaid`
 * (Stripe Dashboard → Billing → Revenue recovery sets how long that takes).
 * `incomplete`, `incomplete_expired` and `paused` never grant access.
 */
export function isPremiumSubscriptionStatus(status: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

/** A payment failed and Stripe is still retrying: the user should update their card. */
export function isPaymentRetryStatus(status: string): boolean {
  return status === 'past_due';
}

/** Cache tag for a user's billing notice; the webhook refreshes it on subscription changes. */
export function billingNoticeTag(userId: string): string {
  return `billing-notice-${userId}`;
}

/** User ids are interpolated into Stripe search queries, so only allow id-safe characters. */
export function isSafeStripeSearchId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

/** Stripe search query for subscriptions created for a HealthHub user (checkout sets this metadata). */
export function subscriptionsForUserQuery(userId: string): string {
  return `metadata['userId']:'${userId}'`;
}
