'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { isMainAdmin, preprocessRecipeInput } from './recipe-shared';

const CreateRecipeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  imageUrl: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  imageUrls: z.preprocess(
    (val) => {
      if (!val || !Array.isArray(val)) return undefined;
      const filtered = val.filter((url) => url && url !== '' && typeof url === 'string');
      return filtered.length > 0 ? filtered : undefined;
    },
    z.array(z.string()).optional()
  ),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  cuisine: z.string().optional(),
  dietaryTags: z.array(z.string()).default([]),
  leanRole: z.string().optional(),
  calories: z.number().positive().optional(),
  protein: z.number().positive().optional(),
  carbs: z.number().positive().optional(),
  fat: z.number().positive().optional(),
  fiber: z.number().positive().optional(),
  sugar: z.number().positive().optional(),
  sodium: z.number().positive().optional(),
  isSecret: z.boolean().default(false),
  isPrivate: z.boolean().default(false),
  isHhChefsVerified: z.boolean().default(false),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      notes: z.string().optional(),
      alternatives: z.array(z.string()).optional(),
    })
  ).min(1, 'At least one ingredient is required'),
  instructions: z.array(
    z.object({
      stepNumber: z.number().int().positive(),
      text: z.string().min(1),
    })
  ).min(1, 'At least one instruction is required'),
});

const UpdateRecipeSchema = CreateRecipeSchema.partial().extend({
  id: z.string().min(1),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
      notes: z.string().optional(),
      alternatives: z.array(z.string()).optional(),
    })
  ).optional(),
  instructions: z.array(
    z.object({
      stepNumber: z.number().int().positive(),
      text: z.string().min(1),
    })
  ).optional(),
});

export async function createRecipe(data: z.infer<typeof CreateRecipeSchema>) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const userId = authResult.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    const mainAdmin = await isMainAdmin(userId);
    if (data.isSecret && !mainAdmin) {
      return { success: false, error: 'Forbidden: Only MAIN admin can create secret recipes' };
    }

    if (data.isHhChefsVerified && !mainAdmin) {
      return { success: false, error: 'Forbidden: Only superadmin can verify recipes' };
    }

    const membership = await prisma.member.findFirst({
      where: { userId: userId },
      select: { organizationId: true },
    });

    if (!membership) {
      return { success: false, error: 'No household found' };
    }

    const validated = CreateRecipeSchema.parse(preprocessRecipeInput(data));

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
          isHhChefsVerified: validated.isHhChefsVerified || false,
        },
      });

      for (const ing of validated.ingredients) {
        const ingredient = await tx.ingredient.create({
          data: {
            recipeId: newRecipe.id,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes || null,
          },
        });

        if (ing.alternatives && ing.alternatives.length > 0) {
          await tx.ingredientAlternative.createMany({
            data: ing.alternatives.map((alt, index) => ({
              ingredientId: ingredient.id,
              name: alt,
              order: index + 1,
            })),
          });
        }
      }

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
    revalidateTag('recipes', 'max');
    revalidateTag('recipes-public', 'max');
    revalidateTag(`recipe-public-${recipe.id}`, 'max');
    revalidateTag(`recipes-${userId}`, 'max');
    revalidateTag(`recipe-${userId}-${recipe.id}`, 'max');
    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error creating recipe:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message || 'Failed to create recipe' };
    }
    return { success: false, error: 'Failed to create recipe' };
  }
}

export async function updateRecipe(data: z.infer<typeof UpdateRecipeSchema>) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const userId = authResult.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    const processedData = preprocessRecipeInput(data);
    const validated = UpdateRecipeSchema.parse(processedData);
    const { id, ingredients, instructions, ...recipeData } = validated;

    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!existingRecipe) {
      return { success: false, error: 'Recipe not found' };
    }

    const mainAdmin = await isMainAdmin(userId);
    if (existingRecipe.isSecret && !mainAdmin) {
      return { success: false, error: 'Recipe not found' };
    }

    if (recipeData.isSecret !== undefined && recipeData.isSecret !== existingRecipe.isSecret) {
      if (!mainAdmin) {
        return { success: false, error: 'Forbidden: Only MAIN admin can set secret recipes' };
      }
    }

    if (
      recipeData.isHhChefsVerified !== undefined &&
      recipeData.isHhChefsVerified !== existingRecipe.isHhChefsVerified
    ) {
      if (!mainAdmin) {
        return { success: false, error: 'Forbidden: Only superadmin can verify recipes' };
      }
    }

    if (existingRecipe.isSystem) {
      const isSystemValue =
        'isSystem' in data && typeof data.isSystem === 'boolean' ? data.isSystem : undefined;
      if (isSystemValue !== undefined && isSystemValue !== existingRecipe.isSystem) {
        return { success: false, error: 'Cannot change isSystem flag on system recipes' };
      }
      if ('isSystem' in recipeData) {
        delete (recipeData as Record<string, unknown>).isSystem;
      }
    }

    const updateData: Prisma.RecipeUpdateInput = { ...recipeData };

    if ('imageUrl' in recipeData) {
      updateData.imageUrl = recipeData.imageUrl && recipeData.imageUrl.trim() !== ''
        ? recipeData.imageUrl
        : null;
    }
    if ('imageUrls' in recipeData) {
      updateData.imageUrls = recipeData.imageUrls && recipeData.imageUrls.length > 0
        ? recipeData.imageUrls.filter((url: string) => url && url.trim() !== '')
        : [];
    }

    const recipe = await prisma.$transaction(async (tx) => {
      const updatedRecipe = await tx.recipe.update({
        where: { id },
        data: updateData,
      });

      if (ingredients !== undefined) {
        await tx.ingredient.deleteMany({ where: { recipeId: id } });
        if (ingredients.length > 0) {
          for (const ing of ingredients) {
            const ingredient = await tx.ingredient.create({
              data: {
                recipeId: id,
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                notes: ing.notes || null,
              },
            });

            if (ing.alternatives && ing.alternatives.length > 0) {
              await tx.ingredientAlternative.createMany({
                data: ing.alternatives.map((alt, index) => ({
                  ingredientId: ingredient.id,
                  name: alt,
                  order: index + 1,
                })),
              });
            }
          }
        }
      }

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
    revalidateTag('recipes', 'max');
    revalidateTag('recipes-public', 'max');
    revalidateTag(`recipe-public-${id}`, 'max');
    revalidateTag(`recipes-${userId}`, 'max');
    revalidateTag(`recipe-${userId}-${id}`, 'max');
    return { success: true, data: recipe };
  } catch (error) {
    console.error('Error updating recipe:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    if (error instanceof Error) {
      return { success: false, error: error.message || 'Failed to update recipe' };
    }
    return { success: false, error: 'Failed to update recipe' };
  }
}

export async function deleteRecipe(id: string) {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) {
      return { success: false, error: authResult.error };
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.userId },
      select: { role: true },
    });

    if (user?.role !== 'admin' && user?.role !== 'superadmin') {
      return { success: false, error: 'Forbidden: Admin access required' };
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id },
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    const recipeId = recipe.id;

    await prisma.recipe.delete({
      where: { id },
    });

    revalidatePath('/recipes');
    revalidateTag('recipes', 'max');
    revalidateTag('recipes-public', 'max');
    revalidateTag(`recipe-public-${recipeId}`, 'max');
    revalidateTag(`recipes-${authResult.userId}`, 'max');
    revalidateTag(`recipe-${authResult.userId}-${recipeId}`, 'max');
    return { success: true };
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return { success: false, error: 'Failed to delete recipe' };
  }
}
