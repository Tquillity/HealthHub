'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { endOfWeek, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';

export async function getWeeklyPlan(date?: Date) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) throw new Error('Unauthorized');

  // Get user preferences (with fallback for fields that might not exist yet)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  
  // Extract meal planner preferences (with type safety)
  const mealPlanDuration = (user as any)?.mealPlanDuration || null;
  const mealPlanStartDate = (user as any)?.mealPlanStartDate || null;

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  });

  if (!membership) throw new Error('No household found');

  // Determine start date: use provided date, or user preference, or today
  let startDate: Date;
  if (date) {
    startDate = date;
  } else if (mealPlanStartDate) {
    startDate = new Date(mealPlanStartDate);
  } else {
    startDate = new Date();
    // If using default (today), start from today, not start of week
    startDate.setHours(0, 0, 0, 0);
  }

  // Determine duration: use user preference or default to 1 week
  const duration = mealPlanDuration || '1week';
  
  // Calculate end date based on duration
  let endDate: Date;
  let daysToShow: number;
  
  switch (duration) {
    case '2weeks':
      daysToShow = 14;
      endDate = addDays(startDate, 13);
      break;
    case '1month':
      daysToShow = 30;
      endDate = addDays(startDate, 29);
      break;
    case '1week':
    default:
      daysToShow = 7;
      endDate = addDays(startDate, 6);
      break;
  }

  // If using default (today) and not a custom start date, adjust to show from today forward
  const useDefaultStart = !mealPlanStartDate && !date;
  if (useDefaultStart) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Only adjust if startDate is in the past
    if (startDate < today) {
      startDate = today;
      endDate = addDays(startDate, daysToShow - 1);
    }
  }

  // Find or create meal plan
  let plan = await prisma.mealPlan.findFirst({
    where: {
      organizationId: membership.organizationId,
      startDate: startDate,
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
        startDate: startDate,
        endDate: endDate,
      },
      include: {
        items: { include: { recipe: true } },
      },
    });
  }

  return { 
    plan, 
    recipes: await getAvailableRecipes(membership.organizationId),
    duration,
    startDate,
    endDate,
    useDefaultStart,
  };
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
 * 
 * Non-destructive: Only fills empty meal slots, preserving user's manually planned meals.
 * Filters recipes by dietary restrictions, cuisine preferences, and avoided ingredients.
 * Randomly selects recipes for each meal type (breakfast, lunch, dinner) per day.
 * 
 * @param data - Generation parameters including week start, dietary restrictions, etc.
 * @returns Success status with message indicating how many meals were generated
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

    // Create a Set of existing meal slots (day + mealType) to avoid overwriting
    // This ensures we only fill empty slots and preserve user's manual meal planning
    const existingSlots = new Set<string>();
    for (const item of plan.items) {
      const dayKey = item.date.toISOString().split('T')[0]; // YYYY-MM-DD
      existingSlots.add(`${dayKey}::${item.mealType}`);
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
      // Provide more helpful error message
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

    // Meal types for the week - map to recipe categories
    const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;
    const categoryMap: Record<string, string[]> = {
      breakfast: ['Breakfast', 'breakfast', 'Snack'],
      lunch: ['Lunch', 'lunch', 'Snack'],
      dinner: ['Dinner', 'dinner', 'Main Course'],
    };

    const mealPlanItems: Array<{
      mealPlanId: string;
      recipeId: string;
      date: Date;
      mealType: string;
      servings: number;
    }> = [];

    // Generate meals for each day, only filling empty slots
    for (const day of weekDays) {
      for (const mealType of mealTypes) {
        // Check if this slot is already filled
        const dayKey = day.toISOString().split('T')[0]; // YYYY-MM-DD
        const slotKey = `${dayKey}::${mealType}`;
        
        if (existingSlots.has(slotKey)) {
          // Skip this slot - user has already planned a meal here
          // This preserves manual meal planning work
          continue;
        }

        // Filter recipes by meal type (category)
        const categoryOptions = categoryMap[mealType] || [];
        const recipesForMeal = filteredRecipes.filter((recipe) => {
          if (!recipe.category) return true; // If no category, include it
          return categoryOptions.some(
            (cat) => recipe.category?.toLowerCase() === cat.toLowerCase()
          );
        });

        // If no recipes match the meal type, use all filtered recipes
        const availableRecipes = recipesForMeal.length > 0 
          ? recipesForMeal 
          : filteredRecipes;

        if (availableRecipes.length === 0) {
          return {
            success: false,
            error: `No recipes available for ${mealType}. Please add recipes or adjust your filters.`,
          };
        }

        // Randomly select a recipe
        const randomRecipe =
          availableRecipes[Math.floor(Math.random() * availableRecipes.length)];
        mealPlanItems.push({
          mealPlanId: plan.id,
          recipeId: randomRecipe.id,
          date: day,
          mealType,
          servings: randomRecipe.servings || 4,
        });
      }
    }

    // Create meal plan items only if there are any to add
    // This prevents unnecessary database operations when all slots are filled
    if (mealPlanItems.length > 0) {
      await prisma.mealPlanItem.createMany({
        data: mealPlanItems,
      });
    }

    revalidatePath('/meal-planner');
    return { 
      success: true,
      message: mealPlanItems.length > 0 
        ? `Generated ${mealPlanItems.length} meals for empty slots.`
        : 'All meal slots are already filled. No meals generated.',
    };
  } catch (error) {
    console.error('Error generating meal plan:', error);
    return {
      success: false,
      error: 'Failed to generate meal plan',
    };
  }
}
