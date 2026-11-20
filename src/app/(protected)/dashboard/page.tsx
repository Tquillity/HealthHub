import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getActiveMembership } from '@/lib/active-organization';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getPremiumPomoDashboardSnapshot } from '@/actions/pomo-state';
import { progressFromPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  // The household (or other space) picked in the sidebar switcher
  const membership = await getActiveMembership(session.user.id);

  if (!membership) {
    return <div>No household assigned.</div>;
  }

  // Fetch statistics and recent routines
  const [routines, routinesCount, recipesCount, pomoSnapshot] = await Promise.all([
    prisma.routine.findMany({
      where: {
        OR: [
          { isSystem: true },
          { organizationId: membership.organizationId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.routine.count({
      where: {
        OR: [
          { isSystem: true },
          { organizationId: membership.organizationId },
        ],
      },
    }),
    prisma.recipe.count({
      where: {
        OR: [
          { isSystem: true },
          { organizationId: membership.organizationId },
        ],
      },
    }),
    getPremiumPomoDashboardSnapshot(),
  ]);

  const focusGoalProgress =
    pomoSnapshot.isPremium && pomoSnapshot.payload
      ? progressFromPomoPayload(pomoSnapshot.payload)
      : null;

  return (
    <div className="max-w-7xl">
      <DashboardClient
        recentRoutines={routines}
        routinesCount={routinesCount}
        recipesCount={recipesCount}
        userName={session.user.name}
        isPremiumCloud={pomoSnapshot.isPremium}
        focusGoalProgress={focusGoalProgress}
      />
    </div>
  );
}
