'use server';

/**
 * Grocery shopping-list mutations (toggle, manual add, recipe scaler).
 * Queries and aggregation live in grocery-actions.ts.
 */

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath } from 'next/cache';
import {
  AddShoppingItemSchema,
  ToggleShoppingItemSchema,
} from '@/lib/validation/grocery-schemas';

const ScaledIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
});

const AddScaledIngredientsSchema = z.object({
  ingredients: z.array(ScaledIngredientSchema).min(1),
  sourceRecipeId: z.string().min(1).optional(),
});

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('chicken') ||
    lower.includes('beef') ||
    lower.includes('pork') ||
    lower.includes('fish') ||
    lower.includes('turkey')
  ) {
    return 'Meat & Seafood';
  }
  if (
    lower.includes('milk') ||
    lower.includes('cheese') ||
    lower.includes('yogurt') ||
    lower.includes('butter')
  ) {
    return 'Dairy';
  }
  if (
    lower.includes('apple') ||
    lower.includes('banana') ||
    lower.includes('orange') ||
    lower.includes('berry') ||
    lower.includes('fruit')
  ) {
    return 'Produce';
  }
  if (
    lower.includes('onion') ||
    lower.includes('garlic') ||
    lower.includes('pepper') ||
    lower.includes('tomato') ||
    lower.includes('lettuce') ||
    lower.includes('carrot')
  ) {
    return 'Produce';
  }
  if (
    lower.includes('bread') ||
    lower.includes('pasta') ||
    lower.includes('rice') ||
    lower.includes('flour')
  ) {
    return 'Bakery & Grains';
  }
  if (
    lower.includes('oil') ||
    lower.includes('vinegar') ||
    lower.includes('sauce') ||
    lower.includes('spice')
  ) {
    return 'Pantry';
  }
  return 'Other';
}

export async function toggleShoppingItem(
  itemKey: string,
  isChecked: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = ToggleShoppingItemSchema.parse({ itemKey, isChecked });

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

    if (validated.itemKey.startsWith('meal-plan_')) {
      return { success: true };
    }

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

export async function addShoppingItem(
  name: string,
  quantity: number = 1,
  unit: string = 'pcs'
) {
  try {
    const validated = AddShoppingItemSchema.parse({ name, quantity, unit });

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

export async function addScaledIngredientsToGroceryList(
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
  sourceRecipeId?: string
) {
  try {
    const validated = AddScaledIngredientsSchema.parse({
      ingredients,
      sourceRecipeId,
    });

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
