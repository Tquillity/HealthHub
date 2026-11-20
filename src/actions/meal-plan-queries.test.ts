import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  activeMembership: vi.fn(),
  membershipIn: vi.fn(),
  userFindUnique: vi.fn(),
  planFindFirst: vi.fn(),
  planCreate: vi.fn(),
  recipeFindMany: vi.fn(),
}));

vi.mock('@/lib/active-organization', () => ({
  getActiveMembership: mocks.activeMembership,
  getMembershipIn: mocks.membershipIn,
  NO_HOUSEHOLD_ERROR: 'No household found',
  SPACE_NOT_FOUND_ERROR: 'Space not found',
}));
vi.mock('@/actions/recipe-shared', () => ({
  buildRecipeVisibilityFilter: vi.fn().mockResolvedValue({ isSystem: true }),
}));
vi.mock('@/lib/session', () => ({ requireSessionUserId: mocks.session }));
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    mealPlan: { findFirst: mocks.planFindFirst, create: mocks.planCreate },
    recipe: { findMany: mocks.recipeFindMany },
  },
}));

import { getWeeklyPlan } from './meal-plan-queries';

const membership = (organizationId: string) => ({
  memberId: `member-${organizationId}`,
  organizationId,
  role: 'member',
  organization: { id: organizationId, name: organizationId, type: 'HOUSEHOLD' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ ok: true, userId: 'user-1' });
  // The cookie names another space than the page the user is looking at.
  mocks.activeMembership.mockResolvedValue(membership('office'));
  mocks.membershipIn.mockImplementation(async (_userId: string, organizationId: string) =>
    membership(organizationId)
  );
  mocks.userFindUnique.mockResolvedValue({ mealPlanDuration: null, mealPlanStartDate: null });
  mocks.planFindFirst.mockResolvedValue({ id: 'plan-family', organizationId: 'family', items: [] });
  mocks.recipeFindMany.mockResolvedValue([]);
});

describe('getWeeklyPlan', () => {
  it('follows the active space when no space is named (meal planner page)', async () => {
    await getWeeklyPlan();
    expect(mocks.membershipIn).not.toHaveBeenCalled();
    expect(mocks.planFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'office' }) })
    );
  });

  it('loads the plan of the space a page was rendered for, not the cookie', async () => {
    const { plan, organizationType } = await getWeeklyPlan(undefined, 'family');
    expect(plan.id).toBe('plan-family');
    // What the page may offer there (cycle alignment: households only)
    expect(organizationType).toBe('HOUSEHOLD');
    expect(mocks.membershipIn).toHaveBeenCalledWith('user-1', 'family');
    expect(mocks.activeMembership).not.toHaveBeenCalled();
    expect(mocks.planFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'family' }) })
    );
  });

  it('refuses a space the user does not belong to, without falling back', async () => {
    mocks.membershipIn.mockResolvedValue(null);
    await expect(getWeeklyPlan(undefined, 'family')).rejects.toThrow('Space not found');
    await expect(getWeeklyPlan(undefined, '')).rejects.toThrow('Space not found');
    expect(mocks.planFindFirst).not.toHaveBeenCalled();
    expect(mocks.planCreate).not.toHaveBeenCalled();
  });
});
