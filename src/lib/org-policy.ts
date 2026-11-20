import type { OrganizationType } from '@prisma/client';
import type { GroceryItem } from '@/lib/grocery-aggregate';

/**
 * The "intimacy scale" (issue #11): what an organization shares depends on its type,
 * not on how many people are in it.
 *
 * - HOUSEHOLD (partners, family): meal plans and groceries are fully shared. Each person
 *   can choose to share individual entries (journal days) and their current cycle status
 *   (partner sync, #3) with it.
 * - COLLECTIVE (shared house, co-op): the pantry and grocery list are shared. Meal plans
 *   are shared only with the people who choose to plan in this space (the shared plan is
 *   the space's plan; nobody's personal plan is copied in). Journals stay private unless
 *   someone explicitly shares an entry. Cycle status is never shown here: it is a standing,
 *   always-updating disclosure that people turn on for "my household", and housemates in
 *   a co-op are a wider circle than they agreed to.
 * - COMMUNITY / CORPORATE (clubs, workplaces): no individual journal or cycle data is ever
 *   visible, not even by choice. Only anonymized group numbers, and only for groups of at
 *   least MIN_AGGREGATE_GROUP_SIZE people. Grocery lists do not show where items came from.
 *
 * Pure and unit-tested (org-policy.test.ts). Server code enforces it; the UI only explains it.
 */

export const ORGANIZATION_TYPES = [
  'HOUSEHOLD',
  'COLLECTIVE',
  'COMMUNITY',
  'CORPORATE',
] as const satisfies readonly OrganizationType[];

/**
 * Smallest group an anonymized number may describe. Based on k-anonymity with k = 5
 * (Sweeney L. "k-anonymity: a model for protecting privacy." Int J Uncertain Fuzziness
 * Knowl-Based Syst. 2002;10(5):557-570), a common small-cell suppression threshold in
 * health statistics. Stricter publishers use more (the US CMS cell-size policy suppresses
 * counts below 11). Applies to every organization type: in a two-person household an
 * "average" would reveal the other person's value.
 */
export const MIN_AGGREGATE_GROUP_SIZE = 5;

export type OrgPolicy = {
  label: string;
  description: string;
  /** shared: everyone plans together. opt-in: the plan is shared with those who choose this space. */
  mealPlans: 'shared' | 'opt-in';
  /** Grocery list items show which recipe, meal and day they came from. */
  grocerySources: boolean;
  /** People may share individual entries (journal days) with the organization. */
  individualSharing: 'opt-in' | 'never';
  /** People may show their current cycle status to the other members (partner sync, #3). */
  cycleStatusSharing: 'opt-in' | 'never';
  /** Only anonymized group numbers, never individuals. */
  aggregatesOnly: boolean;
};

export const ORG_POLICIES: Record<OrganizationType, OrgPolicy> = {
  HOUSEHOLD: {
    label: 'Household',
    description:
      'For partners and family. Meal plans and groceries are shared. Journal days and your cycle status are private unless you choose to share them.',
    mealPlans: 'shared',
    grocerySources: true,
    individualSharing: 'opt-in',
    cycleStatusSharing: 'opt-in',
    aggregatesOnly: false,
  },
  COLLECTIVE: {
    label: 'Collective',
    description:
      'For shared houses and co-ops. The pantry and grocery list are shared, meal planning is for those who join in, and journals stay private unless you share a day.',
    mealPlans: 'opt-in',
    grocerySources: true,
    individualSharing: 'opt-in',
    cycleStatusSharing: 'never',
    aggregatesOnly: false,
  },
  COMMUNITY: {
    label: 'Community',
    description:
      "For clubs and groups. Nobody sees anyone's journal or cycle, and group numbers only appear when at least 5 people take part.",
    mealPlans: 'opt-in',
    grocerySources: false,
    individualSharing: 'never',
    cycleStatusSharing: 'never',
    aggregatesOnly: true,
  },
  CORPORATE: {
    label: 'Workplace',
    description:
      "For teams at work. Nobody sees anyone's journal or cycle, and group numbers only appear when at least 5 people take part.",
    mealPlans: 'opt-in',
    grocerySources: false,
    individualSharing: 'never',
    cycleStatusSharing: 'never',
    aggregatesOnly: true,
  },
};

export function getOrgPolicy(type: OrganizationType): OrgPolicy {
  return ORG_POLICIES[type];
}

/** A journal entry may be shared with households and collectives only. */
export function canShareJournalWith(type: OrganizationType): boolean {
  return ORG_POLICIES[type].individualSharing === 'opt-in';
}

/** Members of households and collectives may read entries explicitly shared with them. */
export function canViewSharedJournals(type: OrganizationType): boolean {
  return ORG_POLICIES[type].individualSharing === 'opt-in';
}

/**
 * For partner sync (#3): may one person's current cycle status be shown to the other members
 * of this organization? Only in households, and only when that person has opted in.
 * Callers must also check that both people are current members.
 */
export function canShowIndividualCycleStatus(
  type: OrganizationType,
  options: { sharerOptedIn: boolean }
): boolean {
  return ORG_POLICIES[type].cycleStatusSharing === 'opt-in' && options.sharerOptedIn;
}

/**
 * For cycle-aware meal planning (#2): may the Meal Plan Generator favor recipes for the
 * generating person's estimated cycle phase when it fills this organization's plan? The plan
 * is shared, and its day-by-day picks can hint at that person's phase, so this is a cycle
 * disclosure like partner sync: households only. The person must also turn it on
 * (User.alignMealsWithCycle, off by default); callers check that.
 */
export function canAlignMealPlanWithCycle(type: OrganizationType): boolean {
  return ORG_POLICIES[type].cycleStatusSharing === 'opt-in';
}

/** Organization types where people may show their cycle status (households only). */
export const CYCLE_STATUS_ORG_TYPES: OrganizationType[] = ORGANIZATION_TYPES.filter(
  (type) => ORG_POLICIES[type].cycleStatusSharing === 'opt-in'
);

/** May an anonymized number about `contributorCount` people be shown? */
export function canShowAggregate(contributorCount: number): boolean {
  return Number.isFinite(contributorCount) && contributorCount >= MIN_AGGREGATE_GROUP_SIZE;
}

/** Grocery items keep their recipe/meal/day sources only where the policy allows it. */
export function applyGroceryPrivacy(
  items: GroceryItem[],
  type: OrganizationType
): GroceryItem[] {
  if (ORG_POLICIES[type].grocerySources) return items;
  return items.map((item) => ({ ...item, recipes: [] }));
}
