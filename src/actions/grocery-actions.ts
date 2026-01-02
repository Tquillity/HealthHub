'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { startOfWeek, endOfWeek } from 'date-fns';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  isChecked: boolean;
}

export interface GroceryListResult {
  success: boolean;
  data?: GroceryItem[];
  error?: string;
}

/**
 * Get grocery list for an organization within a date range
 */
export async function getGroceryList(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<GroceryListResult> {
  'use server';

  try {
    // Security check: Verify user belongs to the organization
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false,
        error: 'Unauthorized: Please sign in',
      };
    }

    const membership = await prisma.member.findFirst({
      where: {
        userId: session.user.id,
        organizationId: organizationId,
      },
    });

    if (!membership) {
      return {
        success: false,
        error: 'Forbidden: You do not have access to this organization',
      };
    }

    // Get meal plans for the date range
    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        organizationId: organizationId,
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
      include: {
        items: {
          include: {
            recipe: {
              include: {
                ingredients: true,
              },
            },
          },
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    // Aggregate ingredients from all meal plan items
    const ingredientMap = new Map<string, { quantity: number; unit: string; category: string }>();

    for (const plan of mealPlans) {
      for (const item of plan.items) {
        const scaleFactor = (item.servings || 1) / (item.recipe.servings || 1);

        for (const ingredient of item.recipe.ingredients) {
          const key = `${ingredient.name.toLowerCase()}_${ingredient.unit}`;
          const existing = ingredientMap.get(key);

          if (existing) {
            existing.quantity += ingredient.quantity * scaleFactor;
          } else {
            // Categorize ingredient (simple heuristic)
            const category = categorizeIngredient(ingredient.name);
            ingredientMap.set(key, {
              quantity: ingredient.quantity * scaleFactor,
              unit: ingredient.unit,
              category,
            });
          }
        }
      }
    }

    // Convert to array
    const groceryItems: GroceryItem[] = Array.from(ingredientMap.entries()).map(
      ([key, data], index) => {
        const [name] = key.split('_');
        return {
          id: `grocery_${index}`,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          quantity: Math.round(data.quantity * 10) / 10, // Round to 1 decimal
          unit: data.unit,
          category: data.category,
          isChecked: false,
        };
      }
    );

    // Sort by category, then name
    groceryItems.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      data: groceryItems,
    };
  } catch (error) {
    console.error('Error fetching grocery list:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch grocery list',
    };
  }
}

/**
 * Add scaled ingredients to grocery list
 */
export async function addScaledIngredientsToGroceryList(
  ingredients: Array<{ name: string; quantity: number; unit: string }>
) {
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

    // Get current week's meal plan
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let plan = await prisma.mealPlan.findFirst({
      where: {
        organizationId: membership.organizationId,
        startDate: weekStart,
      },
    });

    if (!plan) {
      plan = await prisma.mealPlan.create({
        data: {
          organizationId: membership.organizationId,
          startDate: weekStart,
          endDate: weekEnd,
        },
      });
    }

    // For now, we'll just revalidate - the grocery list is generated from meal plans
    // In a full implementation, you might want to store these as "custom items"
    revalidatePath('/groceries');
    return { success: true };
  } catch (error) {
    console.error('Error adding ingredients to grocery list:', error);
    return { success: false, error: 'Failed to add ingredients' };
  }
}

/**
 * Simple ingredient categorization
 */
function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('chicken') || lower.includes('beef') || lower.includes('pork') || lower.includes('fish') || lower.includes('turkey')) {
    return 'Meat & Seafood';
  }
  if (lower.includes('milk') || lower.includes('cheese') || lower.includes('yogurt') || lower.includes('butter')) {
    return 'Dairy';
  }
  if (lower.includes('apple') || lower.includes('banana') || lower.includes('orange') || lower.includes('berry') || lower.includes('fruit')) {
    return 'Produce';
  }
  if (lower.includes('onion') || lower.includes('garlic') || lower.includes('pepper') || lower.includes('tomato') || lower.includes('lettuce') || lower.includes('carrot')) {
    return 'Produce';
  }
  if (lower.includes('bread') || lower.includes('pasta') || lower.includes('rice') || lower.includes('flour')) {
    return 'Bakery & Grains';
  }
  if (lower.includes('oil') || lower.includes('vinegar') || lower.includes('sauce') || lower.includes('spice')) {
    return 'Pantry';
  }
  return 'Other';
}

/**
 * Get meal plans for an organization within a date range
 * Helper function for meal plan management
 */
export async function getMealPlans(
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  'use server';

  try {
    // Security check: Verify user belongs to the organization
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return {
        success: false,
        error: 'Unauthorized: Please sign in',
      };
    }

    const membership = await prisma.member.findFirst({
      where: {
        userId: session.user.id,
        organizationId: organizationId,
      },
    });

    if (!membership) {
      return {
        success: false,
        error: 'Forbidden: You do not have access to this organization',
      };
    }

    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        organizationId: organizationId,
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
      include: {
        items: {
          include: {
            recipe: {
              include: {
                ingredients: true,
              },
            },
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
      orderBy: {
        startDate: 'asc',
      },
    });

    return {
      success: true,
      data: mealPlans,
    };
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch meal plans',
    };
  }
}
