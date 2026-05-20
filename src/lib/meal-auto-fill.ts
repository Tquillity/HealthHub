/**
 * Pure helpers for meal-plan auto-fill (no Prisma / session).
 */

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
