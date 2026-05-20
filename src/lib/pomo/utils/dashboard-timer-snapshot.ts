import type { HistoryByDate } from '@/lib/pomo/types';
import { getDailyGoalProgress } from '@/lib/pomo/utils/historyInsights';

export const POMO_TIME_STORAGE_KEY = 'pomo-time-storage';
export const POMO_SETTINGS_STORAGE_KEY = 'pomo-settings-storage';
export const DEFAULT_DAILY_GOAL_POMODOROS = 8;

type PersistedStore<T> = {
  state?: T;
  version?: number;
};

type TimePersistedState = {
  history?: HistoryByDate;
};

type SettingsPersistedState = {
  dailyGoalPomodoros?: number;
};

function unwrapPersistedState<T>(parsed: unknown): T | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as PersistedStore<T> & T;
  if ('state' in record && record.state && typeof record.state === 'object') {
    return record.state;
  }

  return record as T;
}

export function parseHistoryFromStorage(raw: string | null): HistoryByDate {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const state = unwrapPersistedState<TimePersistedState>(parsed);
    return state?.history ?? {};
  } catch {
    return {};
  }
}

export function parseDailyGoalFromStorage(raw: string | null): number {
  if (!raw) {
    return DEFAULT_DAILY_GOAL_POMODOROS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    const state = unwrapPersistedState<SettingsPersistedState>(parsed);
    const goal = state?.dailyGoalPomodoros;
    if (typeof goal === 'number' && goal >= 1 && goal <= 24) {
      return goal;
    }
  } catch {
    return DEFAULT_DAILY_GOAL_POMODOROS;
  }

  return DEFAULT_DAILY_GOAL_POMODOROS;
}

export function getDashboardTimerProgress(
  history: HistoryByDate,
  dailyGoalPomodoros: number,
  now = Date.now()
) {
  return getDailyGoalProgress(history, dailyGoalPomodoros, now);
}
