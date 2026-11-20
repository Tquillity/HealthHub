import { isQuickPrep } from '@/lib/lean-kitchen';

/**
 * Recipe list filters as read from the URL (see recipe-search-params.ts). Every
 * recipe list page filters through matchesRecipeFilters, so a filter means the same
 * thing wherever it is used. queryRecipes in recipe-data.ts mirrors these rules in
 * SQL for the getRecipes action.
 */
export interface RecipeFilters {
  query?: string | null;
  /** 'all' (the URL default) means no category filter. */
  category?: string | null;
  difficulty?: string | null;
  cuisine?: string | null;
  /** Matches when the recipe has any of these tags. */
  dietaryTags?: readonly string[] | null;
  leanRole?: string | null;
  /** Hands-on time recorded and ≤ QUICK_PREP_MAX_ACTIVE_MINUTES. */
  quickPrep?: boolean | null;
}

export interface FilterableRecipe {
  name: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  cuisine?: string | null;
  tags?: readonly string[] | null;
  dietaryTags?: readonly string[] | null;
  leanRole?: string | null;
  activeTime?: number | null;
  ingredients?: ReadonlyArray<{ name: string }> | null;
}

function sameText(a: string | null | undefined, b: string): boolean {
  return (a ?? '').toLowerCase() === b.toLowerCase();
}

function matchesQuery(recipe: FilterableRecipe, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    recipe.name.toLowerCase().includes(needle) ||
    (recipe.description?.toLowerCase().includes(needle) ?? false) ||
    (recipe.tags?.some((tag) => tag.toLowerCase().includes(needle)) ?? false) ||
    (recipe.ingredients?.some((ingredient) =>
      ingredient.name.toLowerCase().includes(needle)
    ) ??
      false)
  );
}

/** Text filters are case-insensitive; empty or null filters match everything. */
export function matchesRecipeFilters(
  recipe: FilterableRecipe,
  filters: RecipeFilters
): boolean {
  const { category, difficulty, cuisine, dietaryTags, leanRole, quickPrep } =
    filters;
  const query = filters.query?.trim();

  if (category && category !== 'all' && !sameText(recipe.category, category)) {
    return false;
  }
  if (query && !matchesQuery(recipe, query)) {
    return false;
  }
  if (difficulty && !sameText(recipe.difficulty, difficulty)) {
    return false;
  }
  if (cuisine && !sameText(recipe.cuisine, cuisine)) {
    return false;
  }
  if (
    dietaryTags &&
    dietaryTags.length > 0 &&
    !dietaryTags.some((tag) =>
      (recipe.dietaryTags ?? []).some((recipeTag) => sameText(recipeTag, tag))
    )
  ) {
    return false;
  }
  if (leanRole && !sameText(recipe.leanRole, leanRole)) {
    return false;
  }
  if (quickPrep && !isQuickPrep(recipe)) {
    return false;
  }
  return true;
}

export function filterRecipes<T extends FilterableRecipe>(
  recipes: readonly T[],
  filters: RecipeFilters
): T[] {
  return recipes.filter((recipe) => matchesRecipeFilters(recipe, filters));
}
