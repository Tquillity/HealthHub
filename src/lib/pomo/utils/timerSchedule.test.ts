import { describe, it, expect } from 'vitest';
import {
  POMODOROS_PER_CYCLE,
  getCyclePomodorosCompleted,
  getCurrentScheduleStep,
  getNextScheduledMode,
  getScheduledBreakMode,
  isLongBreakSlot,
  getScheduleSegments,
} from '@/lib/pomo/utils/timerSchedule';

describe('timerSchedule', () => {
  it('exposes eight schedule segments', () => {
    expect(getScheduleSegments()).toHaveLength(8);
  });

  it('computes cycle pomodoros modulo four', () => {
    expect(getCyclePomodorosCompleted(0)).toBe(0);
    expect(getCyclePomodorosCompleted(4)).toBe(0);
    expect(getCyclePomodorosCompleted(5)).toBe(1);
  });

  it('schedules long break after every fourth pomodoro', () => {
    expect(getScheduledBreakMode(3)).toBe('long');
    expect(getScheduledBreakMode(2)).toBe('short');
  });

  it('detects long break slot after a full cycle', () => {
    expect(isLongBreakSlot(4)).toBe(true);
    expect(isLongBreakSlot(3)).toBe(false);
  });

  it('returns pomodoro after any break mode', () => {
    expect(getNextScheduledMode('short', 1)).toBe('pomodoro');
    expect(getNextScheduledMode('long', 3)).toBe('pomodoro');
  });

  it('maps focus mode to even schedule steps', () => {
    expect(getCurrentScheduleStep('pomodoro', 0)).toBe(0);
    expect(getCurrentScheduleStep('pomodoro', 2)).toBe(4);
  });

  it('maps long break to final segment', () => {
    expect(getCurrentScheduleStep('long', POMODOROS_PER_CYCLE)).toBe(7);
  });
});
