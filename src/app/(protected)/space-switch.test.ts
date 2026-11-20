import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Space-scoped pages hand the organization id they were rendered for to their client
 * components. Writes send it back, so a switch in another tab cannot redirect them, and
 * components that hold state are keyed by it, so a switch remounts them instead of keeping
 * the previous space's data on screen.
 */

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  sessionUserId: vi.fn(),
  activeMembership: vi.fn(),
  groceryList: vi.fn(),
  cachedRecipe: vi.fn(),
  userRole: vi.fn(),
  educationalResource: vi.fn(),
  profile: vi.fn(),
  weeklyPlan: vi.fn(),
  mealPlanTemplates: vi.fn(),
}));

/** Stand-in for a client component; the tests only look at the props a page passes. */
const stub = vi.hoisted(() => (name: string) => {
  const component = () => null;
  Object.defineProperty(component, 'name', { value: name });
  return component;
});

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect ${path}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('@/lib/session', () => ({
  getServerSession: mocks.session,
  getSessionUserId: mocks.sessionUserId,
}));
vi.mock('@/lib/active-organization', () => ({
  getActiveMembership: mocks.activeMembership,
}));
vi.mock('@/lib/db', () => ({
  prisma: { educationalResource: { findFirst: mocks.educationalResource } },
}));
vi.mock('@/actions/grocery-actions', () => ({ getGroceryList: mocks.groceryList }));
vi.mock('@/actions/recipe-actions', () => ({ getUserRole: mocks.userRole }));
vi.mock('@/lib/recipe-cache', () => ({ getCachedRecipe: mocks.cachedRecipe }));
vi.mock('@/actions/profile-actions', () => ({ getProfile: mocks.profile }));
vi.mock('@/actions/meal-actions', () => ({
  getWeeklyPlan: mocks.weeklyPlan,
  getMealPlanTemplates: mocks.mealPlanTemplates,
}));
vi.mock('@/components/meals/meal-board', () => ({ default: stub('MealBoard') }));
vi.mock('@/components/meals/meal-plan-generator', () => ({
  MealPlanGenerator: stub('MealPlanGenerator'),
}));
vi.mock('@/components/meals/meal-planner-settings', () => ({
  MealPlannerSettings: stub('MealPlannerSettings'),
}));
vi.mock('@/components/printables/print-manager', () => ({
  PrintManager: stub('PrintManager'),
}));
vi.mock('@/components/meals/clear-all-meals-button', () => ({
  ClearAllMealsButton: stub('ClearAllMealsButton'),
}));
vi.mock('@/components/meals/save-template-button', () => ({
  SaveTemplateButton: stub('SaveTemplateButton'),
}));
vi.mock('@/components/meals/meal-plan-templates-client', () => ({
  MealPlanTemplatesClient: stub('MealPlanTemplatesClient'),
}));
vi.mock('@/components/groceries/grocery-list-client', () => ({
  GroceryListClient: stub('GroceryListClient'),
}));
vi.mock('@/components/recipes/servings-scaler', () => ({
  ServingsScaler: stub('ServingsScaler'),
}));
vi.mock('@/components/recipes/recipe-detail-client', () => ({
  RecipeDetailClient: stub('RecipeDetailClient'),
}));
vi.mock('@/components/recipes/recipe-lean-info', () => ({
  RecipeLeanInfo: stub('RecipeLeanInfo'),
}));
vi.mock('@/components/ui/error-boundary', () => ({
  AppErrorBoundary: stub('AppErrorBoundary'),
}));

import { GroceryListClient } from '@/components/groceries/grocery-list-client';
import { ServingsScaler } from '@/components/recipes/servings-scaler';
import MealBoard from '@/components/meals/meal-board';
import { MealPlanGenerator } from '@/components/meals/meal-plan-generator';
import { ClearAllMealsButton } from '@/components/meals/clear-all-meals-button';
import { SaveTemplateButton } from '@/components/meals/save-template-button';
import { MealPlanTemplatesClient } from '@/components/meals/meal-plan-templates-client';
import GroceriesPage from './groceries/page';
import MealPlannerPage from './meal-planner/page';
import MealPlanTemplatesPage from './meal-planner/templates/page';
import RecipeDetailPage from '../(public)/recipes/[id]/page';

type Props = Record<string, unknown>;

/**
 * Every element of `type` in the JSX a page returned, including elements passed in other
 * props (such as a header's `actions`). Function components are not expanded.
 */
function findAll(node: ReactNode, type: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  if (!isValidElement<Props>(node)) return [];
  const own = node.type === type ? [node] : [];
  const nested = Object.values(node.props).flatMap((value) => findAll(value as ReactNode, type));
  return [...own, ...nested];
}

