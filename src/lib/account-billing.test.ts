import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  cancelProSubscriptions,
  refundUnusedTime,
  type StripeClient,
} from './account-billing';

const PRO_PRICE = 'price_pro';
const user = { id: 'user_123', email: 'person@example.com' };

function sub(
  id: string,
  options: { status?: string; price?: string; userId?: string } = {}
): Stripe.Subscription {
  return {
    id,
    status: options.status ?? 'active',
    metadata: options.userId ? { userId: options.userId } : {},
    items: { data: [{ price: { id: options.price ?? PRO_PRICE } }] },
  } as unknown as Stripe.Subscription;
}

/** Stripe list and search results are async iterables (auto-pagination). */
function pages<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* items;
    },
  };
}

function fakeStripe(options: {
  searched?: Stripe.Subscription[];
  customers?: string[];
  byCustomer?: Record<string, Stripe.Subscription[]>;
}) {
  const cancel = vi.fn(async (id: string) => ({ id }));
  const search = vi.fn(() => pages(options.searched ?? []));
  const client = {
    subscriptions: {
      search,
      list: vi.fn((params: { customer: string }) =>
        pages(options.byCustomer?.[params.customer] ?? [])
      ),
      cancel,
    },
    customers: {
      list: vi.fn(() => pages((options.customers ?? []).map((id) => ({ id })))),
    },
  } as unknown as StripeClient;
  return { client, cancel, search };
}

describe('cancelProSubscriptions', () => {
  it('cancels subscriptions tagged with the user id', async () => {
    const { client, cancel, search } = fakeStripe({
      searched: [sub('sub_tagged', { userId: user.id })],
    });
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).resolves.toEqual(['sub_tagged']);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "metadata['userId']:'user_123'" })
    );
    expect(cancel).toHaveBeenCalledWith('sub_tagged');
  });

  it('ignores search hits whose metadata belongs to someone else', async () => {
    const { client, cancel } = fakeStripe({
      searched: [sub('sub_other', { userId: 'user_1234' })],
    });
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).resolves.toEqual([]);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels only Pro subscriptions found through the email', async () => {
    const { client, cancel } = fakeStripe({
      customers: ['cus_1'],
      byCustomer: {
        cus_1: [
          sub('sub_old_pro'),
          sub('sub_other_product', { price: 'price_other' }),
        ],
      },
    });
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).resolves.toEqual(['sub_old_pro']);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("never cancels another user's subscription that shares the email", async () => {
    const { client, cancel } = fakeStripe({
      customers: ['cus_1'],
      byCustomer: {
        cus_1: [sub('sub_someone_else', { userId: 'user_999' })],
      },
    });
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).resolves.toEqual([]);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('skips subscriptions that have already ended and de-duplicates', async () => {
    const tagged = sub('sub_both', { userId: user.id });
    const { client, cancel } = fakeStripe({
      searched: [
        tagged,
        sub('sub_ended', { userId: user.id, status: 'canceled' }),
      ],
      customers: ['cus_1'],
      byCustomer: { cus_1: [tagged] },
    });
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).resolves.toEqual(['sub_both']);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('does not look up by email without a Pro price configured', async () => {
    const { client } = fakeStripe({ customers: ['cus_1'] });
    await cancelProSubscriptions(user, client, undefined);
    expect(client.customers.list).not.toHaveBeenCalled();
  });

  it('never builds a search query from an unsafe user id', async () => {
    const { client, search } = fakeStripe({});
    await cancelProSubscriptions(
      { id: "x' OR status:'active", email: user.email },
      client,
      PRO_PRICE
    );
    expect(search).not.toHaveBeenCalled();
  });

  it('lets a Stripe failure through so the deletion stops', async () => {
    const { client, cancel } = fakeStripe({
      searched: [sub('sub_tagged', { userId: user.id })],
    });
    cancel.mockRejectedValueOnce(new Error('Stripe down'));
    await expect(
      cancelProSubscriptions(user, client, PRO_PRICE)
    ).rejects.toThrow('Stripe down');
  });
});

