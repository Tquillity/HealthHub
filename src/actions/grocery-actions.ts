'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { startOfWeek, endOfWeek } from 'date-fns';

// Type for aggregated grocery item (matches GroceryListClient expectations)
export interface GroceryItem {
  id?: string; // ShoppingListItem ID if from shopping list, undefined for meal plan items
  name: string;
  unit: string;
  totalQuantity: number;
  isChecked?: boolean; // Only for ShoppingListItem entries
  recipes: Array<{
    recipeName: string;
    quantity: number;
    mealType: string;
    date: Date;
  }>;
}

export interface GroceryListResult {
  success: boolean;
  data?: GroceryItem[];
  error?: string;
}

/**
 * Get grocery list for an organization within a date range
 * 
 * Aggregates ingredients from meal plans and merges with shopping list items.
 * Applies unit normalization (cups→ml, oz→g) to merge duplicate ingredients.
 * Tracks which recipes use each ingredient for display purposes.
 * 
 * @param organizationId - The organization (household) ID
 * @param startDate - Start date for the meal plan range
 * @param endDate - End date for the meal plan range
 * @returns Aggregated grocery list with ingredients grouped by normalized name+unit
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
    const mealPlanItems = await prisma.mealPlanItem.findMany({
      where: {
        mealPlan: {
          organizationId: organizationId,
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        recipe: {
          include: {
            ingredients: true,
          },
        },
        mealPlan: true,
      },
    });

    // Aggregate ingredients with unit normalization and recipe tracking
    // Key format: normalizedName_normalizedUnit (e.g., "rice_ml", "chicken_g")
    // This enables merging duplicate ingredients with different unit representations
    const ingredientMap = new Map<string, GroceryItem>();

    for (const item of mealPlanItems) {
      const recipe = item.recipe;
      // Calculate servings multiplier to scale ingredient quantities
      const servingsMultiplier = item.servings / (recipe.servings || 1);

      for (const ingredient of recipe.ingredients) {
        // Normalize unit for better aggregation (cups→ml, oz→g, etc.)
        const normalized = normalizeUnit(ingredient.quantity * servingsMultiplier, ingredient.unit);
        const key = `${ingredient.name.toLowerCase()}_${normalized.unit.toLowerCase()}`;
        
        const adjustedQuantity = normalized.quantity;

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          existing.totalQuantity += adjustedQuantity;
          existing.recipes.push({
            recipeName: recipe.name,
            quantity: adjustedQuantity,
            mealType: item.mealType,
            date: item.date,
          });
        } else {
          ingredientMap.set(key, {
            name: ingredient.name.charAt(0).toUpperCase() + ingredient.name.slice(1),
            unit: normalized.unit,
            totalQuantity: adjustedQuantity,
            recipes: [
              {
                recipeName: recipe.name,
                quantity: adjustedQuantity,
                mealType: item.mealType,
                date: item.date,
              },
            ],
          });
        }
      }
    }

    // Get all shopping list items (both checked and unchecked) and merge them
    const shoppingListItems = await prisma.shoppingListItem.findMany({
      where: {
        organizationId: organizationId,
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });

    // Add shopping list items to the map (they merge with meal plan items if same name+unit)
    // ShoppingListItem entries take precedence for checked state and are included in aggregation
    for (const item of shoppingListItems) {
      const normalized = normalizeUnit(item.quantity, item.unit);
      const key = `${item.name.toLowerCase()}_${normalized.unit.toLowerCase()}`;
      
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalQuantity += normalized.quantity;
        // Preserve ID and checked state if this is a ShoppingListItem
        if (!existing.id && item.id) {
          existing.id = item.id;
          existing.isChecked = item.isChecked;
        }
        // Add a "manual" recipe entry for shopping list items
        existing.recipes.push({
          recipeName: 'Manual Entry',
          quantity: normalized.quantity,
          mealType: 'other',
          date: item.sourceDate || new Date(),
        });
      } else {
        ingredientMap.set(key, {
          id: item.id, // Include ShoppingListItem ID for persistence
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
          unit: normalized.unit,
          totalQuantity: normalized.quantity,
          isChecked: item.isChecked, // Include checked state
          recipes: [
            {
              recipeName: 'Manual Entry',
              quantity: normalized.quantity,
              mealType: 'other',
              date: item.sourceDate || new Date(),
            },
          ],
        });
      }
    }

    // Convert map to array and sort by name
    const groceryList = Array.from(ingredientMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return {
      success: true,
      data: groceryList,
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
 * Toggle shopping list item checked status
 * 
 * Persists checkbox state for ShoppingListItem entries in the database.
 * Meal plan items (aggregated ingredients) don't have IDs and remain local-only.
 * Uses optimistic updates in the UI for instant feedback.
 * 
 * @param itemKey - ShoppingListItem ID or meal plan item key
 * @param isChecked - New checked state
 * @returns Success status
 */
