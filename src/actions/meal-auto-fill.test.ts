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
