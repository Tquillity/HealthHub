import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getGroceryList } from '@/actions/grocery-actions';
import { startOfWeek, endOfWeek } from 'date-fns';
import { Calendar } from 'lucide-react';
import { GroceryListClient } from '@/components/groceries/grocery-list-client';

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
    return <div>No household assigned.</div>;
  }

  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });

  const result = await getGroceryList(membership.organizationId, start, end);
  const items = result.data || [];

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Grocery List</h1>
        <p className="mt-1 text-gray-500">
          Your shopping list for the week
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No items needed
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Add recipes to your Meal Planner to generate a list.
          </p>
        </div>
      ) : (
        <GroceryListClient items={items} weekStart={start} weekEnd={end} />
      )}
    </div>
  );
}