describe('refundUnusedTime', () => {
  const DAY = 86_400;
  const start = 1_800_000_000;
  const end = start + 30 * DAY;
  /** Ten days into a thirty-day period: two thirds unused. */
  const now = new Date((start + 10 * DAY) * 1000);

  function paidSub(overrides: Record<string, unknown> = {}) {
    return {
      id: 'sub_1',
      status: 'active',
      metadata: { userId: user.id },
      current_period_start: start,
      current_period_end: end,
      latest_invoice: 'in_1',
      ...overrides,
    } as unknown as Stripe.Subscription;
  }

  function refundStripe(options: {
    invoice?: Record<string, unknown>;
    refunds?: Array<Record<string, unknown>>;
  }) {
    const create = vi.fn(async () => ({ id: 're_new' }));
    const cancel = vi.fn(async (id: string) => ({ id }));
    const client = {
      subscriptions: { cancel, search: vi.fn(), list: vi.fn() },
      customers: { list: vi.fn() },
      invoices: {
        retrieve: vi.fn(async () => ({
          paid: true,
          amount_paid: 900,
          payment_intent: 'pi_1',
          ...options.invoice,
        })),
      },
      refunds: { list: vi.fn(() => pages(options.refunds ?? [])), create },
    } as unknown as StripeClient;
    return { client, create, cancel };
  }

  it('refunds the unused share of the period to the original payment', async () => {
    const { client, create } = refundStripe({});
    await expect(
      refundUnusedTime(paidSub(), user.id, client, now)
    ).resolves.toBe(600);
    expect(create).toHaveBeenCalledWith({
      payment_intent: 'pi_1',
      amount: 600,
      reason: 'requested_by_customer',
      metadata: { accountDeletionSubscription: 'sub_1', userId: user.id },
    });
  });

  it('does not refund twice when the deletion is retried', async () => {
    const { client, create } = refundStripe({
      refunds: [
        {
          amount: 600,
          status: 'succeeded',
          metadata: { accountDeletionSubscription: 'sub_1' },
        },
      ],
    });
    await expect(
      refundUnusedTime(paidSub(), user.id, client, now)
    ).resolves.toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('never refunds more than is left of the payment', async () => {
    const { client, create } = refundStripe({
      refunds: [{ amount: 500, status: 'succeeded', metadata: {} }],
    });
    await expect(
      refundUnusedTime(paidSub(), user.id, client, now)
    ).resolves.toBe(400);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 400 })
    );
  });

  it.each([
    ['a trial', paidSub({ status: 'trialing' }), {}],
    ['a past-due subscription', paidSub({ status: 'past_due' }), {}],
    [
      'a period that has ended',
      paidSub({ current_period_end: start + DAY }),
      {},
    ],
    ['an unpaid invoice', paidSub(), { paid: false }],
    [
      'an invoice paid from account credit',
      paidSub(),
      { payment_intent: null },
    ],
    ['a free invoice', paidSub(), { amount_paid: 0 }],
  ])('refunds nothing for %s', async (_name, subscription, invoice) => {
    const { client, create } = refundStripe({ invoice });
    await expect(
      refundUnusedTime(subscription, user.id, client, now)
    ).resolves.toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('refunds before cancelling, and keeps the subscription if the refund fails', async () => {
    const { client, create, cancel } = refundStripe({});
    (client.subscriptions.search as ReturnType<typeof vi.fn>).mockReturnValue(
      pages([paidSub()])
    );
    await expect(
      cancelProSubscriptions(user, client, undefined, now)
    ).resolves.toEqual(['sub_1']);
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      cancel.mock.invocationCallOrder[0]
    );

    create.mockRejectedValueOnce(new Error('Stripe down'));
    cancel.mockClear();
    await expect(
      cancelProSubscriptions(user, client, undefined, now)
    ).rejects.toThrow('Stripe down');
    expect(cancel).not.toHaveBeenCalled();
  });
});
