import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

// Membership integrity never depends on the active organization, but the module graph reads cookies.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

/**
 * Membership and ownership integrity under concurrency: nobody is put back into a household
 * they left, every organization keeps an owner, and shares never outlive a membership.
 */
describe.skipIf(!isolated)('household integrity against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const orgIds: string[] = [];

  let pool: Pool;
  let client: PrismaClient;
  let household: typeof import('./household');
  let lib: typeof import('./household-management');

  let seq = 0;
  const createUser = async (key: string) => {
    const id = `hi-${key}-${run}`;
    await client.user.create({
      data: { id, email: `${id}@example.com`, name: `${key[0].toUpperCase()}${key.slice(1)} ${run}` },
    });
    userIds.push(id);
    return id;
  };
  const addMember = async (organizationId: string, userId: string, role: string) => {
    seq += 1;
    const id = `hi-m${seq}-${run}`;
    await client.member.create({
      data: { id, organizationId, userId, role, createdAt: new Date(Date.UTC(2026, 0, 1, 0, seq)) },
    });
    return id;
  };
  const membershipsOf = (userId: string) =>
    client.member.findMany({
      where: { userId },
      select: { organizationId: true, role: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  const ownersOf = async (organizationId: string) => {
    const owners = await client.member.findMany({
      where: { organizationId, role: 'owner' },
      select: { userId: true },
      orderBy: { userId: 'asc' },
    });
    return owners.map((m) => m.userId);
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    household = await import('./household');
    lib = await import('./household-management');
  });

  afterAll(async () => {
    // Personal households created along the way belong to the test users.
    await client.organization.deleteMany({
      where: { OR: [{ id: { in: orgIds } }, { members: { some: { userId: { in: userIds } } } }] },
    });
    await client.organization.deleteMany({
      where: { id: { in: userIds.map((id) => `household-${id}`) } },
    });
    await client.user.deleteMany({ where: { id: { in: userIds } } });
    await client.$disconnect();
    await pool.end();
  });

  describe('personal household', () => {
    it('creates one household with the fixed id for a first sign-up, even when called at once', async () => {
      const newcomer = await createUser('newcomer');
      await Promise.all(
        Array.from({ length: 5 }, () => household.ensurePersonalHousehold({ id: newcomer, name: 'New' }))
      );
      expect(await membershipsOf(newcomer)).toEqual([
        { organizationId: `household-${newcomer}`, role: 'owner' },
      ]);
    });

    it('never puts a former owner back into the household they handed over', async () => {
      const former = await createUser('former');
      const partner = await createUser('partner');
      await household.ensurePersonalHousehold({ id: former, name: 'Former' });
      const handedOver = `household-${former}`;
      await addMember(handedOver, partner, 'member');
      const partnerMember = await client.member.findFirstOrThrow({
        where: { userId: partner, organizationId: handedOver },
      });
      expect(await lib.transferOwnership(former, partnerMember.id)).toMatchObject({ ok: true });
      // However the last membership went (removal, two leaves at once), none is left now.
      await client.member.deleteMany({ where: { userId: former } });

      await Promise.all(
        Array.from({ length: 3 }, () => household.ensurePersonalHousehold({ id: former, name: 'Former' }))
      );

      const memberships = await membershipsOf(former);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ role: 'owner' });
      expect(memberships[0].organizationId).not.toBe(handedOver);
      expect(memberships[0].organizationId).toMatch(/^org_[A-Za-z0-9_-]{22}$/);
      const fresh = await client.organization.findUniqueOrThrow({
        where: { id: memberships[0].organizationId },
        include: { members: true },
      });
      expect(fresh.members.map((m) => m.userId)).toEqual([former]);
      expect(fresh.name).toBe("Former's Household");
      expect(await ownersOf(handedOver)).toEqual([partner]);
    });

    it('does not reuse an old household that has nobody in it either', async () => {
      const returning = await createUser('returning');
      await client.organization.create({
        data: { id: `household-${returning}`, name: 'Old data', slug: `household-${returning}` },
      });
      await household.ensurePersonalHousehold({ id: returning, name: null });
      const memberships = await membershipsOf(returning);
      expect(memberships).toHaveLength(1);
      expect(memberships[0].organizationId).not.toBe(`household-${returning}`);
      expect(
        (await client.organization.findUniqueOrThrow({ where: { id: memberships[0].organizationId } })).name
      ).toBe('My Household');
    });
  });
});
