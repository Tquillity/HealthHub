import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { QUICK_PREP_MAX_ACTIVE_MINUTES } from '@/lib/lean-kitchen';

export interface GetRecipesParams {
  query?: string;
  category?: string;
  difficulty?: string;
  cuisine?: string;
  dietaryTags?: string[];
  leanRole?: string;
  /** Only recipes with a recorded hands-on time ≤ QUICK_PREP_MAX_ACTIVE_MINUTES. */
  quickPrep?: boolean;
  page?: number;
}

export async function queryRecipes(
  {
    query,
    category,
    difficulty,
    cuisine,
    dietaryTags,
    leanRole,
    quickPrep,
    page: _page = 1,
  }: GetRecipesParams,
  visibilityFilter: Prisma.RecipeWhereInput
) {
  const filterConditions: Prisma.RecipeWhereInput[] = [visibilityFilter];

  if (query) {
    filterConditions.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } },
        {
          ingredients: {
            some: { name: { contains: query, mode: 'insensitive' } },
          },
        },
      ],
    });
  }

  if (category) {
    // Case-insensitive, like the client-side filter in recipes-client.tsx.
    filterConditions.push({
      category: { equals: category, mode: 'insensitive' },
    });
  }

  if (difficulty) {
    filterConditions.push({ difficulty });
  }

  if (cuisine) {
    filterConditions.push({ cuisine });
  }

  const validDietaryTags = dietaryTags?.filter(
    (tag) => tag && tag.trim().length > 0
  );
  if (validDietaryTags && validDietaryTags.length > 0) {
    filterConditions.push({ dietaryTags: { hasSome: validDietaryTags } });
  }

  // Same semantics as matchesRecipeFilters in recipe-filters.ts (case-insensitive role,
  // unknown active time never counts as quick).
  if (leanRole) {
    filterConditions.push({
      leanRole: { equals: leanRole, mode: 'insensitive' },
    });
  }

  if (quickPrep) {
    filterConditions.push({
      activeTime: { lte: QUICK_PREP_MAX_ACTIVE_MINUTES },
    });
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

  return recipes;
}

export async function queryRecipe(
  id: string,
  visibilityFilter: Prisma.RecipeWhereInput
) {
  return prisma.recipe.findFirst({
    where: { AND: [{ id }, visibilityFilter] },
    include: {
      ingredients: true,
      instructions: { orderBy: { stepNumber: 'asc' } },
    },
  });
}
