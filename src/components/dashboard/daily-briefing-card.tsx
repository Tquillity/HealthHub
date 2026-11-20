import { loadBriefingState, type BriefingState } from '@/lib/briefing/data';
import { safeErrorLabel } from '@/lib/safe-error';
import { DailyBriefingPanel } from './daily-briefing-panel';

/**
 * Dashboard card: today's briefing for the signed-in user, in their profile timezone.
 * Renders nothing when the briefing is off, not due today (weekly) or hidden for today.
 */
export async function DailyBriefingCard({ userId }: { userId: string }) {
  let state: BriefingState;
  try {
    state = await loadBriefingState(userId);
  } catch (error) {
    // The rest of the dashboard still renders; health values are never logged.
    console.error(
      '[briefing] Failed to load the dashboard card:',
      safeErrorLabel(error)
    );
    return null;
  }
  if (state.status !== 'ready') return null;
  return <DailyBriefingPanel briefing={state.briefing} />;
}
