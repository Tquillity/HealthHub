/**
 * Pure helpers for meal-plan auto-fill (no Prisma / session).
 */
import type { CyclePhase } from './cycle-calculator';
import { normalizeLeanRole } from './lean-kitchen';
import {
  getBiologicalMatch,
  PHASE_NUTRITION,
  type BiologicalMatch,
  type NutrientHighlight,
  type RecipeBioProfile,
} from './phase-nutrition';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const CATEGORY_BY_MEAL: Record<MealType, string[]> = {
  breakfast: ['Breakfast', 'breakfast', 'Snack'],
  lunch: ['Lunch', 'lunch', 'Snack'],
  dinner: ['Dinner', 'dinner', 'Main Course'],
};

export function mealSlotKey(day: Date, mealType: string): string {
  const dayKey = day.toISOString().split('T')[0];
  return `${dayKey}::${mealType}`;
}

export function buildExistingSlotSet(
  items: Array<{ date: Date; mealType: string }>
): Set<string> {
  const slots = new Set<string>();
  for (const item of items) {
    slots.add(mealSlotKey(item.date, item.mealType));
  }
  return slots;
}

export function isSlotFilled(
  existingSlots: Set<string>,
  day: Date,
  mealType: string
): boolean {
  return existingSlots.has(mealSlotKey(day, mealType));
}

export interface RecipeForMealPick {
  id: string;
  category: string | null;
  servings: number | null;
}

export function filterRecipesForMealType<T extends RecipeForMealPick>(
  recipes: T[],
  mealType: MealType
): T[] {
  const categoryOptions = CATEGORY_BY_MEAL[mealType] || [];
  const matched = recipes.filter((recipe) => {
    if (!recipe.category) return true;
    return categoryOptions.some(
      (cat) => recipe.category?.toLowerCase() === cat.toLowerCase()
    );
  });
  return matched.length > 0 ? matched : recipes;
}

export function pickRandomRecipe<T extends RecipeForMealPick>(
  recipes: T[]
): T | null {
  if (recipes.length === 0) return null;
  return recipes[Math.floor(Math.random() * recipes.length)] ?? null;
}

export function recipeMatchesAvoidList(
  ingredientNames: string[],
  avoidIngredients: string[]
): boolean {
  if (avoidIngredients.length === 0) return false;
  return avoidIngredients.some((avoid) =>
    ingredientNames.some((name) => name.includes(avoid.toLowerCase()))
  );
}

// ---------------------------------------------------------------------------
// Weighted selection and cycle alignment (issue #2, Biological Fueling)
// ---------------------------------------------------------------------------

/**
 * A recipe that suits the day's cycle phase gets weight 1 + PHASE_MATCH_BONUS × (focus
 * nutrients it covers): 2.5× as likely as any other recipe with one focus nutrient, 4×
 * with two. Strong enough to notice over a week, never exclusive: every recipe that
 * passes the filters can still be picked (issue #2: suggestions, not restrictions).
 */
export const PHASE_MATCH_BONUS = 1.5;

/**
 * Variety: each time a recipe is already planned in the week its weight is multiplied
 * by this, so favoring phase-matching recipes does not serve the same dish every day.
 */
export const REPEAT_DECAY = 0.35;

/**
 * Picks one item with probability proportional to its weight. `random` returns a
 * number in [0, 1) (Math.random by default; injectable for tests). Falls back to a
 * uniform pick when every weight is zero.
 */
