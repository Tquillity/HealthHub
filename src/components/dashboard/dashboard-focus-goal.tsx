import { getPremiumPomoDashboardSnapshot } from '@/actions/pomo-state';
import { FocusGoalCard } from '@/components/dashboard/focus-goal-card';
import { progressFromPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';

/** Streams in under a Suspense boundary: Pro users' progress comes from the cloud timer state. */
export async function DashboardFocusGoal() {
  const snapshot = await getPremiumPomoDashboardSnapshot();
  const progress =
    snapshot.isPremium && snapshot.payload
      ? progressFromPomoPayload(snapshot.payload)
      : null;

  return (
    <FocusGoalCard
      isPremiumCloud={snapshot.isPremium}
      initialServerProgress={progress}
    />
  );
}
