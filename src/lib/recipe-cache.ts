import { unstable_cache } from 'next/cache';
import {
  getRecipe,
  getRecipes,
} from '@/actions/recipe-actions';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export type RecipeViewerKey = string;

type GetRecipesParams = Parameters<typeof getRecipes>[0];

const RECIPE_CACHE_SECONDS = 3600;

function hashRecipeListParams(params: GetRecipesParams): string {
  return JSON.stringify({
    query: params.query ?? '',
    category: params.category ?? '',
    difficulty: params.difficulty ?? '',
    cuisine: params.cuisine ?? '',
    dietaryTags: params.dietaryTags ?? [],
    leanRole: params.leanRole ?? '',
    page: params.page ?? 1,
  });
}

export async function getRecipeViewerKey(): Promise<RecipeViewerKey> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session?.user.id ?? 'guest';
  } catch {
    return 'guest';
  }
}

export async function getCachedRecipes(
  params: GetRecipesParams,
  viewerKey: RecipeViewerKey
) {
  const paramsHash = hashRecipeListParams(params);

  if (viewerKey === 'guest') {
    const cached = unstable_cache(
      async () => getRecipes(params),
      [`recipes-public-${paramsHash}`],
      {
        revalidate: RECIPE_CACHE_SECONDS,
        tags: ['recipes', 'recipes-public'],
      }
    );
    return cached();
  }

  const cached = unstable_cache(
    async () => getRecipes(params),
    [`recipes-${viewerKey}-${paramsHash}`],
    {
      revalidate: RECIPE_CACHE_SECONDS,
      tags: ['recipes', `recipes-${viewerKey}`],
    }
  );
  return cached();
}

export async function getCachedRecipe(id: string, viewerKey: RecipeViewerKey) {
  if (viewerKey === 'guest') {
    const cached = unstable_cache(
      async () => getRecipe(id),
      [`recipe-public-${id}`],
      {
        revalidate: RECIPE_CACHE_SECONDS,
        tags: ['recipes', `recipe-public-${id}`],
      }
    );
    return cached();
  }

  const cached = unstable_cache(
    async () => getRecipe(id),
    [`recipe-${viewerKey}-${id}`],
    {
      revalidate: RECIPE_CACHE_SECONDS,
      tags: ['recipes', `recipe-${viewerKey}-${id}`],
    }
  );
  return cached();
}
