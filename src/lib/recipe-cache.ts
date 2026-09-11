import { unstable_cache } from 'next/cache';
import {
  queryRecipe,
  queryRecipes,
  type GetRecipesParams,
} from '@/lib/recipe-data';
import { buildRecipeVisibilityFilter } from '@/actions/recipe-shared';
import { getSessionUserId } from '@/lib/session';

const cacheOptions = { revalidate: 3600, tags: ['recipes'] };
const cachedRecipes = unstable_cache(
  queryRecipes,
  ['recipes-v2'],
  cacheOptions
);
const cachedRecipe = unstable_cache(queryRecipe, ['recipe-v2'], cacheOptions);

// Resolve session, membership and role on every request. The resulting visibility
// filter is a cache argument, so losing household/admin access changes the key.
export async function getCachedRecipes(params: GetRecipesParams) {
  const visibility = await buildRecipeVisibilityFilter(
    await getSessionUserId()
  );
  const data = await cachedRecipes(params, visibility);
  return { success: true, data };
}

export async function getCachedRecipe(id: string) {
  const visibility = await buildRecipeVisibilityFilter(
    await getSessionUserId()
  );
  const data = await cachedRecipe(id, visibility);
  return { success: Boolean(data), data };
}
