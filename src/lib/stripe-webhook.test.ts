import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

describe.skipIf(!isolated)(
  'Stripe transaction against isolated PostgreSQL',
  () => {
    const userId = `stripe-test-${randomUUID()}`;
    const eventId = `evt-${randomUUID()}`;
    const failedEventId = `evt-${randomUUID()}`;
    let pool: Pool;
    let client: PrismaClient;
    let processStripeEvent: (typeof import('./stripe-webhook'))['processStripeEvent'];

    beforeAll(async () => {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      client = new PrismaClient({ adapter: new PrismaPg(pool) });
      ({ processStripeEvent } = await import('./stripe-webhook'));
      await client.user.create({
        data: {
          id: userId,
          name: 'Stripe test',
          email: `${userId}@example.com`,
        },
      });
    });

    afterAll(async () => {
      await client.stripeWebhookEvent.deleteMany({
        where: { eventId: { in: [eventId, failedEventId] } },
      });
      await client.user.delete({ where: { id: userId } });
      await client.$disconnect();
      await pool.end();
      const { prisma } = await import('./db');
      await prisma.$disconnect();
    });

    it('claims simultaneous duplicate events once and applies no later duplicate mutation', async () => {
      const event = { id: eventId, type: 'checkout.session.completed' };
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          processStripeEvent(event, { userId, isPremium: true })
        )
      );
      expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
      expect(
        await client.stripeWebhookEvent.count({ where: { eventId } })
      ).toBe(1);
      await processStripeEvent(event, { userId, isPremium: false });
      expect(
        (await client.user.findUniqueOrThrow({ where: { id: userId } }))
          .isPremium
      ).toBe(true);
    });

    it('rolls back the event claim when premium persistence fails', async () => {
      await expect(
        processStripeEvent(
          { id: failedEventId, type: 'customer.subscription.deleted' },
          { userId: 'missing-fixture-user', isPremium: false }
        )
      ).rejects.toThrow();
      expect(
        await client.stripeWebhookEvent.count({
          where: { eventId: failedEventId },
        })
      ).toBe(0);
    });
  }
);
