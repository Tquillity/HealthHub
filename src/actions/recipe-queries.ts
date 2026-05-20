'use server';

import { prisma } from '@/lib/db';
import { getSessionUserId } from '@/lib/session';
import type { Prisma } from '@prisma/client';
import { buildRecipeVisibilityFilter } from './recipe-shared';

interface GetRecipesParams {
  query?: string;
  category?: string;
  difficulty?: string;
  cuisine?: string;
  dietaryTags?: string[];
  leanRole?: string;
  page?: number;
}

export async function getRecipes({
  query,
  category,
  difficulty,
  cuisine,
  dietaryTags,
  leanRole,
  page: _page = 1,
}: GetRecipesParams) {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    const filterConditions: Prisma.RecipeWhereInput[] = [visibilityFilter];

    if (query) {
      filterConditions.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { hasSome: [query] } },
          { ingredients: { some: { name: { contains: query, mode: 'insensitive' } } } },
        ],
      });
    }

    if (category) {
      filterConditions.push({ category });
    }

    if (difficulty) {
      filterConditions.push({ difficulty });
    }

    if (cuisine) {
      filterConditions.push({ cuisine });
    }

    const validDietaryTags = dietaryTags?.filter((tag) => tag && tag.trim().length > 0);
    if (validDietaryTags && validDietaryTags.length > 0) {
      filterConditions.push({ dietaryTags: { hasSome: validDietaryTags } });
    }

    if (leanRole) {
      filterConditions.push({ leanRole });
    }

    const where: Prisma.RecipeWhereInput = {
      AND: filterConditions,
    };

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        ingredients: true,
        instructions: { orderBy: { stepNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: recipes };
  } catch (error) {
    console.error('Failed to get recipes:', error);
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
    console.error('Failed to get recipe categories:', error);
    return [];
  }
}

export async function getRecipeFilterOptions() {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    const [difficulties, cuisines, dietaryTags, leanRoles] = await Promise.all([
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
      prisma.recipe.findMany({
        where: {
          AND: [visibilityFilter],
          leanRole: { not: null },
        },
        select: { leanRole: true },
        distinct: ['leanRole'],
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
      leanRoles: leanRoles
        .map((r) => r.leanRole)
        .filter((r): r is string => r !== null)
        .sort(),
    };
  } catch (error) {
    console.error('Failed to get filter options:', error);
    return { difficulties: [], cuisines: [], dietaryTags: [], leanRoles: [] };
  }
}

export async function getRecipe(id: string) {
  try {
    const userId = await getSessionUserId();
    const visibilityFilter = await buildRecipeVisibilityFilter(userId);

    const recipe = await prisma.recipe.findFirst({
      where: {
        AND: [{ id }, visibilityFilter],
      },
      include: {
        ingredients: true,
        instructions: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found', data: null };
    }

    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error fetching recipe:', error);
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
    console.error('Error getting user role:', error);
    return { success: false, role: null };
  }
}