export async function toggleShoppingItem(
  itemKey: string,
  isChecked: boolean
): Promise<{ success: boolean; error?: string }> {
  'use server';

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

    // Item key format: "meal-plan_0" or actual ShoppingListItem ID
    if (itemKey.startsWith('meal-plan_')) {
      // This is a meal plan item - we can't persist its checked state directly
      // Instead, we could create a ShoppingListItem for it, but for now just return success
      // The UI will handle local state for meal plan items
      return { success: true };
    }

    // Update ShoppingListItem
    await prisma.shoppingListItem.update({
      where: { id: itemKey },
      data: { isChecked },
    });

    revalidatePath('/groceries');
    return { success: true };
  } catch (error) {
    console.error('Error toggling shopping item:', error);
    return { success: false, error: 'Failed to update item' };
  }
}

/**
 * Add scaled ingredients to grocery list as unplanned items
 */
export async function addScaledIngredientsToGroceryList(
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  sourceRecipeId?: string
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

    // Create ShoppingListItem entries for each ingredient
    const items = await Promise.all(
      ingredients.map((ingredient) =>
        prisma.shoppingListItem.create({
          data: {
            organizationId: membership.organizationId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            category: categorizeIngredient(ingredient.name),
            source: 'recipe-scaler',
            sourceRecipeId: sourceRecipeId || null,
            sourceDate: new Date(),
            isChecked: false,
          },
        })
      )
    );

    revalidatePath('/groceries');
    return { success: true, data: items };
  } catch (error) {
    console.error('Error adding ingredients to grocery list:', error);
    return { success: false, error: 'Failed to add ingredients' };
  }
}

/**
 * Normalize units to standard forms for better aggregation
 * 
 * Converts common volumes (tsp, tbsp, cup, fl oz, etc.) to 'ml' and 
 * weights (oz, lb, kg) to 'g' to enable merging of duplicate ingredients
 * with different unit representations (e.g., "1 cup Rice" and "200ml Rice").
 * 
 * Non-standard units (piece, whole, etc.) are kept as-is.
 * 
 * @param quantity - Original quantity
 * @param unit - Original unit string
 * @returns Normalized quantity and unit
 */
function normalizeUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const lowerUnit = unit.toLowerCase().trim();
  
  // Volume conversions to ml
  const volumeConversions: Record<string, number> = {
    'tsp': 4.92892,
    'teaspoon': 4.92892,
    'teaspoons': 4.92892,
    'tbsp': 14.7868,
    'tablespoon': 14.7868,
    'tablespoons': 14.7868,
    'cup': 236.588,
    'cups': 236.588,
    'fl oz': 29.5735,
    'fluid ounce': 29.5735,
    'fluid ounces': 29.5735,
    'pint': 473.176,
    'pints': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'gallon': 3785.41,
    'gallons': 3785.41,
    'liter': 1000,
    'liters': 1000,
    'l': 1000,
  };
  
  // Weight conversions to g
  const weightConversions: Record<string, number> = {
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592,
    'kg': 1000,
    'kilogram': 1000,
    'kilograms': 1000,
  };
  
  // Check if it's a volume unit
  if (volumeConversions[lowerUnit]) {
    return {
      quantity: quantity * volumeConversions[lowerUnit],
      unit: 'ml',
    };
  }
  
  // Check if it's a weight unit
  if (weightConversions[lowerUnit]) {
    return {
      quantity: quantity * weightConversions[lowerUnit],
      unit: 'g',
    };
  }
  
  // If already in ml or g, return as-is
  if (lowerUnit === 'ml' || lowerUnit === 'g') {
    return { quantity, unit: lowerUnit };
  }
  
  // For other units (piece, whole, etc.), keep original
  return { quantity, unit };
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
