import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  search: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));
// Run the cached function directly; caching itself is Next's job.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}));
vi.mock('stripe', () => ({
  default: class {
    subscriptions = { search: mocks.search };
  },
}));
import { getBillingNotice } from './billing-notice';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture');
  mocks.findUnique.mockResolvedValue({ isPremium: true });
  mocks.search.mockResolvedValue({ data: [{ status: 'past_due' }] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('flags a Pro user whose payment is being retried', async () => {
  expect(await getBillingNotice('user_fixture')).toEqual({
    paymentFailed: true,
  });
});

it('shows nothing for a Pro user in good standing', async () => {
  mocks.search.mockResolvedValue({ data: [{ status: 'active' }] });
  expect(await getBillingNotice('user_fixture')).toEqual({
    paymentFailed: false,
  });
});

it('does not ask Stripe about users without Pro', async () => {
  mocks.findUnique.mockResolvedValue({ isPremium: false });
  expect(await getBillingNotice('user_fixture')).toEqual({
    paymentFailed: false,
  });
  expect(mocks.search).not.toHaveBeenCalled();
});

it('does nothing when Stripe is not configured', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  expect(await getBillingNotice('user_fixture')).toEqual({
    paymentFailed: false,
  });
  expect(mocks.findUnique).not.toHaveBeenCalled();
});

it('never throws when Stripe fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.search.mockRejectedValue(new Error('Stripe is down'));
  expect(await getBillingNotice('user_fixture')).toEqual({
    paymentFailed: false,
  });
});
