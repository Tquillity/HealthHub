'use server';

import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import { endOfWeek, startOfWeek, addDays, eachDayOfInterval } from 'date-fns';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

export async function getWeeklyPlan(date?: Date) {
  const authResult = await requireSessionUserId();
  if (!authResult.ok) throw new Error('Unauthorized');

  // Get user preferences (with fallback for fields that might not exist yet)
  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: {
      mealPlanDuration: true,
      mealPlanStartDate: true,
    },
  });

  const mealPlanDuration = user?.mealPlanDuration ?? null;
  const mealPlanStartDate = user?.mealPlanStartDate ?? null;

  const membership = await prisma.member.findFirst({
    where: { userId: authResult.userId },
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
  } catch {
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

    // Get user preferences (from User model)
    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { dietaryRestrictions: true, healthGoals: true },
    });

    // Combine form data with user preferences
    const allDietaryRestrictions = [
      ...(user?.dietaryRestrictions || []),
      ...data.dietaryRestrictions,
    ];
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
    const recipeWhere: Prisma.RecipeWhereInput = {
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

/**
 * Clear all meals from a meal plan
 * 
 * Removes all MealPlanItem records associated with the specified meal plan.
 * Performs security checks to ensure the plan belongs to the user's organization
 * before deletion. This is a destructive operation that cannot be undone.
 * 
 * @param planId - The ID of the meal plan to clear
 * @returns Success status with error message if operation fails
 */
export async function clearAllMeals(planId: string) {
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

    // Verify the plan belongs to the user's organization
    const plan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        organizationId: membership.organizationId,
      },
    });

    if (!plan) {
      return { success: false, error: 'Meal plan not found' };
    }

    // Delete all items from the plan
    await prisma.mealPlanItem.deleteMany({
      where: { mealPlanId: planId },
    });

    revalidatePath('/meal-planner');
    return { success: true };
  } catch (error) {
    console.error('Error clearing meals:', error);
    return {
      success: false,
      error: 'Failed to clear meals',
    };
  }
}

const SaveTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  planId: z.string(),
});

/**
 * Save current meal plan as a reusable template
 * 
 * Converts the current meal plan into a template that can be applied to future weeks.
 * Stores meal items with day offsets (relative to start date) rather than absolute dates,
 * allowing the template to be applied to any start date. This enables users to save
 * successful meal plans and reuse them across different weeks.
 * 
 * The template includes:
 * - Template name and optional description
 * - All meal plan items converted to day offsets
 * - Association with the user's organization
 * 
 * @param data - Template data including planId, name, and optional description
 * @returns Success status with created template data, or error message
 */
