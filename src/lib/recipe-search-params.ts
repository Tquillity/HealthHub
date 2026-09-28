import { createLoader, parseAsArrayOf, parseAsString } from 'nuqs/server';

/**
 * Recipe list filters, shared by the server page and the client filters so both read the
 * URL the same way (nuqs writes arrays comma-separated: `?dietaryTags=vegan,keto`).
 */
export const recipeSearchParams = {
  q: parseAsString.withDefault(''),
  category: parseAsString.withDefault('all'),
  difficulty: parseAsString,
  cuisine: parseAsString,
  dietaryTags: parseAsArrayOf(parseAsString),
  leanRole: parseAsString,
};

export const loadRecipeSearchParams = createLoader(recipeSearchParams);
