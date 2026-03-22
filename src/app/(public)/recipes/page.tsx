import {
  getRecipes,
  getRecipeCategories,
  getUserRole,
  type RecipeWithDetails,
} from '@/actions/recipe-actions';
import { RecipesClient } from '@/components/recipes/recipes-client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecipesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse params
  const query =
    typeof params.q === 'string' && params.q.trim() ? params.q.trim() : undefined;
  const category =
    typeof params.category === 'string' && params.category !== 'all'
      ? params.category
      : undefined;
  const difficulty = typeof params.difficulty === 'string' ? params.difficulty : undefined;
  const cuisine = typeof params.cuisine === 'string' ? params.cuisine : undefined;
  const dietaryTags = Array.isArray(params.dietaryTags)
    ? params.dietaryTags
    : typeof params.dietaryTags === 'string'
      ? [params.dietaryTags]
      : undefined;
  const leanRole = typeof params.leanRole === 'string' ? params.leanRole : undefined;

  // Parallel data fetching with error handling
  let recipes: RecipeWithDetails[] = [];
  let categories: string[] = [];
  let isAdmin = false;

  try {
    const [recipesResult, categoriesResult, roleResult] = await Promise.all([
      getRecipes({ query, category, difficulty, cuisine, dietaryTags, leanRole }),
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
        initialQuery={query}
        initialCategory={category}
      />
    </div>
  );
}
