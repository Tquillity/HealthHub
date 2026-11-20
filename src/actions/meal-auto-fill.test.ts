import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  writableMembershipIn: vi.fn(),
  visibilityFilter: vi.fn(),
  userFindUnique: vi.fn(),
  planFindFirst: vi.fn(),
  planCreate: vi.fn(),
  recipeFindMany: vi.fn(),
  itemCreateMany: vi.fn(),
}));

// The plan is filled in the space the page showed; the cookie (another tab) is never consulted.
vi.mock('@/lib/active-organization', () => ({
  getWritableMembershipIn: mocks.writableMembershipIn,
}));
vi.mock('@/actions/recipe-shared', () => ({
  buildRecipeVisibilityFilter: mocks.visibilityFilter,
}));
vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    mealPlan: { findFirst: mocks.planFindFirst, create: mocks.planCreate },
    recipe: { findMany: mocks.recipeFindMany },
    mealPlanItem: { createMany: mocks.itemCreateMany },
  },
}));

import { generateMealPlan } from './meal-auto-fill';
import { CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR } from '@/lib/meal-cycle-alignment';

const request = {
  weekStart: '2026-11-16',
  dietaryRestrictions: [],
  healthGoals: [],
  cuisinePreferences: [],
  avoidIngredients: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.session.mockResolvedValue({ ok: true, userId: 'user-1' });
  mocks.writableMembershipIn.mockImplementation(async (_userId: string, organizationId: string) => ({
    ok: true,
    membership: {
      memberId: `member-${organizationId}`,
      organizationId,
      role: 'member',
      organization: { id: organizationId, name: organizationId, type: 'HOUSEHOLD' },
    },
  }));
  mocks.visibilityFilter.mockResolvedValue({ isSystem: true });
  mocks.userFindUnique.mockResolvedValue({ dietaryRestrictions: [], healthGoals: [] });
  mocks.planFindFirst.mockResolvedValue(null);
  mocks.planCreate.mockResolvedValue({ id: 'plan-1', items: [] });
  mocks.recipeFindMany.mockResolvedValue(
    ['breakfast', 'lunch', 'dinner'].map((category) => ({
      id: `recipe-${category}`,
      name: category,
      category,
      tags: [],
      servings: 2,
      ingredients: [],
    }))
  );
  mocks.itemCreateMany.mockResolvedValue({ count: 21 });
});

describe('generateMealPlan follows the space on screen', () => {
  it('creates and fills the plan of the space the page showed', async () => {
    const result = await generateMealPlan('family', request);
    expect(result.success).toBe(true);
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.planFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'family' }) })
    );
    expect(mocks.planCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: 'family' }) })
    );
    // Household recipes of that space only, never those of the cookie's space.
    expect(mocks.visibilityFilter).toHaveBeenCalledWith('user-1', 'family');
  });

  it.each([
    ['a viewer of the space', 'view only'],
    ['no longer a member of the space', 'space not found'],
  ])('writes nothing when the user is %s', async (_case, error) => {
    mocks.writableMembershipIn.mockResolvedValue({ ok: false, error });
    expect(await generateMealPlan('family', request)).toEqual({ success: false, error });
    expect(mocks.planFindFirst).not.toHaveBeenCalled();
    expect(mocks.planCreate).not.toHaveBeenCalled();
    expect(mocks.itemCreateMany).not.toHaveBeenCalled();
  });
});

describe('generateMealPlan aligns with the cycle in households only', () => {
  const tracking = {
    dietaryRestrictions: [],
    healthGoals: [],
    enableCycleTracking: true,
    cycleLength: 28,
    lastPeriodDate: new Date(Date.UTC(2026, 10, 1)),
    alignMealsWithCycle: true,
  };
  const inSpace = (type: string) =>
    mocks.writableMembershipIn.mockImplementation(
      async (_userId: string, organizationId: string) => ({
        ok: true,
        membership: {
          memberId: `member-${organizationId}`,
          organizationId,
          role: 'member',
          organization: { id: organizationId, name: organizationId, type },
        },
      })
    );

  it.each(['COLLECTIVE', 'COMMUNITY', 'CORPORATE'])(
    'refuses alignment in a %s space before writing anything',
    async (type) => {
      inSpace(type);
      mocks.userFindUnique.mockResolvedValue(tracking);
      const result = await generateMealPlan('office', { ...request, alignWithCycle: true });
      expect(result).toEqual({ success: false, error: CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR });
      expect(mocks.planFindFirst).not.toHaveBeenCalled();
      expect(mocks.planCreate).not.toHaveBeenCalled();
      expect(mocks.itemCreateMany).not.toHaveBeenCalled();
    }
  );

  it('ignores a saved choice to align outside households', async () => {
    inSpace('CORPORATE');
    mocks.userFindUnique.mockResolvedValue(tracking);
    const result = await generateMealPlan('office', request);
    expect(result).toMatchObject({ success: true, data: { cycleAlignment: null } });
  });

  it('aligns in a household when the person turned it on', async () => {
    mocks.userFindUnique.mockResolvedValue(tracking);
    const result = await generateMealPlan('family', request);
    expect(result.success).toBe(true);
    expect(result.data?.cycleAlignment).not.toBeNull();
  });
});

describe('generateMealPlan with stored cycle data', () => {
  const cycleUser = (lastPeriodDate: Date) => ({
    dietaryRestrictions: [],
    healthGoals: [],
    enableCycleTracking: true,
    cycleLength: 28,
    lastPeriodDate,
    alignMealsWithCycle: true,
  });

  it('plans without the cycle when the stored period date is outside 1900-9999', async () => {
    // Saved before the profile action validated dates (a year typed as "25")
    mocks.userFindUnique.mockResolvedValue(cycleUser(new Date('0025-11-03')));
    const result = await generateMealPlan('family', { ...request, alignWithCycle: true });
    expect(result).toMatchObject({ success: true, data: { cycleAlignment: null } });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('never logs an error message, which may carry cycle data', async () => {
    mocks.planCreate.mockRejectedValue(new Error('Invalid date-only string: 0025-11-03'));
    const result = await generateMealPlan('family', request);
    expect(result).toEqual({ success: false, error: 'Failed to generate meal plan' });
    expect(console.error).toHaveBeenCalledTimes(1);
    const logged = vi.mocked(console.error).mock.calls[0].map(String).join(' ');
    expect(logged).not.toContain('0025');
    expect(logged).toContain('Error');
  });
});
