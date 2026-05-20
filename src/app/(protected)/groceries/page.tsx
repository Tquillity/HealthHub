import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getGroceryList } from '@/actions/grocery-actions';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Calendar, Users } from 'lucide-react';
import { GroceryListClient } from '@/components/groceries/grocery-list-client';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { AppErrorBoundary } from '@/components/ui/error-boundary';

export default async function GroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/sign-in');

  const params = await searchParams;
  const dateParam =
    typeof params.week === 'string' ? params.week : new Date().toISOString();
  const date = new Date(dateParam);

  // Get User's Organization
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <EmptyState
          icon={Users}
          title="No household assigned"
          description="Join or create a household to share grocery lists with your family."
          action={{ label: 'Manage household', href: '/profile/household' }}
        />
      </div>
    );
  }

  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });

  const result = await getGroceryList(membership.organizationId, start, end);
  const items = result.data || [];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <PageHeader
        className="mb-6"
        title="Grocery List"
        description="Your shopping list for the week"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No items needed"
          description="Add recipes to your meal planner to generate a shopping list for the week."
          action={{ label: 'Open meal planner', href: '/meal-planner' }}
        />
      ) : (
        <AppErrorBoundary sectionLabel="Grocery list">
          <GroceryListClient items={items} weekStart={start} weekEnd={end} />
        </AppErrorBoundary>
      )}
    </div>
  );
}
