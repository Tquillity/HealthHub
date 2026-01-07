'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';

export type RecipeWithDetails = Prisma.RecipeGetPayload<{
  include: { ingredients: true; instructions: { orderBy: { stepNumber: 'asc' } } };
}>;

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
  page = 1,
}: GetRecipesParams) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) throw new Error('Unauthorized');

    // Get user's organization to filter recipes
    const userId = session.user.id;
    const membership = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    const orgId = membership?.organizationId || null;

    // Check if user is MAIN admin (only MAIN admin can see secret recipes)
    const mainAdmin = await isMainAdmin(userId);

    // Build base visibility filter
    // Secret recipes: only visible to MAIN admin
    // Private recipes: only visible to owner (future feature)
    // System recipes: visible to everyone
    // Organization recipes: visible to organization members
    const visibilityFilter: Prisma.RecipeWhereInput = {
      AND: [
        {
          OR: [
            { isSystem: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
            // Secret recipes only for MAIN admin
            ...(mainAdmin ? [{ isSecret: true }] : []),
            // Private recipes for owner (future: add userId field to Recipe)
          ],
        },
        // Exclude secret recipes if not MAIN admin
        ...(mainAdmin ? [] : [{ isSecret: false }]),
        // Exclude private recipes (will be handled when userId field is added)
        { isPrivate: false },
      ],
    };

    // Build where clause combining visibility with search/filter criteria
    const filterConditions: Prisma.RecipeWhereInput[] = [visibilityFilter];

    // Add search query if provided
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

    // Add other filters
    if (category) {
      filterConditions.push({ category });
    }

    if (difficulty) {
      filterConditions.push({ difficulty });
    }

    if (cuisine) {
      filterConditions.push({ cuisine });
    }

    // Filter out empty strings from dietaryTags
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
 * Get distinct values for filters
 */
export async function getRecipeFilterOptions() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) throw new Error('Unauthorized');

    const userId = session.user.id;
    const membership = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    const orgId = membership?.organizationId || null;

    const [difficulties, cuisines, dietaryTags, leanRoles] = await Promise.all([
      prisma.recipe.findMany({
        where: {
          difficulty: { not: null },
          OR: [
            { isSystem: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
          ],
        },
        select: { difficulty: true },
        distinct: ['difficulty'],
      }),
      prisma.recipe.findMany({
        where: {
          cuisine: { not: null },
          OR: [
            { isSystem: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
          ],
        },
        select: { cuisine: true },
        distinct: ['cuisine'],
      }),
      prisma.recipe.findMany({
        where: {
          OR: [
            { isSystem: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
          ],
        },
        select: { dietaryTags: true },
      }),
      prisma.recipe.findMany({
        where: {
          leanRole: { not: null },
          OR: [
            { isSystem: true },
            ...(orgId ? [{ organizationId: orgId }] : []),
          ],
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

/**
 * Create a new recipe
 */
const CreateRecipeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  imageUrl: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional() // Allow local paths like /uploads/recipes/... and full URLs
  ),
  imageUrls: z.preprocess(
    (val) => {
      if (!val || !Array.isArray(val)) return undefined;
      const filtered = val.filter((url) => url && url !== '' && typeof url === 'string');
      return filtered.length > 0 ? filtered : undefined;
    },
    z.array(z.string()).optional() // Allow local paths like /uploads/recipes/... and full URLs
  ),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  dietaryTags: z.array(z.string()).default([]),
  leanRole: z.string().optional(), // LEAN metrics role
  calories: z.number().positive().optional(),
  protein: z.number().positive().optional(),
  carbs: z.number().positive().optional(),
  fat: z.number().positive().optional(),
  fiber: z.number().positive().optional(),
  sugar: z.number().positive().optional(),
  sodium: z.number().positive().optional(),
  isSecret: z.boolean().default(false), // Only MAIN admin can set this
  isPrivate: z.boolean().default(false), // For future: user's private recipes
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      notes: z.string().optional(),
    })
  ).min(1, 'At least one ingredient is required'),
  instructions: z.array(
    z.object({
      stepNumber: z.number().int().positive(),
      text: z.string().min(1),
    })
  ).min(1, 'At least one instruction is required'),
});

export async function createRecipe(data: z.infer<typeof CreateRecipeSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user is admin
    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Allow both 'admin' and 'superadmin' roles
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    // Only MAIN admin can create secret recipes
    const mainAdmin = await isMainAdmin(userId);
    if (data.isSecret && !mainAdmin) {
      return { success: false, error: 'Forbidden: Only MAIN admin can create secret recipes' };
    }

    // Get user's organization
    const membership = await prisma.member.findFirst({
      where: { userId: userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    // Preprocess data: filter out empty strings from imageUrls and handle empty imageUrl
    const processedData: any = {
      ...data,
      imageUrl: data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.trim() !== '' ? data.imageUrl : undefined,
      imageUrls: Array.isArray(data.imageUrls) 
        ? data.imageUrls.filter((url: any) => url && typeof url === 'string' && url.trim() !== '')
        : undefined,
    };
    
    // Remove imageUrl/imageUrls if they're empty or invalid
    if (processedData.imageUrl === '' || !processedData.imageUrl) {
      delete processedData.imageUrl;
    }
    if (!processedData.imageUrls || processedData.imageUrls.length === 0) {
      delete processedData.imageUrls;
    }

    // Validate input
    const validated = CreateRecipeSchema.parse(processedData);

    // Create recipe with ingredients and instructions
    const recipe = await prisma.$transaction(async (tx) => {
      const newRecipe = await tx.recipe.create({
        data: {
          name: validated.name,
          description: validated.description || null,
          imageUrl: validated.imageUrl && validated.imageUrl.trim() !== '' ? validated.imageUrl : null,
          imageUrls: validated.imageUrls && validated.imageUrls.length > 0 
            ? validated.imageUrls.filter((url: string) => url && url.trim() !== '')
            : [],
          prepTime: validated.prepTime || null,
          cookTime: validated.cookTime || null,
          servings: validated.servings || null,
          category: validated.category || null,
          tags: validated.tags,
          difficulty: validated.difficulty || null,
          cuisine: validated.cuisine || null,
          dietaryTags: validated.dietaryTags,
          leanRole: validated.leanRole || null,
          calories: validated.calories || null,
          protein: validated.protein || null,
          carbs: validated.carbs || null,
          fat: validated.fat || null,
          fiber: validated.fiber || null,
          sugar: validated.sugar || null,
          sodium: validated.sodium || null,
          organizationId: membership.organizationId,
          isSystem: false,
          isSecret: validated.isSecret || false,
          isPrivate: validated.isPrivate || false,
        },
      });

      await tx.ingredient.createMany({
        data: validated.ingredients.map((ing) => ({
          recipeId: newRecipe.id,
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes || null,
        })),
      });

      await tx.instruction.createMany({
        data: validated.instructions.map((inst) => ({
          recipeId: newRecipe.id,
          stepNumber: inst.stepNumber,
          text: inst.text,
        })),
      });

      return newRecipe;
    });

    revalidatePath('/recipes');
    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error creating recipe:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).errors[0]?.message || 'Validation failed' };
    }
    // Handle other error types
    if (error instanceof Error) {
      return { success: false, error: error.message || 'Failed to create recipe' };
    }
    return { success: false, error: 'Failed to create recipe' };
  }
}

/**
 * Update an existing recipe
 */
const UpdateRecipeSchema = CreateRecipeSchema.partial().extend({
  id: z.string().min(1),
  // Make ingredients and instructions optional and allow empty arrays for updates
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      notes: z.string().optional(),
    })
  ).optional(), // Optional for updates - can be empty array
  instructions: z.array(
    z.object({
      stepNumber: z.number().int().positive(),
      text: z.string().min(1),
    })
  ).optional(), // Optional for updates - can be empty array
});

