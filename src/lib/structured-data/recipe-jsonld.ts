import type { RecipeWithDetails } from '@/actions/recipe-actions';
import { SITE_NAME } from '@/lib/site-metadata';

export function minutesToIsoDuration(minutes: number): string {
  if (minutes <= 0) {
    return 'PT0M';
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `PT${hours}H${mins}M`;
  }
  if (hours > 0) {
    return `PT${hours}H`;
  }
  return `PT${mins}M`;
}

function resolveAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return new URL(url.startsWith('/') ? url : `/${url}`, baseUrl).toString();
}

function formatIngredientLine(
  ingredient: RecipeWithDetails['ingredients'][number]
): string {
  const parts = [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean);
  const line = parts.join(' ').trim();
  return ingredient.notes ? `${line} (${ingredient.notes})` : line;
}

export function buildRecipeJsonLd(
  recipe: RecipeWithDetails,
  options: { baseUrl: string }
): Record<string, unknown> {
  const { baseUrl } = options;
  const canonicalUrl = new URL(`/recipes/${recipe.id}`, baseUrl).toString();

  const images = [
    ...(recipe.imageUrl ? [recipe.imageUrl] : []),
    ...(recipe.imageUrls ?? []),
  ]
    .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
    .map((url) => resolveAbsoluteUrl(url, baseUrl));

  const keywords = [
    ...(recipe.dietaryTags ?? []),
    ...(recipe.tags ?? []),
    recipe.cuisine,
    recipe.difficulty,
  ].filter((value): value is string => Boolean(value && value.trim()));

  const nutrition: Record<string, string> = {};
  if (recipe.calories != null) nutrition.calories = `${recipe.calories} calories`;
  if (recipe.protein != null) nutrition.proteinContent = `${recipe.protein} g`;
  if (recipe.carbs != null) nutrition.carbohydrateContent = `${recipe.carbs} g`;
  if (recipe.fat != null) nutrition.fatContent = `${recipe.fat} g`;
  if (recipe.fiber != null) nutrition.fiberContent = `${recipe.fiber} g`;
  if (recipe.sugar != null) nutrition.sugarContent = `${recipe.sugar} g`;
  if (recipe.sodium != null) nutrition.sodiumContent = `${recipe.sodium} mg`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    '@id': canonicalUrl,
    name: recipe.name,
    url: canonicalUrl,
    isAccessibleForFree: true,
    author: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
    },
  };

  if (recipe.description?.trim()) {
    jsonLd.description = recipe.description.trim();
  }

  if (images.length > 0) {
    jsonLd.image = images.length === 1 ? images[0] : images;
  }

  if (recipe.prepTime != null && recipe.prepTime > 0) {
    jsonLd.prepTime = minutesToIsoDuration(recipe.prepTime);
  }

  if (recipe.cookTime != null && recipe.cookTime > 0) {
    jsonLd.cookTime = minutesToIsoDuration(recipe.cookTime);
  }

  if (recipe.servings != null && recipe.servings > 0) {
    jsonLd.recipeYield = `${recipe.servings} servings`;
  }

  if (recipe.category) {
    jsonLd.recipeCategory = recipe.category;
  }

  if (recipe.cuisine) {
    jsonLd.recipeCuisine = recipe.cuisine;
  }

  if (keywords.length > 0) {
    jsonLd.keywords = keywords.join(', ');
  }

  if (Object.keys(nutrition).length > 0) {
    jsonLd.nutrition = {
      '@type': 'NutritionInformation',
      ...nutrition,
    };
  }

  if (recipe.ingredients.length > 0) {
    jsonLd.recipeIngredient = recipe.ingredients.map(formatIngredientLine);
  }

  if (recipe.instructions.length > 0) {
    jsonLd.recipeInstructions = recipe.instructions.map((step) => ({
      '@type': 'HowToStep',
      position: step.stepNumber,
      text: step.text,
    }));
  }

  if (recipe.createdAt) {
    jsonLd.datePublished = new Date(recipe.createdAt).toISOString();
  }

  if (recipe.updatedAt) {
    jsonLd.dateModified = new Date(recipe.updatedAt).toISOString();
  }

  return jsonLd;
}
