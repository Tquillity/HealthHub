import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { cancelProSubscriptions, type StripeClient } from './account-billing';

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
