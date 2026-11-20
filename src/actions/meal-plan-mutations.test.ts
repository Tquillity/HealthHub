import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  writableMembershipIn: vi.fn(),
  visibilityFilter: vi.fn(),
  planFindFirst: vi.fn(),
  recipeFindFirst: vi.fn(),
  itemCreate: vi.fn(),
  itemDeleteMany: vi.fn(),
  itemCreateMany: vi.fn(),
  templateFindFirst: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  templateDelete: vi.fn(),
}));

// Writes go to the space the page showed; the cookie (another tab) is never consulted.
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
    mealPlan: { findFirst: mocks.planFindFirst },
    recipe: { findFirst: mocks.recipeFindFirst },
    mealPlanItem: {
      create: mocks.itemCreate,
      deleteMany: mocks.itemDeleteMany,
      createMany: mocks.itemCreateMany,
    },
    mealPlanTemplate: {
      findFirst: mocks.templateFindFirst,
      create: mocks.templateCreate,
      update: mocks.templateUpdate,
      delete: mocks.templateDelete,
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import {
  addMealToPlan,
  applyMealPlanTemplate,
  clearAllMeals,
  deleteMealPlanTemplate,
  duplicateMealPlanTemplate,
  removeMealFromPlan,
  saveMealPlanAsTemplate,
  shareMealPlanTemplate,
  updateMealPlanTemplate,
} from './meal-plan-mutations';

const dbMocks = [
  mocks.planFindFirst,
  mocks.recipeFindFirst,
  mocks.itemCreate,
  mocks.itemDeleteMany,
  mocks.itemCreateMany,
  mocks.templateFindFirst,
  mocks.templateCreate,
  mocks.templateUpdate,
  mocks.templateDelete,
];

/** Every `organizationId` value the action handed to the database, at any depth. */
function organizationIdsSentToDb(): unknown[] {
  const found: unknown[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'organizationId') found.push(child);
      else walk(child);
    }
  };
  for (const mock of dbMocks) walk(mock.mock.calls);
  return found;
}

const actions = [
  ['addMealToPlan', () => addMealToPlan('family', 'plan-1', 'recipe-1', '2026-11-20', 'dinner')],
  [
    'applyMealPlanTemplate',
    () => applyMealPlanTemplate('family', 'template-1', 'plan-1', '2026-11-20'),
  ],
  ['clearAllMeals', () => clearAllMeals('family', 'plan-1')],
  ['deleteMealPlanTemplate', () => deleteMealPlanTemplate('family', 'template-1')],
  ['duplicateMealPlanTemplate', () => duplicateMealPlanTemplate('family', 'template-1')],
  ['removeMealFromPlan', () => removeMealFromPlan('family', 'item-1')],
  [
    'saveMealPlanAsTemplate',
    () => saveMealPlanAsTemplate('family', { planId: 'plan-1', name: 'Our week' }),
  ],
  ['shareMealPlanTemplate', () => shareMealPlanTemplate('family', 'template-1')],
  [
    'updateMealPlanTemplate',
    () => updateMealPlanTemplate('family', { id: 'template-1', name: 'Renamed' }),
  ],
] as const;

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
  mocks.planFindFirst.mockResolvedValue({
    id: 'plan-1',
    startDate: new Date('2026-11-16T00:00:00'),
    items: [
      { recipeId: 'recipe-1', date: new Date('2026-11-17T00:00:00'), mealType: 'dinner', servings: 2 },
    ],
  });
  mocks.recipeFindFirst.mockResolvedValue({ id: 'recipe-1' });
  mocks.itemCreate.mockResolvedValue({ id: 'item-2' });
  mocks.itemDeleteMany.mockResolvedValue({ count: 1 });
  mocks.itemCreateMany.mockResolvedValue({ count: 1 });
  mocks.templateFindFirst.mockResolvedValue({
    id: 'template-1',
    name: 'Our week',
    description: null,
    shareToken: null,
    items: [{ recipeId: 'recipe-1', dayOffset: 0, mealType: 'dinner', servings: 2 }],
  });
  mocks.templateCreate.mockResolvedValue({ id: 'template-2', items: [] });
  mocks.templateUpdate.mockResolvedValue({ id: 'template-1' });
  mocks.templateDelete.mockResolvedValue({ id: 'template-1' });
});

describe('meal plan and template writes follow the space on screen', () => {
  it.each(actions)('%s checks and writes only the space the page showed', async (_name, run) => {
    const result = await run();
    expect(result).toMatchObject({ success: true });
    expect(mocks.writableMembershipIn).toHaveBeenCalledWith('user-1', 'family');
    const sent = organizationIdsSentToDb();
    expect(sent.length).toBeGreaterThan(0);
    expect(new Set(sent)).toEqual(new Set(['family']));
  });

  it('only offers recipes of that space when adding a meal', async () => {
    await addMealToPlan('family', 'plan-1', 'recipe-1', '2026-11-20', 'dinner');
    expect(mocks.visibilityFilter).toHaveBeenCalledWith('user-1', 'family');
  });

  describe.each([
    ['a viewer of the space', 'view only'],
    ['no longer a member of the space', 'space not found'],
  ])('when the user is %s', (_case, error) => {
    it.each(actions)('%s writes nothing', async (_name, run) => {
      mocks.writableMembershipIn.mockResolvedValue({ ok: false, error });
      expect(await run()).toEqual({ success: false, error });
      for (const mock of dbMocks) expect(mock).not.toHaveBeenCalled();
    });
  });
});
