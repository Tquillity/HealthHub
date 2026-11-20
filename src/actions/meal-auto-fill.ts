'use server';

import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { endOfWeek, startOfWeek, eachDayOfInterval, format } from 'date-fns';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { buildRecipeVisibilityFilter } from '@/actions/recipe-shared';
import {
  buildExistingSlotSet,
  planMealSlots,
  recipeMatchesAvoidList,
  summarizeCycleAlignment,
  type PhaseAlignmentSummary,
} from '@/lib/meal-auto-fill';
import { DateOnlyStringSchema, dateOnlyToLocalDate } from '@/lib/date-only';
import {
  buildPhaseCalendar,
  getMealCycleSettings,
  hasCycleEstimate,
} from '@/lib/meal-cycle-alignment';
import { resolveRecipeBioProfile, type RecipeBioProfile } from '@/lib/phase-nutrition';

const OptionList = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).default([]);

const GenerateMealPlanSchema = z.object({
  weekStart: DateOnlyStringSchema,
  dietaryRestrictions: OptionList(30, 50),
  healthGoals: OptionList(30, 50),
  cuisinePreferences: OptionList(30, 50),
  avoidIngredients: OptionList(50, 100),
  /** "Align with cycle phase" toggle. Omitted when the toggle is not shown. */
  alignWithCycle: z.boolean().optional(),
});

export type GenerateMealPlanInput = z.input<typeof GenerateMealPlanSchema>;

export interface GenerateMealPlanData {
  generated: number;
  /** "Why these recipes", per phase. Null when the plan was not cycle-aligned. */
  cycleAlignment: PhaseAlignmentSummary[] | null;
}

/**
 * Server action: auto-fill empty meal-plan slots.
 * Pure selection logic lives in `@/lib/meal-auto-fill` (Vitest-covered).
 *
 * With "Align with cycle phase" on (saved per user), each day's estimated phase comes
 * from the caller's own cycle settings and phase-matching recipes are favored. The
 * explanation is returned to the caller only; nothing about the cycle is stored on the
 * shared household plan.
 */
export async function generateMealPlan(
  input: GenerateMealPlanInput
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  data?: GenerateMealPlanData;
}> {
  try {
    const parsed = GenerateMealPlanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid meal plan options',
      };
    }
    const data = parsed.data;

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

    // Cycle data of the person generating the plan only, never another household member's.
    const cycleSettings = await getMealCycleSettings(authResult.userId);
    if (
      cycleSettings &&
      data.alignWithCycle !== undefined &&
      data.alignWithCycle !== cycleSettings.alignMealsWithCycle
    ) {
      await prisma.user.update({
        where: { id: authResult.userId },
        data: { alignMealsWithCycle: data.alignWithCycle },
      });
    }
    const alignWithCycle =
      (data.alignWithCycle ?? cycleSettings?.alignMealsWithCycle ?? false) &&
      hasCycleEstimate(cycleSettings);

    const allDietaryRestrictions = Array.from(
      new Set([...(user?.dietaryRestrictions || []), ...data.dietaryRestrictions])
    );

    // Local midnight of the chosen calendar day (identical to the previous
    // `new Date(weekStart).setHours(0, 0, 0, 0)` on the UTC production server).
    const weekStart = dateOnlyToLocalDate(data.weekStart);
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

    // Same visibility rules as the recipe pages (hides secret/private recipes)
    const recipeWhere: Prisma.RecipeWhereInput = {
      AND: [await buildRecipeVisibilityFilter(authResult.userId)],
    };

    // Every restriction must be satisfied (e.g. vegan AND gluten-free), not just one of them
    if (allDietaryRestrictions.length > 0) {
      recipeWhere.dietaryTags = { hasEvery: allDietaryRestrictions };
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

    // Days are planned on the server's calendar (the dates stored on the items), so
    // their keys use the same local calendar day.
    const dayKeys = weekDays.map((day) => format(day, 'yyyy-MM-dd'));
    const phaseCalendar = alignWithCycle ? buildPhaseCalendar(cycleSettings, dayKeys) : {};
    const profiles: Map<string, RecipeBioProfile> | null = alignWithCycle
      ? new Map(
          filteredRecipes.map((recipe) => [recipe.id, resolveRecipeBioProfile(recipe)])
        )
      : null;

    const planned = planMealSlots({
      days: weekDays.map((day, index) => ({
        date: day,
        dateKey: dayKeys[index],
        phase: phaseCalendar[dayKeys[index]] ?? null,
      })),
      recipes: filteredRecipes,
      existingSlots,
      plannedRecipeIds: plan.items.map((item) => item.recipeId),
      profiles,
    });

    if (!planned.ok) {
      return {
        success: false,
        error: `No recipes available for ${planned.mealType}. Please add recipes or adjust your filters.`,
      };
    }

    const planId = plan.id;
    const mealPlanItems = planned.meals.map((meal) => ({
      mealPlanId: planId,
      recipeId: meal.recipe.id,
      date: meal.date,
      mealType: meal.mealType,
      servings: meal.recipe.servings || 4,
    }));

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
      data: {
        generated: mealPlanItems.length,
        cycleAlignment: profiles
          ? summarizeCycleAlignment(planned.meals, filteredRecipes, profiles)
          : null,
      },
    };
  } catch (error) {
    console.error('[HealthHub action] meal-auto-fill generateMealPlan:', error);
    return {
      success: false,
      error: 'Failed to generate meal plan',
    };
  }
}