function findOne(node: ReactNode, type: unknown): ReactElement<Props> {
  const found = findAll(node, type);
  expect(found).toHaveLength(1);
  return found[0];
}

const membership = (organizationId: string) => ({
  memberId: `member-${organizationId}`,
  organizationId,
  role: 'owner',
  organization: { id: organizationId, name: organizationId, type: 'HOUSEHOLD' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.sessionUserId.mockResolvedValue('user-1');
  mocks.activeMembership.mockResolvedValue(membership('family'));
});

describe('groceries page', () => {
  beforeEach(() => {
    mocks.groceryList.mockResolvedValue({
      success: true,
      data: [{ name: 'Rice', unit: 'dl', totalQuantity: 2, recipes: [] }],
    });
  });

  it('gives the list the space it shows and remounts it per space', async () => {
    const family = findOne(
      await GroceriesPage({ searchParams: Promise.resolve({}) }),
      GroceryListClient
    );
    expect(family.props.organizationId).toBe('family');
    expect(family.key).toBe('family');

    mocks.activeMembership.mockResolvedValue(membership('office'));
    const office = findOne(
      await GroceriesPage({ searchParams: Promise.resolve({}) }),
      GroceryListClient
    );
    expect(office.props.organizationId).toBe('office');
    expect(office.key).toBe('office');
  });
});

describe('recipe page grocery button', () => {
  beforeEach(() => {
    mocks.cachedRecipe.mockResolvedValue({
      success: true,
      data: {
        id: 'recipe-1',
        name: 'Porridge',
        description: null,
        imageUrl: null,
        imageUrls: [],
        servings: 2,
        tags: [],
        dietaryTags: [],
        isSystem: true,
        isSecret: false,
        isPrivate: false,
        ingredients: [{ id: 'ing-1', name: 'Oats', quantity: 1, unit: 'dl' }],
        instructions: [],
      },
    });
    mocks.userRole.mockResolvedValue({ success: true, role: 'user' });
    mocks.educationalResource.mockResolvedValue(null);
  });

  it('sends ingredients to the space shown when the page was rendered', async () => {
    const page = await RecipeDetailPage({ params: Promise.resolve({ id: 'recipe-1' }) });
    expect(findOne(page, ServingsScaler).props.groceryOrganizationId).toBe('family');
    expect(mocks.activeMembership).toHaveBeenCalledWith('user-1');
  });

  it('offers no grocery list to signed-out visitors', async () => {
    mocks.sessionUserId.mockResolvedValue(null);
    mocks.userRole.mockResolvedValue({ success: false, role: null });
    const page = await RecipeDetailPage({ params: Promise.resolve({ id: 'recipe-1' }) });
    expect(findOne(page, ServingsScaler).props.groceryOrganizationId).toBeNull();
    expect(mocks.activeMembership).not.toHaveBeenCalled();
  });
});

describe('meal planner page', () => {
  beforeEach(() => {
    mocks.profile.mockResolvedValue({
      success: true,
      data: { id: 'user-1', mealPlanDuration: null, mealPlanStartDate: null },
    });
    mocks.weeklyPlan.mockResolvedValue({
      plan: { id: 'plan-1', organizationId: 'family', startDate: new Date(), items: [] },
      recipes: [],
      duration: '1week',
      startDate: new Date('2026-11-16T00:00:00'),
      endDate: new Date('2026-11-22T00:00:00'),
      useDefaultStart: true,
    });
  });

  it('sends every change to the space the plan belongs to', async () => {
    const page = await MealPlannerPage();
    for (const component of [MealBoard, MealPlanGenerator, ClearAllMealsButton, SaveTemplateButton]) {
      expect(findOne(page, component).props.organizationId).toBe('family');
    }
  });
});

describe('meal plan templates page', () => {
  beforeEach(() => {
    mocks.profile.mockResolvedValue({ success: true, data: { id: 'user-1' } });
    mocks.mealPlanTemplates.mockResolvedValue({ success: true, data: [] });
  });

  it('gives the templates the space it shows and remounts them per space', async () => {
    const family = findOne(await MealPlanTemplatesPage(), MealPlanTemplatesClient);
    expect(family.props.organizationId).toBe('family');
    expect(family.key).toBe('family');
    expect(mocks.activeMembership).toHaveBeenCalledWith('user-1');

    mocks.activeMembership.mockResolvedValue(membership('office'));
    const office = findOne(await MealPlanTemplatesPage(), MealPlanTemplatesClient);
    expect(office.props.organizationId).toBe('office');
    expect(office.key).toBe('office');
  });
});
