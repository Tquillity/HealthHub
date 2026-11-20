import { describe, expect, it } from 'vitest';
import { isPremiumSubscriptionStatus } from '@/lib/stripe';

describe('isPremiumSubscriptionStatus', () => {
  it.each(['active', 'trialing'])('%s grants premium', (status) => {
    expect(isPremiumSubscriptionStatus(status)).toBe(true);
  });

  it.each([
    'past_due',
    'unpaid',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
  ])('%s does not grant premium', (status) => {
    expect(isPremiumSubscriptionStatus(status)).toBe(false);
  });
});
