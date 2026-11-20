import {
  getRecipeCategories,
  getUserRole,
  type RecipeWithDetails,
} from '@/actions/recipe-actions';
import { getCachedRecipes } from '@/lib/recipe-cache';
import { RecipesClient } from '@/components/recipes/recipes-client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createPageMetadata } from '@/lib/site-metadata';
import { Plus } from 'lucide-react';
import { AdsenseSlot } from '@/components/ads/adsense-slot';

// Recipe rows are cached by resolved visibility; the page renders per request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPageMetadata({
  title: 'Recipes',
  description:
    'Browse and save household recipes with ingredients, instructions, and meal-planning friendly details.',
  path: '/recipes',
});

export default async function RecipesPage() {
  // Load every recipe the viewer may see; RecipesClient applies the URL filters with
  // matchesRecipeFilters (SSR included). Filtering on the server as well made the
  // list stale: filter changes update the URL shallowly, so clearing a filter that
  // came in with the page link could never bring the other recipes back.
  let recipes: RecipeWithDetails[] = [];
  let categories: string[] = [];
  let isAdmin = false;

  try {
    const [recipesResult, categoriesResult, roleResult] = await Promise.all([
      getCachedRecipes({}),
      getRecipeCategories(),
      getUserRole(),
    ]);

    recipes = recipesResult.data || [];
    categories = categoriesResult || [];
    isAdmin = roleResult.role === 'admin' || roleResult.role === 'superadmin';
  } catch (error) {
    console.error('Failed to fetch recipes data:', error);
    // Return empty state instead of crashing
    recipes = [];
    categories = [];
    isAdmin = false;
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Recipe Database
          </h1>
          <p className="mt-2 text-gray-600">
            Discover and manage your healthy recipes
          </p>
        </div>
        {isAdmin && (
          <Link href="/recipes/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Recipe
            </Button>
          </Link>
        )}
      </div>

      <RecipesClient
        recipes={recipes}
        categories={categories}
        isAdmin={isAdmin}
      />

      <AdsenseSlot
        slotId={
          process.env.NEXT_PUBLIC_ADSENSE_SLOT_RECIPES ?? 'recipes-footer'
        }
        className="mt-8"
      />
    </div>
  );
}