export async function updateRecipe(data: z.infer<typeof UpdateRecipeSchema>) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized' };
    }

    // Check if user is admin
    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Allow both 'admin' and 'superadmin' roles
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    // Preprocess data: filter out empty strings from imageUrls and handle empty imageUrl
    const processedData: any = {
      ...data,
      imageUrl: data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.trim() !== '' ? data.imageUrl : undefined,
      imageUrls: Array.isArray(data.imageUrls) 
        ? data.imageUrls.filter((url: any) => url && typeof url === 'string' && url.trim() !== '')
        : undefined,
    };
    
    // Remove imageUrl/imageUrls if they're empty or invalid
    if (processedData.imageUrl === '' || !processedData.imageUrl) {
      delete processedData.imageUrl;
    }
    if (!processedData.imageUrls || processedData.imageUrls.length === 0) {
      delete processedData.imageUrls;
    }

    // Validate input
    const validated = UpdateRecipeSchema.parse(processedData);
    const { id, ingredients, instructions, ...recipeData } = validated;

    // Check if recipe exists and belongs to user's organization
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!existingRecipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Check secret recipe access - only MAIN admin can see/edit secret recipes
    const mainAdmin = await isMainAdmin(userId);
    if (existingRecipe.isSecret && !mainAdmin) {
      return { success: false, error: 'Recipe not found' };
    }

    // Only MAIN admin can set/change isSecret
    if (recipeData.isSecret !== undefined && recipeData.isSecret !== existingRecipe.isSecret) {
      if (!mainAdmin) {
        return { success: false, error: 'Forbidden: Only MAIN admin can set secret recipes' };
      }
    }

    // Allow admins to edit system recipes (to add images, update descriptions, etc.)
    // But prevent changing the isSystem flag itself
    if (existingRecipe.isSystem) {
      // Prevent changing isSystem flag on system recipes
      // Check processedData since isSystem is not in the schema
      const isSystemValue = 'isSystem' in processedData ? processedData.isSystem : undefined;
      if (isSystemValue !== undefined && isSystemValue !== existingRecipe.isSystem) {
        return { success: false, error: 'Cannot change isSystem flag on system recipes' };
      }
      // Remove isSystem from update data to prevent accidental changes (if it somehow got through)
      if ('isSystem' in recipeData) {
        delete (recipeData as any).isSystem;
      }
    }

    // Update recipe
    const recipe = await prisma.$transaction(async (tx) => {
      const updatedRecipe = await tx.recipe.update({
        where: { id },
        data: {
          ...recipeData,
          imageUrl: recipeData.imageUrl && recipeData.imageUrl.trim() !== '' ? recipeData.imageUrl : null,
          imageUrls: recipeData.imageUrls && recipeData.imageUrls.length > 0 
            ? recipeData.imageUrls.filter((url: string) => url && url.trim() !== '')
            : [],
        },
      });

      // Update ingredients if provided (including empty arrays to clear all)
      if (ingredients !== undefined) {
        await tx.ingredient.deleteMany({ where: { recipeId: id } });
        if (ingredients.length > 0) {
          await tx.ingredient.createMany({
            data: ingredients.map((ing) => ({
              recipeId: id,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
              notes: ing.notes || null,
            })),
          });
        }
      }

      // Update instructions if provided (including empty arrays to clear all)
      if (instructions !== undefined) {
        await tx.instruction.deleteMany({ where: { recipeId: id } });
        if (instructions.length > 0) {
          await tx.instruction.createMany({
            data: instructions.map((inst) => ({
              recipeId: id,
              stepNumber: inst.stepNumber,
              text: inst.text,
            })),
          });
        }
      }

      return updatedRecipe;
    });

    revalidatePath('/recipes');
    revalidatePath(`/recipes/${id}`);
    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error updating recipe:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: (error as any).errors[0]?.message || 'Validation failed' };
    }
    // Handle other error types
    if (error instanceof Error) {
      return { success: false, error: error.message || 'Failed to update recipe' };
    }
    return { success: false, error: 'Failed to update recipe' };
  }
}

