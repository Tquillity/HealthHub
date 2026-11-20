import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const session = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({ requireSessionUserId: session }));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

describe.skipIf(!isolated)('generateMealPlan against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  // A cuisine only this run's recipes use keeps seeded recipes out of the pool
  const cuisine = `bio-${run}`;
  const me = { id: `bio-me-${run}`, email: `bio-me-${run}@example.com` };
  const housemate = { id: `bio-mate-${run}`, email: `bio-mate-${run}@example.com` };
  const household = `bio-household-${run}`;
  let pool: Pool;
  let client: PrismaClient;
  let generateMealPlan: (typeof import('./meal-auto-fill'))['generateMealPlan'];

  const signIn = (userId: string) => session.mockResolvedValue({ ok: true, userId });
  const savedChoice = async (userId: string) =>
    (
      await client.user.findUniqueOrThrow({
        where: { id: userId },
        select: { alignMealsWithCycle: true },
      })
    ).alignMealsWithCycle;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    ({ generateMealPlan } = await import('./meal-auto-fill'));

    await client.user.create({
      data: {
        ...me,
        name: 'Me',
        enableCycleTracking: true,
        cycleLength: 28,
        // The weeks of 2027-01-04 and 2027-01-11 are days 16-29: luteal, then a new cycle
        lastPeriodDate: new Date(Date.UTC(2026, 11, 20)),
      },
    });
    await client.user.create({
      data: {
        ...housemate,
        name: 'Housemate',
        enableCycleTracking: true,
        cycleLength: 28,
        // Menstrual and follicular in the week of 2027-01-04
        lastPeriodDate: new Date(Date.UTC(2027, 0, 3)),
      },
    });
    await client.organization.create({
      data: { id: household, name: 'Bio home', slug: household },
    });
    await client.member.createMany({
      data: [
        { id: `bm1-${run}`, organizationId: household, userId: me.id, role: 'owner' },
        { id: `bm2-${run}`, organizationId: household, userId: housemate.id, role: 'member' },
      ],
    });
    const recipe = (name: string, phaseTags: string[], nutrientHighlights: string[]) => ({
      id: `bio-${name}-${run}`,
      name,
      cuisine,
      servings: 2,
      organizationId: household,
      phaseTags,
      nutrientHighlights,
    });
    await client.recipe.createMany({
      data: [
        recipe('luteal-bowl', ['luteal'], ['magnesium', 'complex-carbs']),
        recipe('menstrual-stew', ['menstrual'], ['iron']),
        recipe('plain-toast', [], []),
      ],
    });
  });

  afterAll(async () => {
    await client.organization.deleteMany({ where: { id: household } });
    await client.recipe.deleteMany({ where: { cuisine } });
    await client.user.deleteMany({ where: { id: { in: [me.id, housemate.id] } } });
    await client.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    session.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it("explains the plan with the generating person's own phases", async () => {
    signIn(me.id);
    const result = await generateMealPlan(household, {
      weekStart: '2027-01-04',
      cuisinePreferences: [cuisine],
      alignWithCycle: true,
    });

    expect(result.success).toBe(true);
    expect(result.data?.generated).toBe(21);
    // Only the luteal week of the viewer, nothing from the housemate's cycle
    expect(result.data?.cycleAlignment).toEqual([
      expect.objectContaining({
        phase: 'luteal',
        dateKeys: [
          '2027-01-04',
          '2027-01-05',
          '2027-01-06',
          '2027-01-07',
          '2027-01-08',
          '2027-01-09',
          '2027-01-10',
        ],
        plannedMeals: 21,
        hasMatchingRecipes: true,
      }),
    ]);
    const stored = await client.mealPlanItem.count({
      where: { mealPlan: { organizationId: household } },
    });
    expect(stored).toBe(21);
    expect(await savedChoice(me.id)).toBe(true);
  });

  it('saves the toggle and plans without the cycle when it is off', async () => {
    signIn(me.id);
    const result = await generateMealPlan(household, {
      weekStart: '2027-01-11',
      cuisinePreferences: [cuisine],
      alignWithCycle: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ generated: 21, cycleAlignment: null });
    expect(await savedChoice(me.id)).toBe(false);

    // Without the toggle in the request, the saved choice applies
    const again = await generateMealPlan(household, {
      weekStart: '2027-01-18',
      cuisinePreferences: [cuisine],
    });
    expect(again.data?.cycleAlignment).toBeNull();
    expect(await savedChoice(me.id)).toBe(false);
  });

  it("uses the housemate's own estimate when they generate", async () => {
    signIn(housemate.id);
    const result = await generateMealPlan(household, {
      weekStart: '2027-01-25',
      cuisinePreferences: [cuisine],
      alignWithCycle: true,
    });

    expect(result.success).toBe(true);
    // 2027-01-25..31 are days 23-29 of the housemate's cycle: luteal, then menstrual
    expect(result.data?.cycleAlignment?.map((summary) => summary.phase)).toEqual([
      'luteal',
      'menstrual',
    ]);
    expect(await savedChoice(me.id)).toBe(false);
  });

  it('ignores the toggle for people without a cycle estimate', async () => {
    await client.user.update({
      where: { id: housemate.id },
      data: { enableCycleTracking: false },
    });
    signIn(housemate.id);
    const result = await generateMealPlan(household, {
      weekStart: '2027-02-01',
      cuisinePreferences: [cuisine],
      alignWithCycle: true,
    });
    expect(result.success).toBe(true);
    expect(result.data?.cycleAlignment).toBeNull();
  });

  it('rejects invalid input before checking the session', async () => {
    const result = await generateMealPlan(household, {
      weekStart: '2027-02-30',
      cuisinePreferences: [cuisine],
    });
    expect(result.success).toBe(false);
    expect(session).not.toHaveBeenCalled();

    const tooMany = await generateMealPlan(household, {
      weekStart: '2027-02-01',
      avoidIngredients: Array.from({ length: 51 }, (_, index) => `item-${index}`),
    });
    expect(tooMany.success).toBe(false);
    expect(session).not.toHaveBeenCalled();
  });
});
