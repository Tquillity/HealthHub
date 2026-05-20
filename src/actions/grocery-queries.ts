'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { parseIngredientAlternatives } from '@/lib/ingredient-alternatives';
import { resolveIngredientChoice } from './ingredient-preference-actions';
import {
  buildAggregationKey,
  capitalizeIngredientName,
  isExcludedItem,
  isStapleItem,
  normalizeIngredientName,
  normalizeUnit,
  type GroceryItem,
  type GroceryListResult,
} from '@/lib/grocery-aggregate';

const GroceryListParamsSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

const MealPlansParamsSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

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
    const validated = GroceryListParamsSchema.parse({
      organizationId,
      startDate,
      endDate,
    });
    organizationId = validated.organizationId;
    startDate = validated.startDate;
    endDate = validated.endDate;

    // Security check: Verify user belongs to the organization
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return {
        success: false,
        error: 'Unauthorized: Please sign in',
      };
    }

    const membership = await prisma.member.findFirst({
      where: {
        userId: authResult.userId,
        organizationId: organizationId,
      },
    });

    if (!membership) {
      return {
        success: false,
        error: 'Forbidden: You do not have access to this organization',
      };
    }

    // Optimized: Use SQL to fetch only required data with joins
    // This reduces memory usage compared to loading all nested relations
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
      select: {
        id: true,
        servings: true,
        mealType: true,
        date: true,
        recipe: {
          select: {
            id: true,
            name: true,
            servings: true,
            ingredients: {
              select: {
                id: true,
                name: true,
                quantity: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    // Aggregate ingredients with unit normalization and recipe tracking
    // Key format: normalizedName_normalizedUnit (e.g., "rice_ml", "chicken_g")
    // This enables merging duplicate ingredients with different unit representations
    // 
    // Note: While this uses JS loops, it's optimized by:
    // 1. Using select to fetch only required fields (reduces memory)
    // 2. Processing data in a single pass
    // 3. Unit normalization requires complex logic that's difficult in pure SQL
    // For 500+ meals, consider a database view or materialized view for further optimization
    
    // Collect all ingredient IDs to batch-fetch alternatives
    const allIngredientIds = new Set<string>();
    for (const item of mealPlanItems) {
      for (const ingredient of item.recipe.ingredients) {
        allIngredientIds.add(ingredient.id);
      }
    }
    
    // Batch-fetch all alternatives at once (more efficient than per-ingredient queries)
    const alternativesMap = new Map<string, string[]>();
    try {
      const allAlternatives = await prisma.ingredientAlternative.findMany({
        where: { ingredientId: { in: Array.from(allIngredientIds) } },
        select: { ingredientId: true, name: true, order: true },
        orderBy: { order: 'asc' },
      });
      
      // Group alternatives by ingredient ID
      for (const alt of allAlternatives) {
        if (!alternativesMap.has(alt.ingredientId)) {
          alternativesMap.set(alt.ingredientId, []);
        }
        alternativesMap.get(alt.ingredientId)!.push(alt.name);
      }
    } catch {
      // If alternatives table doesn't exist or relation fails, continue without alternatives
      // This is a graceful fallback - we'll use name parsing instead
      console.warn('Could not fetch alternatives from database, using name parsing fallback');
    }
    
    const ingredientMap = new Map<string, GroceryItem>();

    // First pass: Collect all ingredients that need resolution and batch resolve them
    // This prevents sequential async calls in nested loops, improving performance for large meal plans
    interface IngredientResolutionTask {
      ingredientId: string;
      itemId: string;
      parsed: ReturnType<typeof parseIngredientAlternatives>;
      allAlternatives: string[];
    }

    const resolutionTasks: IngredientResolutionTask[] = [];

    for (const item of mealPlanItems) {
      const recipe = item.recipe;
      for (const ingredient of recipe.ingredients) {
        // Get stored alternatives from the batch-fetched map
        const storedAlternatives = alternativesMap.get(ingredient.id) || [];
        
        // Handle ingredient alternatives: parse from name or use stored alternatives
        const parsed = parseIngredientAlternatives(ingredient.name);
        const allAlternatives = storedAlternatives.length > 0 
          ? storedAlternatives 
          : parsed.alternatives;
        
        // Only add to resolution tasks if there are alternatives to resolve
        if (allAlternatives.length > 0) {
          resolutionTasks.push({
            ingredientId: ingredient.id,
            itemId: item.id,
            parsed,
            allAlternatives,
          });
        }
      }
    }

    // Batch resolve all ingredient choices concurrently using Promise.all
    // This dramatically improves performance for meal plans with many recipes/ingredients
    const resolutionPromises = resolutionTasks.map(task =>
      resolveIngredientChoice(authResult.userId, task.parsed.name, task.allAlternatives)
    );
    const resolvedNames = await Promise.all(resolutionPromises);

    // Create a map of item+ingredient IDs to resolved names for quick lookup
    const resolvedNameMap = new Map<string, string>();
    resolutionTasks.forEach((task, idx) => {
      resolvedNameMap.set(`${task.itemId}-${task.ingredientId}`, resolvedNames[idx]);
    });

    // Second pass: Process all ingredients using pre-resolved names
    for (const item of mealPlanItems) {
      const recipe = item.recipe;
      // Calculate servings multiplier to scale ingredient quantities
      const servingsMultiplier = item.servings / (recipe.servings || 1);

      for (const ingredient of recipe.ingredients) {
        // Get stored alternatives from the batch-fetched map
        const storedAlternatives = alternativesMap.get(ingredient.id) || [];
        
        // Handle ingredient alternatives: parse from name or use stored alternatives
        const parsed = parseIngredientAlternatives(ingredient.name);
        const allAlternatives = storedAlternatives.length > 0 
          ? storedAlternatives 
          : parsed.alternatives;
        
        // Get resolved name from map or use ingredient name directly
        const resolvedName = allAlternatives.length > 0
          ? resolvedNameMap.get(`${item.id}-${ingredient.id}`) || ingredient.name
          : ingredient.name;
        
        // Skip excluded items (like water) - they should never appear on grocery lists
        if (isExcludedItem(resolvedName)) {
          continue;
        }

        // Normalize unit for better aggregation (cups→ml, oz→g, etc.)
        const normalized = normalizeUnit(ingredient.quantity * servingsMultiplier, ingredient.unit);
        const isStaple = isStapleItem(resolvedName);
        
        // Normalize ingredient name to handle variations (plural/singular, parenthetical notes)
        const normalizedName = normalizeIngredientName(resolvedName);
        
        // For staples, merge by normalized name only (not unit) since staples are typically "have it or don't"
        // For non-staples, merge by normalized name + unit to prevent incorrect merging
        const key = buildAggregationKey(normalizedName, normalized.unit, isStaple);
        
        const adjustedQuantity = normalized.quantity;

        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          // For staples, we sum quantities but keep the most common unit representation
          // For non-staples, we sum quantities with the same normalized unit
          existing.totalQuantity += adjustedQuantity;
          existing.recipes.push({
            recipeName: recipe.name,
            quantity: adjustedQuantity,
            mealType: item.mealType,
            date: item.date.toISOString(),
          });
        } else {
          ingredientMap.set(key, {
            name: capitalizeIngredientName(resolvedName),
            unit: normalized.unit,
            totalQuantity: adjustedQuantity,
            isStaple,
            recipes: [
              {
                recipeName: recipe.name,
                quantity: adjustedQuantity,
                mealType: item.mealType,
                date: item.date.toISOString(),
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
      // Skip excluded items (like water) - they should never appear on grocery lists
      if (isExcludedItem(item.name)) {
        continue;
      }

      const normalized = normalizeUnit(item.quantity, item.unit);
      const isStaple = isStapleItem(item.name);
      
      // Normalize ingredient name to handle variations (plural/singular, parenthetical notes)
      const normalizedName = normalizeIngredientName(item.name);
      
      // For staples, merge by normalized name only; for non-staples, merge by normalized name + unit
      const key = buildAggregationKey(normalizedName, normalized.unit, isStaple);
      
      if (ingredientMap.has(key)) {
        const existing = ingredientMap.get(key)!;
        existing.totalQuantity += normalized.quantity;
        // Preserve ID and checked state if this is a ShoppingListItem
        if (!existing.id && item.id) {
          existing.id = item.id;
          existing.isChecked = item.isChecked;
        }
        // Ensure isStaple flag is set if not already
        if (isStaple) {
          existing.isStaple = true;
        }
        // Add a "manual" recipe entry for shopping list items
        existing.recipes.push({
          recipeName: 'Manual Entry',
          quantity: normalized.quantity,
          mealType: 'other',
          date: (item.sourceDate ?? new Date()).toISOString(),
        });
      } else {
        ingredientMap.set(key, {
          id: item.id, // Include ShoppingListItem ID for persistence
          name: capitalizeIngredientName(item.name),
          unit: normalized.unit,
          totalQuantity: normalized.quantity,
          isChecked: item.isChecked, // Include checked state
          isStaple,
          recipes: [
            {
              recipeName: 'Manual Entry',
              quantity: normalized.quantity,
              mealType: 'other',
              date: (item.sourceDate ?? new Date()).toISOString(),
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
    const validated = MealPlansParamsSchema.parse({
      organizationId,
      startDate,
      endDate,
    });

    // Security check: Verify user belongs to the organization
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return {
        success: false,
        error: 'Unauthorized: Please sign in',
      };
    }

    const membership = await prisma.member.findFirst({
      where: {
        userId: authResult.userId,
        organizationId: validated.organizationId,
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
        organizationId: validated.organizationId,
        startDate: {
          lte: validated.endDate,
        },
        endDate: {
          gte: validated.startDate,
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