export function pickWeightedRecipe<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  random: () => number = Math.random
): T | null {
  if (items.length === 0) return null;
  const weights = items.map((item) => {
    const weight = weightOf(item);
    return Number.isFinite(weight) && weight > 0 ? weight : 0;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return items[Math.min(items.length - 1, Math.floor(random() * items.length))] ?? null;
  }
  let remaining = random() * total;
  for (let index = 0; index < items.length; index += 1) {
    remaining -= weights[index];
    if (remaining < 0) return items[index];
  }
  return items[items.length - 1];
}

export interface PlannerRecipe extends RecipeForMealPick {
  leanRole?: string | null;
}

export interface PlanDay {
  /** The Date stored on the meal plan item. */
  date: Date;
  /** The same calendar day as `YYYY-MM-DD`. */
  dateKey: string;
  /** Estimated phase of the person generating the plan; null when unknown. */
  phase: CyclePhase | null;
}

export interface PlannedMeal<T> {
  date: Date;
  dateKey: string;
  mealType: MealType;
  recipe: T;
  phase: CyclePhase | null;
  /** Picked while the recipe matched the day's phase. */
  matched: boolean;
}

/** Phase match the generator acts on. Treats are never pushed into a plan. */
export function getPlannerPhaseMatch(
  recipe: PlannerRecipe,
  profile: RecipeBioProfile | null | undefined,
  phase: CyclePhase | null
): BiologicalMatch | null {
  if (normalizeLeanRole(recipe.leanRole) === 'Treat') return null;
  return getBiologicalMatch(profile, phase);
}

export interface PlanMealSlotsInput<T extends PlannerRecipe> {
  days: readonly PlanDay[];
  recipes: T[];
  existingSlots: Set<string>;
  /** Recipe ids already planned in the same week, for variety. */
  plannedRecipeIds?: readonly string[];
  /** Phase profiles by recipe id. Leave out to plan without cycle alignment. */
  profiles?: ReadonlyMap<string, RecipeBioProfile> | null;
  random?: () => number;
}

export type PlanMealSlotsResult<T> =
  | { ok: true; meals: PlannedMeal<T>[] }
  | { ok: false; mealType: MealType };

/**
 * Fills every empty breakfast/lunch/dinner slot. The existing rules stay as they were:
 * the caller filters by diet, cuisine and avoided ingredients, planned slots are
 * skipped, and meal types prefer matching categories. Selection is weighted: phase
 * matches are favored when `profiles` is given, and repeats are discouraged.
 */
export function planMealSlots<T extends PlannerRecipe>(
  input: PlanMealSlotsInput<T>
): PlanMealSlotsResult<T> {
  const random = input.random ?? Math.random;
  const uses = new Map<string, number>();
  for (const id of input.plannedRecipeIds ?? []) {
    uses.set(id, (uses.get(id) ?? 0) + 1);
  }

  const meals: PlannedMeal<T>[] = [];
  for (const day of input.days) {
    const phase = input.profiles ? day.phase : null;
    const matchOf = (recipe: T) =>
      getPlannerPhaseMatch(recipe, input.profiles?.get(recipe.id), phase);

    for (const mealType of MEAL_TYPES) {
      if (isSlotFilled(input.existingSlots, day.date, mealType)) continue;

      const pool = filterRecipesForMealType(input.recipes, mealType);
      const recipe = pickWeightedRecipe(
        pool,
        (candidate) => {
          const match = matchOf(candidate);
          const phaseWeight = match ? 1 + PHASE_MATCH_BONUS * match.strength : 1;
          return phaseWeight * REPEAT_DECAY ** (uses.get(candidate.id) ?? 0);
        },
        random
      );
      if (!recipe) return { ok: false, mealType };

      uses.set(recipe.id, (uses.get(recipe.id) ?? 0) + 1);
      meals.push({
        date: day.date,
        dateKey: day.dateKey,
        mealType,
        recipe,
        phase,
        matched: matchOf(recipe) !== null,
      });
    }
  }
  return { ok: true, meals };
}

export interface PhaseAlignmentSummary {
  phase: CyclePhase;
  /** Calendar days (YYYY-MM-DD) in this phase that received new meals. */
  dateKeys: string[];
  plannedMeals: number;
  matchedMeals: number;
  focus: NutrientHighlight[];
  headline: string;
  /** False when no available recipe suits this phase (those days were planned as usual). */
  hasMatchingRecipes: boolean;
}

/**
 * "Why these recipes": one entry per phase, in the order the phases occur, for the
 * meals that were just generated. Only ever returned to the person who generated them.
 */
export function summarizeCycleAlignment<T extends PlannerRecipe>(
  meals: readonly PlannedMeal<T>[],
  recipes: readonly T[],
  profiles: ReadonlyMap<string, RecipeBioProfile>
): PhaseAlignmentSummary[] {
  const byPhase = new Map<CyclePhase, PhaseAlignmentSummary>();
  for (const meal of meals) {
    if (!meal.phase) continue;
    const phase = meal.phase;
    let entry = byPhase.get(phase);
    if (!entry) {
      entry = {
        phase,
        dateKeys: [],
        plannedMeals: 0,
        matchedMeals: 0,
        focus: [...PHASE_NUTRITION[phase].focus],
        headline: PHASE_NUTRITION[phase].headline,
        hasMatchingRecipes: recipes.some(
          (recipe) =>
            getPlannerPhaseMatch(recipe, profiles.get(recipe.id), phase) !== null
        ),
      };
      byPhase.set(phase, entry);
    }
    if (!entry.dateKeys.includes(meal.dateKey)) entry.dateKeys.push(meal.dateKey);
    entry.plannedMeals += 1;
    if (meal.matched) entry.matchedMeals += 1;
  }
  return [...byPhase.values()];
}
