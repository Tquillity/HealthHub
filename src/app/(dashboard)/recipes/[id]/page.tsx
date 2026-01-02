import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { ChevronLeft, Clock, Users, ChefHat } from 'lucide-react';
import { ServingsScaler } from '@/components/recipes/servings-scaler';
import { RecipeDetailClient } from '@/components/recipes/recipe-detail-client';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      ingredients: true,
      instructions: { orderBy: { stepNumber: 'asc' } },
    },
  });

  if (!recipe) notFound();

  // Check if user is admin
  const isAdmin = session
    ? (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      }))?.role === 'admin'
    : false;

  const totalMins = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <Link
        href="/recipes"
        className="mb-6 flex items-center text-sm text-gray-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Recipes
      </Link>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        {/* Left Column: Details & Instructions */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-gray-900">
              {recipe.name}
            </h1>
            <div className="mt-4 flex items-center gap-2">
              {recipe.category && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                  {recipe.category}
                </span>
              )}
              {recipe.isSystem && (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                  Official Recipe
                </span>
              )}
            </div>
            {recipe.description && (
              <p className="mt-6 text-lg leading-relaxed text-gray-600">
                {recipe.description}
              </p>
            )}
          </div>

          {/* Meta Bar */}
          <div className="mb-10 flex gap-8 border-y border-gray-100 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Total Time
                </p>
                <p className="font-semibold text-gray-900">
                  {totalMins || 0} mins
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">
                  Servings
                </p>
                <p className="font-semibold text-gray-900">
                  {recipe.servings || '-'}
                </p>
              </div>
            </div>
          </div>

          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ChefHat className="h-6 w-6 text-gray-400" />
            Instructions
          </h2>
          <div className="space-y-8 pl-2">
            {recipe.instructions.map((step) => (
              <div key={step.id} className="group relative flex gap-6">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white shadow-sm ring-4 ring-white">
                  {step.stepNumber}
                </div>
                <div className="absolute left-4 top-8 -bottom-8 w-px bg-gray-200 group-last:hidden" />
                <p className="pt-1 leading-relaxed text-gray-700">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Ingredients */}
        <div className="lg:col-span-1">
          <ServingsScaler
            defaultServings={recipe.servings || 4}
            ingredients={recipe.ingredients}
          />
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <RecipeDetailClient recipeId={recipe.id} />
      )}
    </div>
  );
}