export async function saveMealPlanAsTemplate(
  data: z.infer<typeof SaveTemplateSchema>
) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const validated = SaveTemplateSchema.parse(data);

    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Get the meal plan with items
    const plan = await prisma.mealPlan.findFirst({
      where: {
        id: validated.planId,
        organizationId: membership.organizationId,
      },
      include: {
        items: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!plan) {
      return { success: false, error: 'Meal plan not found' };
    }

    if (plan.items.length === 0) {
      return { success: false, error: 'Cannot save an empty meal plan as template' };
    }

    // Calculate day offsets from start date
    const startDate = new Date(plan.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Create template
    const template = await prisma.mealPlanTemplate.create({
      data: {
        name: validated.name,
        description: validated.description || null,
        organizationId: membership.organizationId,
        createdById: authResult.userId,
        items: {
          create: plan.items.map((item) => {
            const itemDate = new Date(item.date);
            itemDate.setHours(0, 0, 0, 0);
            const dayOffset = Math.floor(
              (itemDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
              recipeId: item.recipeId,
              dayOffset,
              mealType: item.mealType,
              servings: item.servings,
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    revalidatePath('/meal-planner');
    revalidatePath('/meal-planner/templates');
    return { success: true, data: template };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation error',
      };
    }
    console.error('Error saving template:', error);
    return {
      success: false,
      error: 'Failed to save template',
    };
  }
}

/**
 * Get all meal plan templates for the user's organization
 * 
 * Retrieves all meal plan templates that belong to the user's organization (household).
 * Returns templates with their associated items, including recipe details for display.
 * Templates are ordered by most recently updated first.
 * 
 * @returns Success status with array of templates including items and recipe details
 */
export async function getMealPlanTemplates() {
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

    const templates = await prisma.mealPlanTemplate.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      include: {
        items: {
          include: {
            recipe: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                category: true,
              },
            },
          },
          orderBy: [
            { dayOffset: 'asc' },
            { mealType: 'asc' },
          ],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return { success: true, data: templates };
  } catch (error) {
    console.error('Error fetching templates:', error);
    return {
      success: false,
      error: 'Failed to fetch templates',
    };
  }
}

/**
 * Delete a meal plan template
 * 
 * Permanently removes a meal plan template from the database. Performs security checks
 * to ensure the template belongs to the user's organization before deletion.
 * This is a destructive operation that cannot be undone.
 * 
 * @param templateId - The ID of the template to delete
 * @returns Success status with error message if operation fails
 */
export async function deleteMealPlanTemplate(templateId: string) {
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

    // Verify template belongs to organization
    const template = await prisma.mealPlanTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: membership.organizationId,
      },
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    await prisma.mealPlanTemplate.delete({
      where: { id: templateId },
    });

    revalidatePath('/meal-planner/templates');
    return { success: true };
  } catch (error) {
    console.error('Error deleting template:', error);
    return {
      success: false,
      error: 'Failed to delete template',
    };
  }
}

/**
 * Duplicate a meal plan template
 * 
 * Creates a copy of an existing meal plan template with all its items.
 * The duplicate is named "{Original Name} (Copy)" and belongs to the same organization.
 * Useful for creating variations of existing templates without modifying the original.
 * 
 * @param templateId - The ID of the template to duplicate
 * @returns Success status with the new duplicate template data, or error message
 */
export async function duplicateMealPlanTemplate(templateId: string) {
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

    // Get the original template
    const original = await prisma.mealPlanTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: membership.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!original) {
      return { success: false, error: 'Template not found' };
    }

    // Create a duplicate
    const duplicate = await prisma.mealPlanTemplate.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        organizationId: membership.organizationId,
        createdById: authResult.userId,
        items: {
          create: original.items.map((item) => ({
            recipeId: item.recipeId,
            dayOffset: item.dayOffset,
            mealType: item.mealType,
            servings: item.servings,
          })),
        },
      },
      include: {
        items: {
          include: {
            recipe: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                category: true,
              },
            },
          },
        },
      },
    });

    revalidatePath('/meal-planner/templates');
    return { success: true, data: duplicate };
  } catch (error) {
    console.error('Error duplicating template:', error);
    return {
      success: false,
      error: 'Failed to duplicate template',
    };
  }
}

/**
 * Apply a meal plan template to the current meal plan
 * 
 * Applies a saved template to the current meal plan by converting day offsets back to
 * absolute dates based on the provided start date. This replaces all existing items
 * in the meal plan with the template's items.
 * 
 * The process:
 * 1. Validates template and plan belong to user's organization
 * 2. Calculates absolute dates from template's day offsets + start date
 * 3. Deletes existing meal plan items (replacement strategy)
 * 4. Creates new items from template with calculated dates
 * 
 * @param templateId - The ID of the template to apply
 * @param planId - The ID of the meal plan to apply the template to
 * @param startDate - ISO date string for the start date (day offset 0)
 * @returns Success status with error message if operation fails
 */