/**
 * Get a single recipe by ID
 */
export async function getRecipe(id: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return { success: false, error: 'Unauthorized', data: null };
    }

    const userId = session.user.id;
    const mainAdmin = await isMainAdmin(userId);

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        instructions: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found', data: null };
    }

    // Check secret recipe access - only MAIN admin can see secret recipes
    if (recipe.isSecret && !mainAdmin) {
      return { success: false, error: 'Recipe not found', data: null };
    }

    // Check private recipe access (future: check if user is owner)
    if (recipe.isPrivate) {
      // TODO: When userId field is added to Recipe, check if user is owner
      return { success: false, error: 'Recipe not found', data: null };
    }

    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return { success: false, error: 'Failed to fetch recipe', data: null };
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

    // Allow both 'admin' and 'superadmin' roles
    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
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

/**
 * Check if the current user is a superadmin
 * 
 * Uses database role field instead of environment variable for better security
 * and maintainability. Superadmin role is set in the database and can be
 * managed through the admin interface.
 * 
 * @param userId - The user ID to check
 * @returns true if user has 'superadmin' role
 */
async function isMainAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    
    // Check for superadmin role (more secure than env var matching)
    return user?.role === 'superadmin';
  } catch (error) {
    console.error('Error checking superadmin status:', error);
    return false;
  }
}
