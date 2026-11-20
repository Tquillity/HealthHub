'use server';

import { prisma } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';
import { queryRecipe, queryRecipes, type GetRecipesParams } from '@/lib/recipe-data';
import { buildRecipeVisibilityFilter } from './recipe-shared';

export async function getRecipes(params: GetRecipesParams) {
  try {
    const visibilityFilter = await buildRecipeVisibilityFilter(await getSessionUserId());
    const recipes = await queryRecipes(params, visibilityFilter);
    return { success: true, data: recipes };
  } catch (error) {
    console.error('[HealthHub action] recipe-queries', 'Failed to get recipes:', error);
    return { success: false, error: 'Failed to fetch recipes' };
  }
}

export async function getRecipeCategories() {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    const categories = await prisma.recipe.groupBy({
      by: ['category'],
      where: {
        AND: [visibilityFilter],
        category: { not: null },
      },
    });

    return categories
      .map((c) => c.category)
      .filter((c): c is string => c !== null)
      .sort();
  } catch (error) {
    console.error('[HealthHub action] recipe-queries', 'Failed to get recipe categories:', error);
    return [];
  }
}

export async function getRecipeFilterOptions() {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    // LEAN roles are a fixed list (src/lib/lean-kitchen.ts), so they are not queried.
    const [difficulties, cuisines, dietaryTags] = await Promise.all([
      prisma.recipe.findMany({
        where: {
          AND: [visibilityFilter],
          difficulty: { not: null },
        },
        select: { difficulty: true },
        distinct: ['difficulty'],
      }),
      prisma.recipe.findMany({
        where: {
          AND: [visibilityFilter],
          cuisine: { not: null },
        },
        select: { cuisine: true },
        distinct: ['cuisine'],
      }),
      prisma.recipe.findMany({
        where: {
          AND: [visibilityFilter],
        },
        select: { dietaryTags: true },
      }),
    ]);

    const allDietaryTags = new Set<string>();
    dietaryTags.forEach((r) => {
      r.dietaryTags.forEach((tag) => allDietaryTags.add(tag));
    });

    return {
      difficulties: difficulties
        .map((r) => r.difficulty)
        .filter((d): d is string => d !== null)
        .sort(),
      cuisines: cuisines
        .map((r) => r.cuisine)
        .filter((c): c is string => c !== null)
        .sort(),
      dietaryTags: Array.from(allDietaryTags).sort(),
    };
  } catch (error) {
    console.error('[HealthHub action] recipe-queries', 'Failed to get filter options:', error);
    return { difficulties: [], cuisines: [], dietaryTags: [] };
  }
}

export async function getRecipe(id: string) {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    const recipe = await queryRecipe(id, visibilityFilter);

    if (!recipe) {
      return { success: false, error: 'Recipe not found', data: null };
    }

    return { success: true, data: recipe };
  } catch (error) {
    console.error('[HealthHub action] recipe-queries', 'Error fetching recipe:', error);
    return { success: false, error: 'Failed to fetch recipe', data: null };
  }
}

export async function getUserRole() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return { success: false, role: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return { success: true, role: user?.role || 'user' };
  } catch (error) {
    console.error('[HealthHub action] recipe-queries', 'Error getting user role:', error);
    return { success: false, role: null };
  }
}
