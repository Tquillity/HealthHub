'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { parseIngredientAlternatives } from '@/lib/ingredient-alternatives';
import { resolveIngredientChoice } from './ingredient-preference-actions';
import {
  AddShoppingItemSchema,
  ToggleShoppingItemSchema,
} from '@/lib/validation/grocery-schemas';

const GroceryListParamsSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

const ScaledIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
});

const AddScaledIngredientsSchema = z.object({
  ingredients: z.array(ScaledIngredientSchema).min(1),
  sourceRecipeId: z.string().min(1).optional(),
});

const MealPlansParamsSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

// Type for aggregated grocery item (matches GroceryListClient expectations)
export interface GroceryItem {
  id?: string; // ShoppingListItem ID if from shopping list, undefined for meal plan items
  name: string;
  unit: string;
  totalQuantity: number;
  isChecked?: boolean; // Only for ShoppingListItem entries
  isStaple?: boolean; // New flag for Skafferi (Pantry) items
  recipes: Array<{
    recipeName: string;
    quantity: number;
    mealType: string;
    // Must be serializable across the Server→Client boundary
    date: string;
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
    const validated = GroceryListParamsSchema.parse({
      organizationId,
      startDate,
      endDate,
    });
    organizationId = validated.organizationId;
    startDate = validated.startDate;
    endDate = validated.endDate;

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
      resolveIngredientChoice(session.user.id, task.parsed.name, task.allAlternatives)
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
        const key = isStaple 
          ? normalizedName
          : `${normalizedName}_${normalized.unit.toLowerCase()}`;
        
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
            name: resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1),
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
      const key = isStaple
        ? normalizedName
        : `${normalizedName}_${normalized.unit.toLowerCase()}`;
      
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
          name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
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
    const validated = ToggleShoppingItemSchema.parse({ itemKey, isChecked });

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
    if (validated.itemKey.startsWith('meal-plan_')) {
      // This is a meal plan item - we can't persist its checked state directly
      // Instead, we could create a ShoppingListItem for it, but for now just return success
      // The UI will handle local state for meal plan items
      return { success: true };
    }

    // Update ShoppingListItem
    await prisma.shoppingListItem.update({
      where: { id: validated.itemKey },
      data: { isChecked: validated.isChecked },
    });

    revalidatePath('/groceries');
    return { success: true };
  } catch (error) {
    console.error('Error toggling shopping item:', error);
    return { success: false, error: 'Failed to update item' };
  }
}

/**
 * Add manual shopping item to the grocery list
 * 
 * Allows users to add items manually (e.g., "Paper Towels", "Toilet Paper")
 * that aren't part of any recipe or meal plan.
 * 
 * @param name - Item name
 * @param quantity - Quantity (default: 1)
 * @param unit - Unit (default: 'pcs')
 * @returns Success status
 */
