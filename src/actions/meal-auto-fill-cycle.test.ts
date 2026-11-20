import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const session = vi.hoisted(() => vi.fn());
const cookies = vi.hoisted(() => vi.fn());

vi.mock('@/lib/session', () => ({ requireSessionUserId: session }));
// The action takes the space the page was rendered for; the active-space cookie must never
// be read (another tab may have switched it, and a DB test has no request scope).
vi.mock('next/headers', () => ({ cookies }));
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
  // Spaces where a plan aligned with one person's cycle is not allowed
  const otherSpaces = {
    COLLECTIVE: `bio-collective-${run}`,
    COMMUNITY: `bio-club-${run}`,
    CORPORATE: `bio-office-${run}`,
  } as const;
  const newcomer = { id: `bio-new-${run}`, email: `bio-new-${run}@example.com` };
  let pool: Pool;
  let client: PrismaClient;
  let generateMealPlan: (typeof import('./meal-auto-fill'))['generateMealPlan'];
  let CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR: string;

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
    ({ CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR } = await import('@/lib/meal-cycle-alignment'));

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
    // Created like sign-up does: no cycle alignment choice made yet
    await client.user.create({
      data: {
        ...newcomer,
        name: 'Newcomer',
        enableCycleTracking: true,
        cycleLength: 28,
        lastPeriodDate: new Date(Date.UTC(2026, 11, 20)),
      },
    });
    await client.organization.create({
      data: { id: household, name: 'Bio home', slug: household },
    });
    for (const [type, id] of Object.entries(otherSpaces)) {
      await client.organization.create({
        data: { id, name: `Bio ${type}`, slug: id, type: type as keyof typeof otherSpaces },
      });
    }
    await client.member.createMany({
      data: [
        { id: `bm1-${run}`, organizationId: household, userId: me.id, role: 'owner' },
        { id: `bm2-${run}`, organizationId: household, userId: housemate.id, role: 'member' },
        { id: `bm3-${run}`, organizationId: household, userId: newcomer.id, role: 'member' },
        ...Object.values(otherSpaces).map((organizationId, index) => ({
          id: `bm-other-${index}-${run}`,
          organizationId,
          userId: me.id,
          role: 'member',
        })),
      ],
    });
    const recipe = (
      name: string,
      phaseTags: string[],
      nutrientHighlights: string[],
      organizationId = household
    ) => ({
      id: `bio-${name}-${organizationId}-${run}`,
      name,
      cuisine,
      servings: 2,
      organizationId,
      phaseTags,
      nutrientHighlights,
    });
    await client.recipe.createMany({
      data: [household, ...Object.values(otherSpaces)].flatMap((organizationId) => [
        recipe('luteal-bowl', ['luteal'], ['magnesium', 'complex-carbs'], organizationId),
        recipe('menstrual-stew', ['menstrual'], ['iron'], organizationId),
        recipe('plain-toast', [], [], organizationId),
      ]),
    });
  });

  afterAll(async () => {
    await client.organization.deleteMany({
      where: { id: { in: [household, ...Object.values(otherSpaces)] } },
    });
    await client.recipe.deleteMany({ where: { cuisine } });
    await client.user.deleteMany({
      where: { id: { in: [me.id, housemate.id, newcomer.id] } },
    });
    await client.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    session.mockReset();
    cookies.mockReset();
    cookies.mockRejectedValue(new Error('cookies() read in a space-scoped write'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    expect(cookies).not.toHaveBeenCalled();
  });

  it('starts with cycle alignment off: it is opt-in', async () => {
    expect(await savedChoice(newcomer.id)).toBe(false);

    signIn(newcomer.id);
    const result = await generateMealPlan(household, {
      weekStart: '2027-03-01',
      cuisinePreferences: [cuisine],
    });
    expect(result.success).toBe(true);
    expect(result.data?.cycleAlignment).toBeNull();
    expect(await savedChoice(newcomer.id)).toBe(false);
  });

  it.each(Object.entries(otherSpaces))(
    'refuses to align a %s plan with the cycle and writes nothing',
    async (_type, space) => {
      signIn(me.id);
      await client.user.update({ where: { id: me.id }, data: { alignMealsWithCycle: true } });

      const refused = await generateMealPlan(space, {
        weekStart: '2027-03-08',
        cuisinePreferences: [cuisine],
        alignWithCycle: true,
      });
      expect(refused).toEqual({
        success: false,
        error: CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR,
      });
      expect(
        await client.mealPlanItem.count({ where: { mealPlan: { organizationId: space } } })
      ).toBe(0);

      // The household choice saved earlier is not applied here
      const plain = await generateMealPlan(space, {
        weekStart: '2027-03-08',
        cuisinePreferences: [cuisine],
      });
      expect(plain.success).toBe(true);
      expect(plain.data).toEqual({ generated: 21, cycleAlignment: null });
      expect(await savedChoice(me.id)).toBe(true);
    }
  );

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
      where: {
        mealPlan: { organizationId: household },
        // Planned on the server's calendar: local midnight of each day of that week
        date: { gte: new Date(2027, 0, 4), lte: new Date(2027, 0, 10) },
      },
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
