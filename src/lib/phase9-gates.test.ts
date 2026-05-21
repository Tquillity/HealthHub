import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isAdSenseEnabled } from '@/lib/adsense';
import { isLegalReviewApproved, getLegalReviewVersion } from '@/lib/legal/review';
import { isStripeConfigured } from '@/lib/stripe';

describe('phase 9 feature gates', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('isLegalReviewApproved is false without LEGAL_REVIEW_APPROVED', () => {
    delete process.env.LEGAL_REVIEW_APPROVED;
    expect(isLegalReviewApproved()).toBe(false);
  });

  it('isLegalReviewApproved is true when env set', () => {
    process.env.LEGAL_REVIEW_APPROVED = 'true';
    expect(isLegalReviewApproved()).toBe(true);
  });

  it('getLegalReviewVersion returns a non-empty string', () => {
    expect(getLegalReviewVersion().length).toBeGreaterThan(0);
  });

  it('isAdSenseEnabled requires client id and flag', () => {
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = 'ca-pub-test';
    expect(isAdSenseEnabled()).toBe(true);
  });

  it('isAdSenseEnabled is false when disabled', () => {
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'false';
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT = 'ca-pub-test';
    expect(isAdSenseEnabled()).toBe(false);
  });

  it('isStripeConfigured requires secret and webhook', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    expect(isStripeConfigured()).toBe(true);
  });
});
