import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getActiveMembership } from '@/lib/active-organization';
import { RecipeForm } from '@/components/recipes/recipe-form';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function NewRecipePage() {
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

  const isSuperadmin = user?.role === 'superadmin';
  // The space picked in the sidebar switcher. The form sends its id back, so a switch in
  // another tab cannot file the recipe somewhere else.
  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    redirect('/recipes');
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <Link
        href="/recipes"
        className="mb-6 flex items-center text-sm text-gray-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Recipes
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Recipe</h1>
        <p className="mt-2 text-gray-500">
          Add a new recipe to {membership.organization.name}.
        </p>
      </div>

      <AppErrorBoundary sectionLabel="Recipe form">
        <RecipeForm organizationId={membership.organizationId} isSuperadmin={isSuperadmin} />
      </AppErrorBoundary>
    </div>
  );
}
