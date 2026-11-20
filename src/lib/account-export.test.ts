import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { encrypt, encryptArray } from './encryption';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

describe.skipIf(!isolated)('account export against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const me = { id: `exp-me-${run}`, email: `me-${run}@example.com` };
  const housemate = { id: `exp-mate-${run}`, email: `mate-${run}@example.com` };
  const household = `exp-household-${run}`;
  const collective = `exp-collective-${run}`;
  let pool: Pool;
  let client: PrismaClient;
  let buildAccountExport: (typeof import('./account-export'))['buildAccountExport'];

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    ({ buildAccountExport } = await import('./account-export'));

    await client.user.create({
      data: {
        ...me,
        name: 'Me',
        lastPeriodDate: new Date('2026-03-01T00:00:00Z'),
      },
    });
    await client.user.create({ data: { ...housemate, name: 'Housemate' } });
    await client.account.create({
      data: {
        id: `acc-${run}`,
        userId: me.id,
        accountId: me.id,
        providerId: 'credential',
        password: 'secret-password-hash',
        accessToken: 'secret-access-token',
      },
    });
    await client.session.create({
      data: {
        id: `ses-${run}`,
        userId: me.id,
        token: `secret-session-token-${run}`,
        expiresAt: new Date('2099-01-01'),
        userAgent: 'Test browser',
      },
    });
    await client.organization.createMany({
      data: [
        { id: household, name: 'Our home', slug: household },
        { id: collective, name: 'Garden collective', slug: collective, type: 'COLLECTIVE' },
      ],
    });
    await client.member.createMany({
      data: [
        {
          id: `m1-${run}`,
          organizationId: household,
          userId: me.id,
          role: 'owner',
        },
        {
          id: `m2-${run}`,
          organizationId: household,
          userId: housemate.id,
          role: 'member',
        },
        {
          id: `m3-${run}`,
          organizationId: collective,
          userId: me.id,
          role: 'viewer',
          createdAt: new Date('2099-01-01T00:00:00Z'),
        },
      ],
    });
    await client.recipe.create({
      data: {
        id: `r-${run}`,
        name: 'Porridge',
        organizationId: household,
        ingredients: { create: [{ name: 'Oats', quantity: 1, unit: 'cup' }] },
        instructions: { create: [{ stepNumber: 1, text: 'Cook' }] },
      },
    });
    await client.journalEntry.create({
      data: {
        userId: me.id,
        date: new Date('2026-03-02T00:00:00Z'),
        mood: 8,
        notes: encrypt('Felt great'),
        gratitudeEntries: encryptArray(['Sunshine']) ?? [],
      },
    });
    await client.journalEntry.create({
      data: {
        userId: me.id,
        date: new Date('2026-03-03T00:00:00Z'),
        notes: encrypt('Shared with home'),
        visibility: 'ORGANIZATION',
        sharedOrganizationId: household,
      },
    });
  });

  afterAll(async () => {
    await client.organization.deleteMany({ where: { id: { in: [household, collective] } } });
    await client.recipe.deleteMany({ where: { id: `r-${run}` } });
    await client.user.deleteMany({
      where: { id: { in: [me.id, housemate.id] } },
    });
    await client.$disconnect();
    await pool.end();
  });

  it("exports the user's data with journal text decrypted", async () => {
    const data = await buildAccountExport(me.id);

    expect(data.profile).toMatchObject({
      email: me.email,
      lastPeriodDate: '2026-03-01',
    });
    expect(data.signInMethods).toEqual([
      { provider: 'credential', addedAt: expect.any(Date) },
    ]);
    expect(data.sessions).toEqual([
      expect.objectContaining({ userAgent: 'Test browser' }),
    ]);
    expect(data.journalEntries).toEqual([
      expect.objectContaining({
        date: '2026-03-02',
        mood: 8,
        notes: 'Felt great',
        gratitudeEntries: ['Sunshine'],
        visibility: 'PRIVATE',
        sharedWith: null,
      }),
      expect.objectContaining({
        date: '2026-03-03',
        notes: 'Shared with home',
        visibility: 'ORGANIZATION',
        sharedWith: { id: household, name: 'Our home' },
      }),
    ]);

    expect(data.households).toHaveLength(2);
    const [home, garden] = data.households;
    expect(home).toMatchObject({
      name: 'Our home',
      type: 'HOUSEHOLD',
      yourRole: 'owner',
      memberCount: 2,
    });
    expect(garden).toMatchObject({
      name: 'Garden collective',
      type: 'COLLECTIVE',
      yourRole: 'viewer',
      memberCount: 1,
      recipes: [],
    });
    expect(home.recipes).toEqual([
      expect.objectContaining({
        name: 'Porridge',
        ingredients: [expect.objectContaining({ name: 'Oats' })],
        instructions: [expect.objectContaining({ text: 'Cook' })],
      }),
    ]);
  });

  it('leaves out secrets and other people', async () => {
    const json = JSON.stringify(await buildAccountExport(me.id));
    expect(json).not.toContain('secret-password-hash');
    expect(json).not.toContain('secret-access-token');
    expect(json).not.toContain('secret-session-token');
    expect(json).not.toContain(housemate.email);
    expect(json).not.toContain(housemate.id);
  });
});
