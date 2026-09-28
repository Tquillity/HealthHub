import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  search: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  getServerSession: vi
    .fn()
    .mockResolvedValue({ user: { id: 'checkout-user' } }),
}));
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: mocks.create } };
    subscriptions = { search: mocks.search };
  },
}));
import { POST } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture');
  vi.stubEnv('STRIPE_PRICE_ID_PRO', 'price_fixture');
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000');
  mocks.findUnique.mockResolvedValue({ isPremium: false });
  mocks.search.mockResolvedValue({ data: [] });
});
afterEach(() => vi.unstubAllEnvs());

it('stores the user on both Checkout and the resulting subscription', async () => {
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

it('refuses a second checkout for an already-premium user', async () => {
  mocks.findUnique.mockResolvedValue({ isPremium: true });
  const response = await POST();
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: expect.stringContaining('already have an active'),
  });
  expect(mocks.findUnique).toHaveBeenCalledWith({
    where: { id: 'checkout-user' },
    select: { isPremium: true },
  });
  expect(mocks.create).not.toHaveBeenCalled();
});

it('refuses a second checkout while a lapsed subscription still exists', async () => {
  mocks.search.mockResolvedValue({
    data: [{ id: 'sub_old', status: 'past_due' }],
  });
  expect((await POST()).status).toBe(409);
  expect(mocks.create).not.toHaveBeenCalled();
});
