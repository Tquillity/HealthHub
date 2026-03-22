import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { RoutinesClient } from '@/components/routines/routines-client';
import { RoutineFilters } from '@/components/routines/routine-filters';
import { Sparkles } from 'lucide-react';

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

      {routines.length === 0 ? (
        <>
          <RoutinesClient routines={routines} />
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No routines yet
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Create your first routine to get started.
            </p>
          </div>
        </>
      ) : (
        <RoutinesClient routines={routines} />
      )}
    </div>
  );
}
