import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { RoutinesClient } from '@/components/routines/routines-client';
import { RoutineFilters } from '@/components/routines/routine-filters';

export default async function RoutinesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  // Get user's organization
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No household assigned.</p>
      </div>
    );
  }

  // Fetch routines for this organization
  const routines = await prisma.routine.findMany({
    where: {
      OR: [{ organizationId: membership.organizationId }, { isSystem: true }],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Routines</h1>
            <p className="mt-1 text-gray-500">
              Manage your habits and use the lottery to pick what to do next.
            </p>
          </div>
        </div>
        <RoutineFilters />
      </div>

      <RoutinesClient routines={routines} />
    </div>
  );
}
