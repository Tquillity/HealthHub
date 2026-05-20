import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  // Fetch household details from DB (session may not include active org yet)
  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  });

  if (!membership) {
    return <div>No household assigned.</div>;
  }

  // Fetch statistics and recent routines
  const [routines, routinesCount, recipesCount] = await Promise.all([
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
  ]);

  return (
    <div className="max-w-7xl">
      <DashboardClient
        recentRoutines={routines}
        routinesCount={routinesCount}
        recipesCount={recipesCount}
        userName={session.user.name}
      />
    </div>
  );
}
