import {
  loadCircadianCardData,
  type CircadianCardData,
} from '@/lib/circadian-data';
import { safeErrorLabel } from '@/lib/safe-error';
import { CircadianPanel } from './circadian-panel';

/**
 * Dashboard card: time-of-day suggestions, a quick energy check-in and a meal nudge, in
 * the user's profile timezone. Renders nothing unless the user turned circadian
 * insights on in their profile.
 */
export async function CircadianCard({ userId }: { userId: string }) {
  let data: CircadianCardData | null;
  try {
    data = await loadCircadianCardData(userId);
  } catch (error) {
    // The rest of the dashboard still renders; health values are never logged.
    console.error(
      '[circadian] Failed to load the dashboard card:',
      safeErrorLabel(error)
    );
    return null;
  }
  if (!data) return null;
  return <CircadianPanel data={data} />;
}
