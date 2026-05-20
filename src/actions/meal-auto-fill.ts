'use server';

import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { endOfWeek, startOfWeek, eachDayOfInterval } from 'date-fns';
import type { Prisma } from '@prisma/client';
import {
  MEAL_TYPES,
  buildExistingSlotSet,
  filterRecipesForMealType,
  isSlotFilled,
  pickRandomRecipe,
  recipeMatchesAvoidList,
  type MealType,
} from '@/lib/meal-auto-fill';

/**
 * Server action: auto-fill empty meal-plan slots.
 * Pure selection logic lives in `@/lib/meal-auto-fill` (Vitest-covered).
 */
export async function generateMealPlan(data: {
  weekStart: string;
  dietaryRestrictions: string[];
  healthGoals: string[];
  cuisinePreferences: string[];
  avoidIngredients: string[];
}) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { dietaryRestrictions: true, healthGoals: true },
    });

    const allDietaryRestrictions = [
      ...(user?.dietaryRestrictions || []),
      ...data.dietaryRestrictions,
    ];

    const weekStart = new Date(data.weekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    let plan = await prisma.mealPlan.findFirst({
      where: {
        organizationId: membership.organizationId,
        startDate: startOfWeek(weekStart, { weekStartsOn: 1 }),
      },
      include: {
        items: {
          where: {
            date: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        },
      },
    });

    if (!plan) {
      plan = await prisma.mealPlan.create({
        data: {
          organizationId: membership.organizationId,
          startDate: startOfWeek(weekStart, { weekStartsOn: 1 }),
          endDate: weekEnd,
        },
        include: {
          items: true,
        },
      });
    }

    const existingSlots = buildExistingSlotSet(plan.items);

    const recipeWhere: Prisma.RecipeWhereInput = {
      OR: [{ isSystem: true }, { organizationId: membership.organizationId }],
    };

    if (allDietaryRestrictions.length > 0) {
      recipeWhere.dietaryTags = { hasSome: allDietaryRestrictions };
    }

    if (data.cuisinePreferences.length > 0) {
      recipeWhere.cuisine = { in: data.cuisinePreferences };
    }

    const availableRecipes = await prisma.recipe.findMany({
      where: recipeWhere,
      include: { ingredients: true },
    });

    const filteredRecipes = availableRecipes.filter((recipe) => {
      const names = recipe.ingredients.map((ing) => ing.name.toLowerCase());
      return !recipeMatchesAvoidList(names, data.avoidIngredients);
    });

    if (filteredRecipes.length === 0) {
      let errorMsg = 'No recipes match your preferences.';
      if (allDietaryRestrictions.length > 0) {
        errorMsg += ` No recipes found with dietary restrictions: ${allDietaryRestrictions.join(', ')}.`;
      }
      if (data.cuisinePreferences.length > 0) {
        errorMsg += ` No recipes found for cuisines: ${data.cuisinePreferences.join(', ')}.`;
      }
      errorMsg += ' Try adjusting your filters or adding more recipes.';
      return {
        success: false,
        error: errorMsg,
      };
    }

    const mealPlanItems: Array<{
      mealPlanId: string;
      recipeId: string;
      date: Date;
      mealType: string;
      servings: number;
    }> = [];

    for (const day of weekDays) {
      for (const mealType of MEAL_TYPES) {
        if (isSlotFilled(existingSlots, day, mealType)) {
          continue;
        }

        const recipesForMeal = filterRecipesForMealType(
          filteredRecipes,
          mealType as MealType
        );

        if (recipesForMeal.length === 0) {
          return {
            success: false,
            error: `No recipes available for ${mealType}. Please add recipes or adjust your filters.`,
          };
        }

        const randomRecipe = pickRandomRecipe(recipesForMeal);
        if (!randomRecipe) {
          return {
            success: false,
            error: `No recipes available for ${mealType}. Please add recipes or adjust your filters.`,
          };
        }

        mealPlanItems.push({
          mealPlanId: plan.id,
          recipeId: randomRecipe.id,
          date: day,
          mealType,
          servings: randomRecipe.servings || 4,
        });
      }
    }

    if (mealPlanItems.length > 0) {
      await prisma.mealPlanItem.createMany({
        data: mealPlanItems,
      });
    }

    revalidatePath('/meal-planner');
    return {
      success: true,
      message:
        mealPlanItems.length > 0
          ? `Generated ${mealPlanItems.length} meals for empty slots.`
          : 'All meal slots are already filled. No meals generated.',
    };
  } catch (error) {
    console.error('[HealthHub action] meal-auto-fill generateMealPlan:', error);
    return {
      success: false,
      error: 'Failed to generate meal plan',
    };
  }
}
