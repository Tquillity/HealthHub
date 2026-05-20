import { describe, it, expect } from 'vitest';
import {
  getDashboardTimerProgress,
  parseDailyGoalFromStorage,
  parseHistoryFromStorage,
} from '@/lib/pomo/utils/dashboard-timer-snapshot';

describe('dashboard-timer-snapshot', () => {
  it('parses zustand-persisted timer history', () => {
    const raw = JSON.stringify({
      state: {
        history: {
          '2026-05-20': { pomodoro: 3, short: 1, long: 0 },
        },
      },
      version: 3,
    });

    expect(parseHistoryFromStorage(raw)).toEqual({
      '2026-05-20': { pomodoro: 3, short: 1, long: 0 },
    });
  });

  it('parses daily goal from settings storage', () => {
    const raw = JSON.stringify({
      state: { dailyGoalPomodoros: 6 },
      version: 2,
    });

    expect(parseDailyGoalFromStorage(raw)).toBe(6);
  });

  it('falls back when storage is missing or invalid', () => {
    expect(parseHistoryFromStorage(null)).toEqual({});
    expect(parseDailyGoalFromStorage('not-json')).toBe(8);
    expect(parseDailyGoalFromStorage(JSON.stringify({ state: { dailyGoalPomodoros: 0 } }))).toBe(
      8
    );
  });

  it('computes dashboard progress from parsed history', () => {
    const history = {
      '2026-05-20': { pomodoro: 2, short: 0, long: 0 },
    };
    const progress = getDashboardTimerProgress(history, 4, Date.parse('2026-05-20T12:00:00'));
    expect(progress.completed).toBe(2);
    expect(progress.remaining).toBe(2);
    expect(progress.percent).toBe(50);
  });
});
