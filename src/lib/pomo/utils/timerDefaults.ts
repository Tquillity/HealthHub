import type { TimerMode } from '@/lib/pomo/types';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';

export const DEFAULT_DURATIONS: Record<TimerMode, number> = {
  pomodoro: 25,
  short: 5,
  long: 15,
};

export const getDuration = (mode: TimerMode): number => {
  const durations =
    useSettingsStore.getState?.()?.durations ?? DEFAULT_DURATIONS;
  return durations[mode] * 60;
};

/**
 * Whether editing the duration of `editedMode` should reset the current session (TIMER-12).
 * Only an idle session of the same mode is reset; otherwise the new length applies to the
 * next session of that mode.
 */
export const shouldResetSessionForDurationEdit = (
  editedMode: TimerMode,
  currentMode: TimerMode,
  isRunning: boolean
): boolean => editedMode === currentMode && !isRunning;
