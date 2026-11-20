import { describe, expect, it } from 'vitest';
import {
  isPaymentRetryStatus,
  isPremiumSubscriptionStatus,
} from '@/lib/stripe';

describe('isPremiumSubscriptionStatus', () => {
  it.each(['active', 'trialing', 'past_due'])('%s grants premium', (status) => {
    expect(isPremiumSubscriptionStatus(status)).toBe(true);
  });

  it.each(['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'])(
    '%s does not grant premium',
    (status) => {
      expect(isPremiumSubscriptionStatus(status)).toBe(false);
    }
  );
});

describe('isPaymentRetryStatus', () => {
  it('is true only while Stripe retries a failed payment', () => {
    expect(isPaymentRetryStatus('past_due')).toBe(true);
    for (const status of ['active', 'trialing', 'unpaid', 'canceled']) {
      expect(isPaymentRetryStatus(status)).toBe(false);
    }
  });
});
