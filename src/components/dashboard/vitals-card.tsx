import { loadVitalsCardData, type VitalsCardData } from '@/lib/daily-metrics';
import { safeErrorLabel } from '@/lib/safe-error';
import { VitalsQuickLog } from './vitals-quick-log';

/**
 * Dashboard card: today's recovery score and the vitals quick log, or an opt-in prompt.
 * No vitals are loaded unless the user turned vitals tracking on.
 */
export async function VitalsCard({ userId }: { userId: string }) {
  let data: VitalsCardData;
  try {
    data = await loadVitalsCardData(userId);
  } catch (error) {
    // The rest of the dashboard still renders; health values are never logged.
    console.error(
      '[vitals] Failed to load the dashboard card:',
      safeErrorLabel(error)
    );
    return null;
  }
  return <VitalsQuickLog data={data} />;
}
