'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { endOfWeek, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';

export async function getWeeklyPlan(date = new Date()) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error('Unauthorized');

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  });

  if (!membership) throw new Error('No household found');

  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });

  let plan = await prisma.mealPlan.findFirst({
    where: {
      organizationId: membership.organizationId,
      startDate: start,
    },
    include: {
      items: {
        include: { recipe: true },
      },
    },
  });

  if (!plan) {
    plan = await prisma.mealPlan.create({
      data: {
        organizationId: membership.organizationId,
        startDate: start,
        endDate: end,
      },
      include: {
        items: { include: { recipe: true } },
      },
    });
  }

  return { plan, recipes: await getAvailableRecipes(membership.organizationId) };
}

async function getAvailableRecipes(orgId: string) {
  return await prisma.recipe.findMany({
    where: {
      OR: [{ isSystem: true }, { organizationId: orgId }],
    },
    select: { id: true, name: true, category: true, imageUrl: true },
  });
}

export async function addMealToPlan(
  planId: string,
  recipeId: string,
  dateStr: string,
  mealType: string
) {
  try {
    const date = new Date(dateStr);

    await prisma.mealPlanItem.create({
      data: {
        mealPlanId: planId,
        recipeId,
        date,
        mealType,
        servings: 4,
      },
    });

    revalidatePath('/meal-planner');
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to add meal' };
  }
}

export async function removeMealFromPlan(itemId: string) {
  try {
    await prisma.mealPlanItem.delete({
      where: { id: itemId },
    });
    revalidatePath('/meal-planner');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

/**
 * Generate a meal plan based on user preferences
 */
export async function generateMealPlan(data: {
  weekStart: string;
  dietaryRestrictions: string[];
  healthGoals: string[];
  cuisinePreferences: string[];
  avoidIngredients: string[];
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    const membership = await prisma.member.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Get user preferences (from User model)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dietaryRestrictions: true, healthGoals: true },
    });

    // Combine form data with user preferences
    const allDietaryRestrictions = [
      ...(user?.dietaryRestrictions || []),
      ...data.dietaryRestrictions,
    ];
    const allHealthGoals = [...(user?.healthGoals || []), ...data.healthGoals];

    // Calculate week dates
    const weekStart = new Date(data.weekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Find or create meal plan
    let plan = await prisma.mealPlan.findFirst({
      where: {
        organizationId: membership.organizationId,
        startDate: startOfWeek(weekStart, { weekStartsOn: 1 }),
      },
    });

    if (!plan) {
      plan = await prisma.mealPlan.create({
        data: {
          organizationId: membership.organizationId,
          startDate: startOfWeek(weekStart, { weekStartsOn: 1 }),
          endDate: weekEnd,
        },
      });
    } else {
      // Clear existing items
      await prisma.mealPlanItem.deleteMany({
        where: { mealPlanId: plan.id },
      });
    }

    // Build recipe filter
    const recipeWhere: any = {
      OR: [{ isSystem: true }, { organizationId: membership.organizationId }],
    };

    // Filter by dietary restrictions
    if (allDietaryRestrictions.length > 0) {
      recipeWhere.dietaryTags = { hasSome: allDietaryRestrictions };
    }

    // Filter by cuisine preferences
    if (data.cuisinePreferences.length > 0) {
      recipeWhere.cuisine = { in: data.cuisinePreferences };
    }

    // Get available recipes
    const availableRecipes = await prisma.recipe.findMany({
      where: recipeWhere,
      include: { ingredients: true },
    });

    // Filter out recipes with avoided ingredients
    const filteredRecipes = availableRecipes.filter((recipe) => {
      if (data.avoidIngredients.length === 0) return true;
      const recipeIngredientNames = recipe.ingredients.map((ing) =>
        ing.name.toLowerCase()
      );
      return !data.avoidIngredients.some((avoid) =>
        recipeIngredientNames.some((name) => name.includes(avoid.toLowerCase()))
      );
    });

    if (filteredRecipes.length === 0) {
      return {
        success: false,
        error: 'No recipes match your preferences. Try adjusting your filters.',
      };
    }

    // Meal types for the week
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    const mealPlanItems: Array<{
      mealPlanId: string;
      recipeId: string;
      date: Date;
      mealType: string;
      servings: number;
    }> = [];

    // Generate meals for each day
    for (const day of weekDays) {
      for (const mealType of mealTypes) {
        // Randomly select a recipe (can be improved with better algorithm)
        const randomRecipe =
          filteredRecipes[Math.floor(Math.random() * filteredRecipes.length)];
        mealPlanItems.push({
          mealPlanId: plan.id,
          recipeId: randomRecipe.id,
          date: day,
          mealType,
          servings: randomRecipe.servings || 4,
        });
      }
    }

    // Create all meal plan items
    await prisma.mealPlanItem.createMany({
      data: mealPlanItems,
    });

    revalidatePath('/meal-planner');
    return { success: true };
  } catch (error) {
    console.error('Error generating meal plan:', error);
    return {
      success: false,
      error: 'Failed to generate meal plan',
    };
  }
}