export async function applyMealPlanTemplate(
  templateId: string,
  planId: string,
  startDate: string
) {
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

    // Get the template
    const template = await prisma.mealPlanTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: membership.organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Verify the plan belongs to the organization
    const plan = await prisma.mealPlan.findFirst({
      where: {
        id: planId,
        organizationId: membership.organizationId,
      },
    });

    if (!plan) {
      return { success: false, error: 'Meal plan not found' };
    }

    // Calculate the base date in UTC to avoid timezone mismatches
    // startDate is expected to be in YYYY-MM-DD format (from client) or ISO string
    // Parse as UTC to ensure consistent behavior across timezones
    let baseDateUTC: Date;
    if (startDate.includes('T')) {
      // Already an ISO string, parse directly
      baseDateUTC = new Date(startDate);
      // Normalize to UTC midnight
      baseDateUTC = new Date(Date.UTC(
        baseDateUTC.getUTCFullYear(),
        baseDateUTC.getUTCMonth(),
        baseDateUTC.getUTCDate()
      ));
    } else {
      // YYYY-MM-DD format, append UTC midnight
      baseDateUTC = new Date(startDate + 'T00:00:00.000Z');
    }

    // Create meal plan items from template
    const itemsToCreate = template.items.map((item) => {
      // Add day offset in UTC to maintain timezone consistency
      const itemDate = new Date(baseDateUTC);
      itemDate.setUTCDate(itemDate.getUTCDate() + item.dayOffset);

      return {
        mealPlanId: planId,
        recipeId: item.recipeId,
        date: itemDate,
        mealType: item.mealType,
        servings: item.servings,
      };
    });

    // Delete existing items first (optional - could also merge)
    await prisma.mealPlanItem.deleteMany({
      where: { mealPlanId: planId },
    });

    // Create new items from template
    if (itemsToCreate.length > 0) {
      await prisma.mealPlanItem.createMany({
        data: itemsToCreate,
      });
    }

    revalidatePath('/meal-planner');
    return { success: true };
  } catch (error) {
    console.error('Error applying template:', error);
    return {
      success: false,
      error: 'Failed to apply template',
    };
  }
}

const UpdateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
});

/**
 * Update a meal plan template's metadata
 * 
 * Updates the name and/or description of an existing meal plan template.
 * Does not modify the template's items - only metadata fields.
 * Performs security checks to ensure the template belongs to the user's organization.
 * 
 * @param data - Update data including template ID, new name, and optional description
 * @returns Success status with updated template data, or error message
 */
export async function updateMealPlanTemplate(
  data: z.infer<typeof UpdateTemplateSchema>
) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const validated = UpdateTemplateSchema.parse(data);

    const membership = await prisma.member.findFirst({
      where: { userId: authResult.userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Verify template belongs to organization
    const template = await prisma.mealPlanTemplate.findFirst({
      where: {
        id: validated.id,
        organizationId: membership.organizationId,
      },
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Update template
    const updated = await prisma.mealPlanTemplate.update({
      where: { id: validated.id },
      data: {
        name: validated.name,
        description: validated.description || null,
      },
    });

    revalidatePath('/meal-planner/templates');
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Validation error',
      };
    }
    console.error('Error updating template:', error);
    return {
      success: false,
      error: 'Failed to update template',
    };
  }
}

/**
 * Generate or retrieve share token for a meal plan template
 * 
 * Creates a unique share token for a template if one doesn't exist, or returns
 * the existing token. This token can be used to create shareable links that allow
 * others to view or import the template (share link functionality).
 * 
 * The share token is a cryptographically secure random hex string (32 characters)
 * that uniquely identifies the template for sharing purposes.
 * 
 * @param templateId - The ID of the template to generate a share token for
 * @returns Success status with share token, or error message
 */
export async function shareMealPlanTemplate(templateId: string) {
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

    // Verify template belongs to organization
    const template = await prisma.mealPlanTemplate.findFirst({
      where: {
        id: templateId,
        organizationId: membership.organizationId,
      },
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Generate share token if it doesn't exist
    let shareToken = template.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(16).toString('hex');
      await prisma.mealPlanTemplate.update({
        where: { id: templateId },
        data: { shareToken },
      });
    }

    return { success: true, data: { shareToken } };
  } catch (error) {
    console.error('Error sharing template:', error);
    return {
      success: false,
      error: 'Failed to generate share link',
    };
  }
}
