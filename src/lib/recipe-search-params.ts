import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';
import { LEAN_ROLES } from '@/lib/lean-kitchen';

/**
 * Recipe list filters, shared by the filter controls and the recipe list so both read the
 * URL the same way (nuqs writes arrays comma-separated: `?dietaryTags=vegan,keto`).
 * `loadRecipeSearchParams` parses the same URL on the server.
 */
export const recipeSearchParams = {
  q: parseAsString.withDefault(''),
  category: parseAsString.withDefault('all'),
  difficulty: parseAsString,
  cuisine: parseAsString,
  dietaryTags: parseAsArrayOf(parseAsString),
  /** Unknown roles read as null (no filter). */
  leanRole: parseAsStringLiteral(LEAN_ROLES),
  /** `?quickPrep=true`: only recipes with little hands-on time. */
  quickPrep: parseAsBoolean.withDefault(false),
};

export const loadRecipeSearchParams = createLoader(recipeSearchParams);
