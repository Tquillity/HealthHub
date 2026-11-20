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

describe.skipIf(!isolated)('dashboard data against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const member = { id: `dash-member-${run}`, email: `dash-member-${run}@example.com` };
  const newcomer = { id: `dash-new-${run}`, email: `dash-new-${run}@example.com` };
  const household = `dash-household-${run}`;
  const otherHousehold = `dash-other-${run}`;
  const routineIds = Array.from({ length: 7 }, (_, index) => `dash-routine-${index}-${run}`);
  const otherRoutineId = `dash-other-routine-${run}`;
  const recipeIds = [`dash-recipe-${run}`, `dash-other-recipe-${run}`];
  let pool: Pool;
  let client: PrismaClient;
  let data: typeof import('./dashboard-data');

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    data = await import('./dashboard-data');

    for (const user of [member, newcomer]) {
      await client.user.create({ data: { ...user, name: user.id } });
    }
    for (const id of [household, otherHousehold]) {
      await client.organization.create({ data: { id, name: id, slug: id } });
    }
    await client.member.create({
      data: { id: `dash-m-${run}`, organizationId: household, userId: member.id, role: 'owner' },
    });

    // Seven household routines, created a minute apart so "recent" has a fixed order, and one
    // routine from another household that must never show up.
    const base = Date.now() + 60 * 60_000;
    for (const [index, id] of routineIds.entries()) {
      await client.routine.create({
        data: {
          id,
          name: `Household routine ${index}`,
          organizationId: household,
          createdAt: new Date(base + index * 60_000),
        },
      });
    }
    await client.routine.create({
      data: {
        id: otherRoutineId,
        name: 'Other household routine',
        organizationId: otherHousehold,
        createdAt: new Date(base + 60 * 60_000),
      },
    });
    await client.recipe.createMany({
      data: [
        { id: recipeIds[0], name: 'Household recipe', organizationId: household },
        { id: recipeIds[1], name: 'Other household recipe', organizationId: otherHousehold },
      ],
    });
  });

  afterAll(async () => {
    await client.routine.deleteMany({ where: { id: { in: [...routineIds, otherRoutineId] } } });
    await client.recipe.deleteMany({ where: { id: { in: recipeIds } } });
    await client.organization.deleteMany({ where: { id: { in: [household, otherHousehold] } } });
    await client.user.deleteMany({ where: { id: { in: [member.id, newcomer.id] } } });
    await client.$disconnect();
    await pool.end();
  });

  it('counts the shared catalog plus the household, never another household', async () => {
    const [systemRoutines, systemRecipes] = await Promise.all([
      client.routine.count({ where: { isSystem: true } }),
      client.recipe.count({ where: { isSystem: true } }),
    ]);

    await expect(data.getDashboardStats(member.id)).resolves.toEqual({
      routinesCount: systemRoutines + routineIds.length,
      recipesCount: systemRecipes + 1,
    });
  });

  it('lists the newest routines of the household only', async () => {
    const routines = await data.getRecentDashboardRoutines(member.id);

    expect(routines.map((routine) => routine.id)).toEqual(
      [...routineIds].reverse().slice(0, data.RECENT_ROUTINES_LIMIT)
    );
  });

  it('returns nothing for a user without a household yet', async () => {
    await expect(data.getDashboardStats(newcomer.id)).resolves.toBeNull();
    await expect(data.getRecentDashboardRoutines(newcomer.id)).resolves.toEqual([]);
  });
});
