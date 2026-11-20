import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getActiveMembership } from '@/lib/active-organization';
import { RoutinesClient } from '@/components/routines/routines-client';
import { RoutineFilters } from '@/components/routines/routine-filters';
import { PageHeader } from '@/components/ui/page-header';
import { AppErrorBoundary } from '@/components/ui/error-boundary';
import { loadCircadianLotteryHint } from '@/lib/circadian-data';

export default async function RoutinesPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  // The household (or other space) picked in the sidebar switcher
  const membership = await getActiveMembership(session.user.id);

  if (!membership) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No household assigned.</p>
      </div>
    );
  }

  // Fetch routines for this organization
  const [routines, circadianLottery] = await Promise.all([
    prisma.routine.findMany({
      where: {
        OR: [{ organizationId: membership.organizationId }, { isSystem: true }],
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    loadCircadianLotteryHint(session.user.id),
  ]);

  return (
    <div className="p-6">
      <PageHeader
        className="mb-6"
        title="Routines"
        description="Manage your habits and use the lottery to pick what to do next."
      />
      <div className="mb-6">
        <RoutineFilters />
      </div>

      <AppErrorBoundary sectionLabel="Routines">
        {/* Keyed by space: a switch remounts it instead of keeping the old space's state. */}
        <RoutinesClient
          key={membership.organizationId}
          organizationId={membership.organizationId}
          routines={routines}
          circadianLottery={circadianLottery}
        />
      </AppErrorBoundary>
    </div>
  );
}
