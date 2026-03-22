import type { TimerMode } from '@/lib/pomo/types';
import { getDuration } from './timerDefaults';

export const POMODOROS_PER_CYCLE = 4;

export interface ScheduleSegment {
  key: string;
  shortLabel: string;
  label: string;
  kind: 'focus' | 'break';
}

const SCHEDULE_SEGMENTS: readonly ScheduleSegment[] = [
  { key: 'pomodoro-1', shortLabel: 'P1', label: 'Pomodoro 1', kind: 'focus' },
  { key: 'break-1', shortLabel: 'B1', label: 'Break 1', kind: 'break' },
  { key: 'pomodoro-2', shortLabel: 'P2', label: 'Pomodoro 2', kind: 'focus' },
  { key: 'break-2', shortLabel: 'B2', label: 'Break 2', kind: 'break' },
  { key: 'pomodoro-3', shortLabel: 'P3', label: 'Pomodoro 3', kind: 'focus' },
  { key: 'break-3', shortLabel: 'B3', label: 'Break 3', kind: 'break' },
  { key: 'pomodoro-4', shortLabel: 'P4', label: 'Pomodoro 4', kind: 'focus' },
  { key: 'long-break', shortLabel: 'L', label: 'Long Break', kind: 'break' },
];

export const getScheduleSegments = (): readonly ScheduleSegment[] =>
  SCHEDULE_SEGMENTS;

export const getCyclePomodorosCompleted = (pomodorosCompleted: number) =>
  pomodorosCompleted % POMODOROS_PER_CYCLE;

export const isLongBreakSlot = (pomodorosCompleted: number) =>
  pomodorosCompleted > 0 &&
  getCyclePomodorosCompleted(pomodorosCompleted) === 0;

export const getScheduledBreakMode = (
  pomodorosCompleted: number
): Extract<TimerMode, 'short' | 'long'> =>
  (pomodorosCompleted + 1) % POMODOROS_PER_CYCLE === 0 ? 'long' : 'short';

export const getNextScheduledMode = (
  mode: TimerMode,
  pomodorosCompleted: number
): TimerMode =>
  mode === 'pomodoro' ? getScheduledBreakMode(pomodorosCompleted) : 'pomodoro';

export const getCurrentScheduleStep = (
  mode: TimerMode,
  pomodorosCompleted: number
) => {
  const cyclePomodorosCompleted = getCyclePomodorosCompleted(pomodorosCompleted);

  if (mode === 'pomodoro') {
    return cyclePomodorosCompleted * 2;
  }

  if (isLongBreakSlot(pomodorosCompleted)) {
    return SCHEDULE_SEGMENTS.length - 1;
  }

  return Math.max(0, cyclePomodorosCompleted * 2 - 1);
};

export const getCurrentCycleLabel = (
  mode: TimerMode,
  pomodorosCompleted: number
) => {
  const cyclePomodorosCompleted = getCyclePomodorosCompleted(pomodorosCompleted);

  if (mode === 'pomodoro') {
    return `Pomodoro ${cyclePomodorosCompleted + 1} of ${POMODOROS_PER_CYCLE}`;
  }

  if (isLongBreakSlot(pomodorosCompleted)) {
    return 'Long break';
  }

  return `Break ${cyclePomodorosCompleted} of ${POMODOROS_PER_CYCLE - 1}`;
};

export const getNextCycleLabel = (
  mode: TimerMode,
  pomodorosCompleted: number
) => {
  if (mode === 'pomodoro') {
    return getScheduledBreakMode(pomodorosCompleted) === 'long'
      ? 'Long break'
      : 'Short break';
  }

  const cyclePomodorosCompleted = getCyclePomodorosCompleted(pomodorosCompleted);
  const nextPomodoroNumber =
    cyclePomodorosCompleted === 0 ? 1 : cyclePomodorosCompleted + 1;

  return `Pomodoro ${nextPomodoroNumber} of ${POMODOROS_PER_CYCLE}`;
};

export const getCurrentSessionProgress = (
  mode: TimerMode,
  timeLeft: number
) => {
  const duration = getDuration(mode);

  if (duration <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (duration - timeLeft) / duration));
};
