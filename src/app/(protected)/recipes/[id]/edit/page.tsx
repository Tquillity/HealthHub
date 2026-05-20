import { redirect, notFound } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getRecipe } from '@/actions/recipe-actions';
import { RecipeForm } from '@/components/recipes/recipe-form';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // Allow both 'admin' and 'superadmin' roles
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    redirect('/recipes');
  }

  // Fetch recipe
  const result = await getRecipe(id);
  if (!result.success || !result.data) {
    notFound();
  }

  const recipe = result.data;
  const isSuperadmin = user?.role === 'superadmin';

  // Allow admins to edit system recipes
  // System recipes can be edited by admins to add images, update descriptions, etc.

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Link
        href={`/recipes/${id}`}
        className="mb-6 flex items-center text-sm text-gray-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Recipe
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Recipe</h1>
        <p className="mt-2 text-gray-500">
          Update recipe details, ingredients, and instructions.
        </p>
      </div>

      <AppErrorBoundary sectionLabel="Recipe form">
        <RecipeForm key={recipe.id} recipe={recipe} isSuperadmin={isSuperadmin} />
      </AppErrorBoundary>
    </div>
  );
}
