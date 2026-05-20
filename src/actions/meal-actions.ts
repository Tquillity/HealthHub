/**
 * Meal plan actions — public barrel only (no logic).
 *
 * - Queries: `./meal-plan-queries.ts`
 * - Mutations + templates: `./meal-plan-mutations.ts`
 * - Auto-fill server action: `./meal-auto-fill.ts` (Prisma/session; calls `@/lib/meal-auto-fill` for pure logic)
 */
export { getWeeklyPlan, getMealPlanTemplates } from './meal-plan-queries';
export { generateMealPlan } from './meal-auto-fill';
export {
  addMealToPlan,
  removeMealFromPlan,
  clearAllMeals,
  saveMealPlanAsTemplate,
  deleteMealPlanTemplate,
  duplicateMealPlanTemplate,
  applyMealPlanTemplate,
  updateMealPlanTemplate,
  shareMealPlanTemplate,
} from './meal-plan-mutations';
