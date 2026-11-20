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
 * Premium is derived from the Stripe subscription status: only `active` and
 * `trialing` grant access. `past_due`, `unpaid`, `canceled`,
 * `incomplete_expired`, `paused` and `incomplete` do not.
 */
export function isPremiumSubscriptionStatus(status: string): boolean {
  return status === 'active' || status === 'trialing';
}

/** User ids are interpolated into Stripe search queries, so only allow id-safe characters. */
export function isSafeStripeSearchId(id: string): boolean {
  return /^[\w-]+$/.test(id);
}

/** Stripe search query for subscriptions created for a HealthHub user (checkout sets this metadata). */
export function subscriptionsForUserQuery(userId: string): string {
  return `metadata['userId']:'${userId}'`;
}
