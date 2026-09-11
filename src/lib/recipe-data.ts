import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export interface GetRecipesParams {
  query?: string;
  category?: string;
  difficulty?: string;
  cuisine?: string;
  dietaryTags?: string[];
  leanRole?: string;
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
    filterConditions.push({ category });
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
