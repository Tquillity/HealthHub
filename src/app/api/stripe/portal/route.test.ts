import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  search: vi.fn(),
  portal: vi.fn(),
  invoice: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/db', () => ({ prisma: {} }));
vi.mock('next/cache', () => ({ unstable_cache: vi.fn() }));
vi.mock('stripe', () => ({
  default: class {
    subscriptions = { search: mocks.search };
    billingPortal = { sessions: { create: mocks.portal } };
    invoices = { retrieve: mocks.invoice };
  },
}));
import { POST } from './route';

const pastDue = {
  id: 'sub_fixture',
  status: 'past_due',
  customer: 'cus_fixture',
  latest_invoice: 'in_fixture',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_fixture');
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000/');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  mocks.session.mockResolvedValue({ user: { id: 'portal-user' } });
  mocks.search.mockResolvedValue({ data: [{ status: 'canceled' }, pastDue] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('rejects guests', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST()).status).toBe(401);
  expect(mocks.search).not.toHaveBeenCalled();
});

it('opens the billing portal for the customer of the past-due subscription', async () => {
  mocks.portal.mockResolvedValue({ url: 'https://billing.stripe.com/fixture' });
  const response = await POST();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    url: 'https://billing.stripe.com/fixture',
  });
  expect(mocks.search).toHaveBeenCalledWith({
    query: "metadata['userId']:'portal-user'",
    limit: 20,
  });
  expect(mocks.portal).toHaveBeenCalledWith({
    customer: 'cus_fixture',
    return_url: 'http://localhost:3000/dashboard',
  });
});

it('falls back to the unpaid invoice page when the portal is not set up', async () => {
  mocks.portal.mockRejectedValue(new Error('No configuration provided'));
  mocks.invoice.mockResolvedValue({
    hosted_invoice_url: 'https://invoice.stripe.com/fixture',
  });
  const response = await POST();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    url: 'https://invoice.stripe.com/fixture',
  });
  expect(mocks.invoice).toHaveBeenCalledWith('in_fixture');
});

it('returns 404 when no payment is being retried', async () => {
  mocks.search.mockResolvedValue({ data: [{ status: 'active' }] });
  expect((await POST()).status).toBe(404);
  expect(mocks.portal).not.toHaveBeenCalled();
});
