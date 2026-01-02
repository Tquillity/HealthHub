import { getRecipes, getRecipeCategories, getUserRole } from '@/actions/recipe-actions';
import { RecipesClient } from '@/components/recipes/recipes-client';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecipesPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/sign-in');

  const params = await searchParams;

  // Parse params
  const query = typeof params.q === 'string' && params.q.trim() ? params.q.trim() : undefined;
  const category = typeof params.category === 'string' && params.category !== 'all' ? params.category : undefined;
  const difficulty = typeof params.difficulty === 'string' ? params.difficulty : undefined;
  const cuisine = typeof params.cuisine === 'string' ? params.cuisine : undefined;
  const dietaryTags = Array.isArray(params.dietaryTags)
    ? params.dietaryTags
    : typeof params.dietaryTags === 'string'
    ? [params.dietaryTags]
    : undefined;
  const leanRole = typeof params.leanRole === 'string' ? params.leanRole : undefined;

  // Parallel data fetching
  const [recipesResult, categories, roleResult] = await Promise.all([
    getRecipes({ query, category, difficulty, cuisine, dietaryTags, leanRole }),
    getRecipeCategories(),
    getUserRole(),
  ]);

  const recipes = recipesResult.data || [];
  const isAdmin = roleResult.role === 'admin';

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
