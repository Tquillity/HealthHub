import type { HistoryByDate } from '@/lib/pomo/types';
import {
  DEFAULT_DAILY_GOAL_POMODOROS,
  getDashboardTimerProgress,
} from '@/lib/pomo/utils/dashboard-timer-snapshot';
import {
  createDefaultPomoStatePayload,
  type PomoStatePayload,
} from '@/lib/pomo/validation/pomo-state-schema';

export function progressFromPomoPayload(
  payload: PomoStatePayload,
  now: Date = new Date()
) {
  const history = (payload.timeStore.history ?? {}) as HistoryByDate;
  const dailyGoal =
    payload.settingsStore?.dailyGoalPomodoros ?? DEFAULT_DAILY_GOAL_POMODOROS;
  return getDashboardTimerProgress(history, dailyGoal, now.getTime());
}

export function isEmptyPomoPayload(payload: PomoStatePayload): boolean {
  const defaults = createDefaultPomoStatePayload();
  const history = payload.timeStore.history ?? {};
  return (
    Object.keys(history).length === 0 &&
    payload.taskStore.tasks.length === 0 &&
    payload.timeStore.pomodorosCompleted === defaults.timeStore.pomodorosCompleted
  );
}