export async function addShoppingItem(
  name: string,
  quantity: number = 1,
  unit: string = 'pcs'
) {
  'use server';

  try {
    const validated = AddShoppingItemSchema.parse({ name, quantity, unit });

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

    await prisma.shoppingListItem.create({
      data: {
        organizationId: membership.organizationId,
        name: validated.name,
        quantity: validated.quantity,
        unit: validated.unit,
        category: 'Other',
        source: 'manual',
        isChecked: false,
      },
    });

    revalidatePath('/groceries');
    return { success: true };
  } catch (error) {
    console.error('Error adding shopping item:', error);
    return { success: false, error: 'Failed to add item' };
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
    const validated = AddScaledIngredientsSchema.parse({
      ingredients,
      sourceRecipeId,
    });

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
      validated.ingredients.map((ingredient) =>
        prisma.shoppingListItem.create({
          data: {
            organizationId: membership.organizationId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            category: categorizeIngredient(ingredient.name),
            source: 'recipe-scaler',
            sourceRecipeId: validated.sourceRecipeId ?? null,
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
 * Excluded keywords - items that should NEVER appear on grocery lists
 * These are items everyone has at home (like water) or shouldn't be purchased
 */
const EXCLUDED_KEYWORDS = [
  'vatten', 'water', 'kokande vatten', 'boiling water'
];

/**
 * Normalize ingredient names to handle variations, plural/singular, and parenthetical notes
 * This helps merge items like "Gula Lökar" and "Gul Lök" (same color, plural/singular) 
 * or "Kokosolja" and "Kokosolja (Till Chips)" (parenthetical note removal)
 * 
 * Examples:
 * - "Gula Lökar" → "gul lök" (plural normalized, but color preserved)
 * - "Gul Lök" → "gul lök" (color preserved)
 * - "Kokosolja (Till Chips)" → "kokosolja" (parenthetical removed)
 * - "Citron" → "citron" (stays separate from "Citronsaft" which becomes "citronsaft")
 * 
 * NOTE: We preserve color and state descriptors (gul/röd lök, färsk timjan) 
 * as these represent different ingredients.
 * 
 * @param name - Original ingredient name
 * @returns Normalized name for comparison
 */
/**
 * Words where the ending is part of the base word, not a plural suffix
 * These should NOT have their endings removed during normalization
 */
const BASE_WORD_EXCEPTIONS = new Set([
  'peppar', 'socker', 'smör', 'vatten', 'vinäger', 'buljong',
  'chili', 'timjan', 'oregano', 'basilika', 'persilja', 'dill',
  'koriander', 'kummin', 'nejlika', 'kanel', 'gurkmeja', 'ingefära',
  'paprika', 'curry', 'kardemumma', 'vanilj', 'saffran', 'muskot',
  'citron', 'limon', 'apelsin', 'ananas', 'avokado', 'banan',
  'tomat', 'gurka', 'aubergine', 'broccoli', 'spenat', 'sallad',
]);

function normalizeIngredientName(name: string): string {
  let normalized = name.trim();
  
  // Remove parenthetical notes like "(Till Chips)", "(färsk)", "(kallt)", etc.
  // These are typically usage notes, not part of the core ingredient identity
  normalized = normalized.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Convert to lowercase for comparison
  normalized = normalized.toLowerCase();
  
  // Handle common Swedish plural patterns ONLY if:
  // 1. The word is not in our exception list (base words like "peppar", "socker")
  // 2. Removing the ending results in a word at least 3 characters long
  // 3. The word without ending is not obviously corrupted (e.g., "pepp" from "peppar")
  
  // Common Swedish plural endings (apply in order, with validation)
  if (normalized.endsWith('ar') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    // Only remove if the result is at least 3 chars and not obviously wrong
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  } else if (normalized.endsWith('er') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    // Only remove if the result is at least 3 chars and not obviously wrong
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  } else if (normalized.endsWith('or') && !BASE_WORD_EXCEPTIONS.has(normalized)) {
    const withoutEnding = normalized.slice(0, -2);
    // Only remove if the result is at least 3 chars and not obviously wrong
    if (withoutEnding.length >= 3) {
      normalized = withoutEnding;
    }
  }
  
  // NOTE: We do NOT remove color/state descriptors because:
  // - "Gul lök" (yellow onion) vs "Röd lök" (red onion) are different ingredients
  // - "Färsk timjan" (fresh thyme) vs dried timjan are different ingredients
  // - These distinctions matter for cooking and shopping
  
  return normalized.trim();
}

/**
 * Staple keywords for Skafferi (Pantry) detection
 * These are items typically kept in stock and don't need to be bought every time
 */
const STAPLE_KEYWORDS = [
  // Current items
  'salt', 'peppar', 'pepper', 'olja', 'oil', 'chiliflakes', 'chili', 
  'vinäger', 'vinegar', 'socker', 'sugar', 'buljong', 'bouillon', 
  'honung', 'honey', 'smör', 'butter', 'ghee', 'citron', 'lemon', 
  'lime', 'vitlök', 'garlic', 'lök', 'onion',
  
  // New spices/kryddor
  'vanilj', 'vanilla', 'saffran', 'saffron', 'pepparkakskrydda',
  'krydda', 'spice', 'kanel', 'cinnamon', 'kardemumma', 'cardamom',
  'kryddnejlika', 'clove', 'nejlika', 'ingefära', 'ginger',
  'lagerblad', 'bay leaf', 'curry', 'sambal',
  
  // New pantry items
  'bakpulver', 'baking powder', 'bikarbonat', 'baking soda',
  'tomatpuré', 'tomato purée', 'sojasås', 'soy sauce', 'fisksås', 'fish sauce',
  'maizena', 'cornstarch', 'majsstärkelse', 'vetemjöl', 'flour',
  'strösocker', 'granulated sugar'
];

/**
 * Check if an ingredient should be excluded from grocery lists
 */
function isExcludedItem(name: string): boolean {
  const lowerName = name.toLowerCase();
  return EXCLUDED_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * Check if an ingredient name indicates a staple (Skafferi) item
 */
function isStapleItem(name: string): boolean {
  const lowerName = name.toLowerCase();
  return STAPLE_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * Normalize units to standard forms for better aggregation
 * 
 * Converts common volumes (tsp, tbsp, cup, fl oz, etc.) to 'ml' and 
 * weights (oz, lb, kg) to 'g' to enable merging of duplicate ingredients
 * with different unit representations (e.g., "1 cup Rice" and "200ml Rice").
 * 
 * Supports both English and Swedish units (msk, tsk, dl, nypa, st).
 * 
 * Non-standard units (piece, whole, etc.) are kept as-is.
 * 
 * @param quantity - Original quantity
 * @param unit - Original unit string
 * @returns Normalized quantity and unit
 */
function normalizeUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const lowerUnit = unit.toLowerCase().trim();
  
  // Volume conversions to ml (includes Swedish units)
  const volumeConversions: Record<string, number> = {
    // English
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
    // Swedish
    'krm': 1, // kryddmått (1 ml)
    'tsk': 5, // tesked (teaspoon, 5 ml)
    'msk': 15, // matsked (tablespoon, 15 ml)
    'dl': 100, // deciliter (100 ml)
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
    'g': 1,
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
  
  // For other units (piece, whole, st, nypa, etc.), keep original
  // "st" = styck (piece), "nypa" = pinch
  return { quantity, unit: lowerUnit || 'st' };
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
    const validated = MealPlansParamsSchema.parse({
      organizationId,
      startDate,
      endDate,
    });

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
