import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
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
  const createOrg = async (key: string, members: Array<[userId: string, role: string]>) => {
    const id = `hi-${key}-${run}`;
    await client.organization.create({ data: { id, name: key, slug: id } });
    orgIds.push(id);
    const memberIds: string[] = [];
    for (const [userId, role] of members) memberIds.push(await addMember(id, userId, role));
    return { id, memberIds };
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

  describe('removing a member', () => {
    it('gives someone removed from their only space a household of their own at once', async () => {
      const owner = await createUser('remover');
      const removed = await createUser('removed');
      const space = await createOrg('remove-space', [
        [owner, 'owner'],
        [removed, 'member'],
      ]);
      expect(await lib.removeMember(owner, space.memberIds[1])).toMatchObject({ ok: true });
      expect(await membershipsOf(removed)).toEqual([
        { organizationId: `household-${removed}`, role: 'owner' },
      ]);
    });

    it('gives a removed former owner a new household, not the one they handed over', async () => {
      const former = await createUser('handover');
      const newOwner = await createUser('new-owner');
      await household.ensurePersonalHousehold({ id: former, name: 'Handover' });
      const handedOver = `household-${former}`;
      const newOwnerMember = await addMember(handedOver, newOwner, 'member');
      expect(await lib.transferOwnership(former, newOwnerMember)).toMatchObject({ ok: true });
      const formerMember = await client.member.findFirstOrThrow({
        where: { userId: former, organizationId: handedOver },
      });
      expect(await lib.removeMember(newOwner, formerMember.id)).toMatchObject({ ok: true });

      const memberships = await membershipsOf(former);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({ role: 'owner' });
      expect(memberships[0].organizationId).not.toBe(handedOver);
      // The next page load finds that household and changes nothing.
      await household.ensurePersonalHousehold({ id: former, name: 'Handover' });
      expect(await membershipsOf(former)).toEqual(memberships);
      expect(await ownersOf(handedOver)).toEqual([newOwner]);
      expect(
        (await client.member.findMany({ where: { organizationId: handedOver } })).map((m) => m.userId)
      ).toEqual([newOwner]);
    });

    it('leaves people who keep another space alone', async () => {
      const owner = await createUser('keeper-owner');
      const keeper = await createUser('keeper');
      const space = await createOrg('keep-space', [
        [owner, 'owner'],
        [keeper, 'member'],
      ]);
      const other = await createOrg('keep-other', [[keeper, 'owner']]);
      expect(await lib.removeMember(owner, space.memberIds[1])).toMatchObject({ ok: true });
      expect(await membershipsOf(keeper)).toEqual([{ organizationId: other.id, role: 'owner' }]);
    });
  });

  describe('one membership per space', () => {
    const invite = async (organizationId: string, inviter: string, invitee: string, key: string) => {
      const id = `hi-inv-${key}-${run}`;
      await client.invitation.create({
        data: {
          id,
          organizationId,
          email: `${invitee}@example.com`,
          role: 'member',
          status: 'pending',
          expiresAt: new Date('2099-01-01'),
          inviterId: inviter,
        },
      });
      return id;
    };

    it('accepting two invitations to the same space at once adds one membership', async () => {
      const inviter = await createUser('inviter');
      const invitee = await createUser('invitee');
      const space = await createOrg('invite-space', [[inviter, 'owner']]);
      const first = await invite(space.id, inviter, invitee, 'first');
      const second = await invite(space.id, inviter, invitee, 'second');

      const results = await Promise.all([
        lib.acceptInvitation(invitee, first),
        lib.acceptInvitation(invitee, second),
      ]);
      expect(results).toEqual([
        { ok: true, data: { organizationId: space.id } },
        { ok: true, data: { organizationId: space.id } },
      ]);
      expect(await client.member.count({ where: { userId: invitee, organizationId: space.id } })).toBe(1);
      // A second row cannot be written any other way either.
      await expect(
        client.member.create({
          data: { id: `hi-dupe-${run}`, organizationId: space.id, userId: invitee, role: 'viewer' },
        })
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('the migration keeps the oldest row of each pair, with the strongest role', async () => {
      const migration = readFileSync(
        path.join(process.cwd(), 'prisma/migrations/20261120170000_member_unique_per_org/migration.sql'),
        'utf8'
      );
      const a = await createUser('dupe-a');
      const b = await createUser('dupe-b');
      const space = await createOrg('dupe-space', []);
      const at = (minute: number) => new Date(Date.UTC(2025, 0, 1, 0, minute));
      const rows: Array<[id: string, userId: string, role: string, createdAt: Date]> = [
        [`hi-dupe-a1-${run}`, a, 'member', at(1)],
        [`hi-dupe-a2-${run}`, a, 'owner', at(2)],
        [`hi-dupe-a3-${run}`, a, 'viewer', at(3)],
        [`hi-dupe-b1-${run}`, b, 'viewer', at(4)],
        [`hi-dupe-b2-${run}`, b, 'Admin, member', at(5)],
      ];
      const conn = await pool.connect();
      try {
        await conn.query('BEGIN');
        // Recreate the state before the migration inside a transaction that is rolled back.
        await conn.query('DROP INDEX "member_organizationId_userId_key"');
        for (const [id, userId, role, createdAt] of rows) {
          await conn.query(
            'INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
            [id, space.id, userId, role, createdAt]
          );
        }
        await conn.query(migration);
        const { rows: kept } = await conn.query(
          'SELECT id, "userId", role FROM "member" WHERE "organizationId" = $1 ORDER BY "createdAt"',
          [space.id]
        );
        expect(kept).toEqual([
          { id: `hi-dupe-a1-${run}`, userId: a, role: 'owner' },
          { id: `hi-dupe-b1-${run}`, userId: b, role: 'Admin, member' },
        ]);
      } finally {
        await conn.query('ROLLBACK');
        conn.release();
      }
    });
  });
});
