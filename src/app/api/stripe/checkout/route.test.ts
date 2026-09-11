import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@/lib/session', () => ({
  getServerSession: vi
    .fn()
    .mockResolvedValue({ user: { id: 'checkout-user' } }),
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: mocks.create } };
  },
}));
import { POST } from './route';

afterEach(() => vi.unstubAllEnvs());
it('stores the user on both Checkout and the resulting subscription', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture');
  vi.stubEnv('STRIPE_PRICE_ID_PRO', 'price_fixture');
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
  mocks.create.mockResolvedValue({
    url: 'https://checkout.stripe.com/fixture',
  });
  expect((await POST()).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      client_reference_id: 'checkout-user',
      metadata: { userId: 'checkout-user' },
      subscription_data: { metadata: { userId: 'checkout-user' } },
    })
  );
});
