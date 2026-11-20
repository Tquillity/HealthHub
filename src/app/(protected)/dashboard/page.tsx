import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardHealthTip } from '@/components/dashboard/dashboard-health-tip';
import { DashboardFocusGoal } from '@/components/dashboard/dashboard-focus-goal';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardRecentRoutines } from '@/components/dashboard/dashboard-recent-routines';
import {
  DailyBriefingSkeleton,
  DashboardStatsSkeleton,
  FocusGoalSkeleton,
  RecentRoutinesSkeleton,
  VitalsCardSkeleton,
} from '@/components/dashboard/dashboard-skeletons';
import { VitalsCard } from '@/components/dashboard/vitals-card';
import { DailyBriefingCard } from '@/components/dashboard/daily-briefing-card';
import { SupportStatusWidget } from '@/components/dashboard/support-status-widget';

/**
 * The shell (greeting, quick actions, today's tip) needs only the session, so it renders at once.
 * Each data card is an async Server Component in its own Suspense boundary and streams in when its
 * query finishes. This is the streaming half of Partial Prerendering without `cacheComponents`,
 * which conflicts with the `(protected)` layout's `dynamic = 'force-dynamic'`.
 */
export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect('/sign-in');
  }

  const userId = session.user.id;
  const firstName = session.user.name.split(' ')[0] || session.user.name;

  return (
    <div className="max-w-7xl">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome back, {firstName}!</h1>
          <p className="text-gray-600 text-lg">
            Ready to take care of your health and wellness today?
          </p>
        </div>

        <Suspense fallback={<DailyBriefingSkeleton />}>
          <DailyBriefingCard userId={userId} />
        </Suspense>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 flex flex-col gap-6">
            <DashboardQuickActions />
            <DashboardHealthTip />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <Suspense fallback={<FocusGoalSkeleton />}>
              <DashboardFocusGoal />
            </Suspense>
            <Suspense fallback={<VitalsCardSkeleton />}>
              <VitalsCard userId={userId} />
            </Suspense>
            {/* Renders nothing unless household members share their status. */}
            <Suspense fallback={null}>
              <SupportStatusWidget />
            </Suspense>
            <Suspense fallback={<DashboardStatsSkeleton />}>
              <DashboardStats userId={userId} />
            </Suspense>
            <Suspense fallback={<RecentRoutinesSkeleton />}>
              <DashboardRecentRoutines userId={userId} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
