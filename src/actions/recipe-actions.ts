'use server';

import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

export type RecipeWithDetails = Prisma.RecipeGetPayload<{
  include: { ingredients: true };
}>;

interface GetRecipesParams {
  query?: string;
  category?: string;
  page?: number;
}

export async function getRecipes({
  query,
  category,
  page = 1,
}: GetRecipesParams) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) throw new Error('Unauthorized');

    // Determine the active organization (Household)
    // Better-Auth organization plugin provides organization through session
    // We need to get the user's active organization from their membership
    const userId = session.user.id;
    
    // Get user's active organization (first organization they're a member of)
    const membership = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    
    const orgId = membership?.organizationId || null;

    const limit = 12;
    const skip = (page - 1) * limit;

    // Base filter: System Recipes OR Organization Recipes
    const where: Prisma.RecipeWhereInput = {
      OR: [
        { isSystem: true },
        ...(orgId ? [{ organizationId: orgId }] : []), // Only add org filter if orgId exists
      ],
      AND: [],
    };

    // Apply Search Query
    if (query) {
      (where.AND as Prisma.RecipeWhereInput[]).push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          // Search inside tags array
          { tags: { has: query } },
        ],
      });
    }

    // Apply Category Filter
    if (category && category !== 'all') {
      (where.AND as Prisma.RecipeWhereInput[]).push({
        category: { equals: category, mode: 'insensitive' },
      });
    }

    const [data, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        take: limit,
        skip,
        orderBy: { name: 'asc' },
        include: {
          ingredients: true, // Needed for simple "X ingredients" count on card
        },
      }),
      prisma.recipe.count({ where }),
    ]);

    return { success: true, data, total, page, limit };
  } catch (error) {
    console.error('Failed to get recipes:', error);
    return { success: false, error: 'Failed to fetch recipes' };
  }
}

/**
 * Fetch distinct categories for the filter dropdown
 */
export async function getRecipeCategories() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) throw new Error('Unauthorized');

    // Get user's organization to filter categories
    const userId = session.user.id;
    const membership = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    const orgId = membership?.organizationId || null;

    // Get categories from system recipes and user's organization recipes
    const categories = await prisma.recipe.groupBy({
      by: ['category'],
      where: {
        category: { not: null },
        OR: [
          { isSystem: true },
          ...(orgId ? [{ organizationId: orgId }] : []),
        ],
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

/**
 * Delete a recipe (admin only)
 */
export async function deleteRecipe(id: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    // Check if recipe exists and is not a system recipe (or allow deletion if admin)
    const recipe = await prisma.recipe.findUnique({
      where: { id },
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Delete recipe (cascade will handle ingredients and instructions)
    await prisma.recipe.delete({
      where: { id },
    });

    revalidatePath('/recipes');
    return { success: true };
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return { success: false, error: 'Failed to delete recipe' };
  }
}

/**
 * Get user role (for checking admin status)
 */
export async function getUserRole() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, role: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    return { success: true, role: user?.role || 'user' };
  } catch (error) {
    console.error('Error getting user role:', error);
    return { success: false, role: null };
  }
}
