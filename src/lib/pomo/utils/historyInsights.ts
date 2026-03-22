import { format, subDays } from 'date-fns';
import type { HistoryByDate } from '@/lib/pomo/types';

const EMPTY_DAILY_STATS = {
  pomodoro: 0,
  short: 0,
  long: 0,
};

const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const getStatsForDate = (history: HistoryByDate, date: Date) =>
  history[getDateKey(date)] ?? EMPTY_DAILY_STATS;

export const getPomodoroCountForDate = (history: HistoryByDate, date: Date) =>
  getStatsForDate(history, date).pomodoro;

export const getTodayPomodoroCount = (
  history: HistoryByDate,
  now = Date.now()
) => getPomodoroCountForDate(history, new Date(now));

export const getDailyGoalProgress = (
  history: HistoryByDate,
  goalPomodoros: number,
  now = Date.now()
) => {
  const goal = Math.max(1, goalPomodoros);
  const completed = getTodayPomodoroCount(history, now);

  return {
    goal,
    completed,
    remaining: Math.max(0, goal - completed),
    met: completed >= goal,
    percent: Math.min(100, Math.round((completed / goal) * 100)),
  };
};

export const getCurrentStreak = (
  history: HistoryByDate,
  minimumPomodoros: number,
  now = Date.now()
) => {
  const threshold = Math.max(1, minimumPomodoros);
  const today = new Date(now);
  const includesToday =
    getPomodoroCountForDate(history, today) >= threshold;

  let cursor = includesToday ? today : subDays(today, 1);
  let count = 0;

  while (getPomodoroCountForDate(history, cursor) >= threshold) {
    count += 1;
    cursor = subDays(cursor, 1);
  }

  return {
    count,
    includesToday,
  };
};

export const getGoalHitRate = (
  history: HistoryByDate,
  goalPomodoros: number
) => {
  const threshold = Math.max(1, goalPomodoros);
  const days = Object.values(history);

  if (days.length === 0) {
    return 0;
  }

  const goalDays = days.filter((day) => day.pomodoro >= threshold).length;
  return Math.round((goalDays / days.length) * 100);
};
