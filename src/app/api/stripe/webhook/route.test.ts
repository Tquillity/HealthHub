import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const mocks = vi.hoisted(() => ({
  process: vi.fn(),
  subscriptions: vi.fn(),
  search: vi.fn(),
  list: vi.fn(),
}));
vi.mock('@/lib/stripe-webhook', () => ({ processStripeEvent: mocks.process }));
vi.mock('stripe', async (importOriginal) => {
  const { default: StripeClient } =
    await importOriginal<typeof import('stripe')>();
  return {
    default: class extends StripeClient {
      constructor(key: string) {
        super(key);
        this.subscriptions.retrieve = mocks.subscriptions;
        this.subscriptions.search = mocks.search;
        this.checkout.sessions.list = mocks.list;
      }
    },
  };
});
import { POST } from './route';

const secret = 'whsec_fixture';
function request(type: string, object: object, signatureValid = true) {
  const payload = JSON.stringify({ id: 'evt_fixture', type, data: { object } });
  const client = new Stripe('sk_test_fixture');
  const signature = client.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: { 'stripe-signature': signatureValid ? signature : 'invalid' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret);
  mocks.process.mockResolvedValue({ duplicate: false });
  mocks.subscriptions.mockResolvedValue({ status: 'active' });
  mocks.search.mockResolvedValue({ data: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe('signed Stripe webhooks', () => {
  it('rejects an invalid signature before writing to the database', async () => {
    expect(
      (await POST(request('customer.subscription.deleted', {}, false))).status
    ).toBe(400);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('revokes premium using the subscription metadata', async () => {
    const response = await POST(
      request('customer.subscription.deleted', {
        id: 'sub_fixture',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_fixture' }),
      {
        userId: 'user_fixture',
        isPremium: false,
      }
    );
  });

  it('recovers legacy subscriptions through the original checkout metadata', async () => {
    mocks.list.mockResolvedValue({
      data: [{ metadata: { userId: 'legacy_user' } }],
    });
    const response = await POST(
      request('customer.subscription.deleted', {
        id: 'sub_legacy',
        metadata: {},
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({
      subscription: 'sub_legacy',
      limit: 1,
    });
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), {
      userId: 'legacy_user',
      isPremium: false,
    });
  });

  it('returns a retryable failure without claiming an unmapped cancellation', async () => {
    mocks.list.mockResolvedValue({ data: [] });
    expect(
      (
        await POST(
          request('customer.subscription.deleted', {
            id: 'sub_missing',
            metadata: {},
          })
        )
      ).status
    ).toBe(500);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('does not reactivate a cancellation when checkout completion arrives late', async () => {
    mocks.subscriptions.mockResolvedValue({ status: 'canceled' });
    const response = await POST(
      request('checkout.session.completed', {
        mode: 'subscription',
        payment_status: 'paid',
        subscription: 'sub_canceled',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user_fixture',
      isPremium: false,
    });
  });

  it.each([
    ['active', true],
    ['trialing', true],
    ['past_due', false],
    ['unpaid', false],
    ['canceled', false],
    ['incomplete_expired', false],
    ['paused', false],
  ])(
    'syncs premium from the current status on subscription update (%s)',
    async (status, isPremium) => {
      mocks.subscriptions.mockResolvedValue({ status });
      const response = await POST(
        request('customer.subscription.updated', {
          id: 'sub_fixture',
          status: 'active',
          metadata: { userId: 'user_fixture' },
        })
      );
      expect(response.status).toBe(200);
      expect(mocks.subscriptions).toHaveBeenCalledWith('sub_fixture');
      expect(mocks.process).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'evt_fixture' }),
        { userId: 'user_fixture', isPremium }
      );
    }
  );

  it('maps legacy subscription updates through the original checkout', async () => {
    mocks.subscriptions.mockResolvedValue({ status: 'past_due' });
    mocks.list.mockResolvedValue({
      data: [{ metadata: {}, client_reference_id: 'legacy_user' }],
    });
    const response = await POST(
      request('customer.subscription.updated', {
        id: 'sub_legacy',
        metadata: {},
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), {
      userId: 'legacy_user',
      isPremium: false,
    });
  });

  it('acknowledges an unmapped subscription update without changing any user', async () => {
    mocks.list.mockResolvedValue({ data: [] });
    const response = await POST(
      request('customer.subscription.updated', {
        id: 'sub_missing',
        metadata: {},
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('keeps premium when a lapsed subscription is replaced by a live one', async () => {
    mocks.subscriptions.mockResolvedValue({ status: 'unpaid' });
    mocks.search.mockResolvedValue({
      data: [
        { id: 'sub_old', status: 'unpaid' },
        { id: 'sub_new', status: 'active' },
      ],
    });
    const response = await POST(
      request('customer.subscription.updated', {
        id: 'sub_old',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('keeps premium when an old subscription is deleted but another is live', async () => {
    mocks.search.mockResolvedValue({
      data: [{ id: 'sub_new', status: 'trialing' }],
    });
    const response = await POST(
      request('customer.subscription.deleted', {
        id: 'sub_old',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('reports database failures as retryable processing errors', async () => {
    mocks.process.mockRejectedValueOnce(new Error('Database offline'));
    const response = await POST(
      request('customer.subscription.deleted', {
        id: 'sub_fixture',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Webhook processing failed',
    });
  });

  it('acknowledges duplicates without treating them as signature failures', async () => {
    mocks.process.mockResolvedValue({ duplicate: true });
    const response = await POST(
      request('customer.subscription.deleted', {
        id: 'sub_fixture',
        metadata: { userId: 'user_fixture' },
      })
    );
    expect(await response.json()).toEqual({ received: true, duplicate: true });
  });
});
