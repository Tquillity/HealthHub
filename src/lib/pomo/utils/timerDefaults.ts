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
