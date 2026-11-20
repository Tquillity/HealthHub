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
  routineFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  householdData: vi.fn(),
  sharedJournalEntries: vi.fn(),
  ownCycleShare: vi.fn(),
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
  prisma: {
    educationalResource: { findFirst: mocks.educationalResource },
    routine: { findMany: mocks.routineFindMany },
    user: { findUnique: mocks.userFindUnique },
  },
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
vi.mock('@/components/routines/routines-client', () => ({
  RoutinesClient: stub('RoutinesClient'),
}));
vi.mock('@/components/routines/routine-filters', () => ({
  RoutineFilters: stub('RoutineFilters'),
}));
vi.mock('@/components/recipes/recipe-form', () => ({ RecipeForm: stub('RecipeForm') }));
vi.mock('@/lib/household-management', () => ({ getHouseholdData: mocks.householdData }));
vi.mock('@/lib/journal-sharing', () => ({ getSharedJournalEntries: mocks.sharedJournalEntries }));
vi.mock('@/lib/support-status', () => ({ getOwnCycleShare: mocks.ownCycleShare }));
vi.mock('@/components/household/member-list', () => ({ MemberList: stub('MemberList') }));
vi.mock('@/components/household/invite-form', () => ({ InviteForm: stub('InviteForm') }));
vi.mock('@/components/household/pending-invitations', () => ({
  PendingInvitations: stub('PendingInvitations'),
}));
vi.mock('@/components/household/invitations-for-you', () => ({
  InvitationsForYou: stub('InvitationsForYou'),
}));
vi.mock('@/components/household/org-privacy-card', () => ({
  OrgPrivacyCard: stub('OrgPrivacyCard'),
}));
vi.mock('@/components/household/shared-journal-feed', () => ({
  SharedJournalFeed: stub('SharedJournalFeed'),
}));
vi.mock('@/components/household/create-organization-form', () => ({
  CreateOrganizationForm: stub('CreateOrganizationForm'),
}));
vi.mock('@/components/household/leave-organization-card', () => ({
  LeaveOrganizationCard: stub('LeaveOrganizationCard'),
}));
vi.mock('@/components/household/org-badges', () => ({
  OrgTypeBadge: stub('OrgTypeBadge'),
  RoleBadge: stub('RoleBadge'),
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
import { RoutinesClient } from '@/components/routines/routines-client';
import { RecipeForm } from '@/components/recipes/recipe-form';
import { MemberList } from '@/components/household/member-list';
import { InviteForm } from '@/components/household/invite-form';
import { PendingInvitations } from '@/components/household/pending-invitations';
import { LeaveOrganizationCard } from '@/components/household/leave-organization-card';
import { OrgPrivacyCard } from '@/components/household/org-privacy-card';
import GroceriesPage from './groceries/page';
import MealPlannerPage from './meal-planner/page';
import MealPlanTemplatesPage from './meal-planner/templates/page';
import RoutinesPage from './routines/page';
import NewRecipePage from './recipes/new/page';
import HouseholdPage from './profile/household/page';
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
      organizationType: 'HOUSEHOLD',
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

  it('offers cycle alignment in households only, where the shared plan may follow it', async () => {
    mocks.userFindUnique.mockResolvedValue({
      enableCycleTracking: true,
      cycleLength: 28,
      lastPeriodDate: new Date(Date.UTC(2026, 10, 1)),
      alignMealsWithCycle: false,
    });
    const home = await MealPlannerPage();
    expect(findOne(home, MealPlanGenerator).props.cycleOptions).toEqual({
      canAlign: true,
      alignByDefault: false,
    });
    // A new generator per space, so the switch starts from that space's saved choice
    // after a switch (which only refreshes the page) instead of keeping the last one.
    expect(findOne(home, MealPlanGenerator).key).toBe('family');

    const weekly = await mocks.weeklyPlan();
    for (const organizationType of ['COLLECTIVE', 'COMMUNITY', 'CORPORATE']) {
      mocks.weeklyPlan.mockResolvedValue({ ...weekly, organizationType });
      const page = await MealPlannerPage();
      expect(findOne(page, MealPlanGenerator).props.cycleOptions, organizationType).toBeNull();
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

describe('routines page', () => {
  it('gives the routines the space it shows and remounts them per space', async () => {
    mocks.routineFindMany.mockResolvedValue([{ id: 'routine-family' }]);
    const family = findOne(await RoutinesPage(), RoutinesClient);
    expect(family.props).toMatchObject({
      organizationId: 'family',
      routines: [{ id: 'routine-family' }],
    });
    expect(family.key).toBe('family');
    expect(mocks.routineFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ organizationId: 'family' }, { isSystem: true }] },
      })
    );

    mocks.activeMembership.mockResolvedValue(membership('office'));
    mocks.routineFindMany.mockResolvedValue([{ id: 'routine-office' }]);
    const office = findOne(await RoutinesPage(), RoutinesClient);
    expect(office.props).toMatchObject({
      organizationId: 'office',
      routines: [{ id: 'routine-office' }],
    });
    expect(office.key).toBe('office');
  });
});

describe('new recipe page', () => {
  it('files the recipe under the space it shows', async () => {
    mocks.userFindUnique.mockResolvedValue({ role: 'admin' });
    const page = await NewRecipePage();
    expect(findOne(page, RecipeForm).props.organizationId).toBe('family');
  });
});

describe('household page', () => {
  const household = (id: string, name: string) => ({
    ok: true,
    data: {
      organization: { id, name, type: 'HOUSEHOLD' },
      currentUserId: 'user-1',
      currentUserRole: 'owner',
      members: [],
      invitations: [],
      invitationsForYou: [],
      invitableRoles: ['admin', 'member', 'viewer'],
      ownerCount: 1,
      membershipCount: 2,
    },
  });

  beforeEach(() => {
    mocks.sharedJournalEntries.mockResolvedValue([]);
    mocks.ownCycleShare.mockResolvedValue(null);
  });

  it("tells the privacy card what you share with the space it shows, and nothing else's", async () => {
    mocks.householdData.mockResolvedValue(household('family', 'Family'));
    const shareIn = (organizationId: string) => ({
      household: { id: organizationId, share: { level: 'ENERGY' } },
      cycleConfigured: true,
    });
    mocks.ownCycleShare.mockImplementation(async (_userId: string, organizationId: string) =>
      shareIn(organizationId)
    );
    const page = await HouseholdPage();
    expect(mocks.ownCycleShare).toHaveBeenCalledWith('user-1', 'family');
    expect(findOne(page, OrgPrivacyCard).props).toMatchObject({
      type: 'HOUSEHOLD',
      yourCycleShare: shareIn('family'),
    });
  });

  it('invites to the space it shows', async () => {
    mocks.householdData.mockResolvedValue(household('running-club', 'Running club'));
    const page = await HouseholdPage();
    expect(findOne(page, InviteForm).props).toMatchObject({
      organizationId: 'running-club',
      organizationName: 'Running club',
    });
  });

  it('remounts the invite form, pending invitations and member cards per space', async () => {
    const keysFor = async (id: string, name: string) => {
      mocks.householdData.mockResolvedValue(household(id, name));
      const page = await HouseholdPage();
      return [InviteForm, PendingInvitations, MemberList, LeaveOrganizationCard].map(
        (component) => findOne(page, component).key
      );
    };
    const club = await keysFor('running-club', 'Running club');
    const family = await keysFor('family', 'Family');
    for (const key of [...club, ...family]) expect(key).toBeTruthy();
    // Every key changes with the space, so React drops the old component and its state.
    club.forEach((key, index) => expect(key).not.toBe(family[index]));
    expect(club.every((key) => key?.includes('running-club'))).toBe(true);
    // Siblings must not share a key.
    expect(new Set(club).size).toBe(club.length);
  });
});
