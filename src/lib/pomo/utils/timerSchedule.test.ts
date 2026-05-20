import { describe, it, expect } from 'vitest';
import {
  POMODOROS_PER_CYCLE,
  getCyclePomodorosCompleted,
  getCurrentScheduleStep,
  getNextScheduledMode,
  getScheduledBreakMode,
  isLongBreakSlot,
} from '@/lib/pomo/utils/timerSchedule';

describe('timerSchedule', () => {
  it('uses four pomodoros per cycle', () => {
    expect(POMODOROS_PER_CYCLE).toBe(4);
  });

  it('schedules a long break after every fourth pomodoro', () => {
    expect(getScheduledBreakMode(3)).toBe('long');
    expect(getScheduledBreakMode(7)).toBe('long');
    expect(getScheduledBreakMode(2)).toBe('short');
  });

  it('detects long break slots', () => {
    expect(isLongBreakSlot(4)).toBe(true);
    expect(isLongBreakSlot(8)).toBe(true);
    expect(isLongBreakSlot(3)).toBe(false);
  });

  it('wraps cycle pomodoro counts', () => {
    expect(getCyclePomodorosCompleted(0)).toBe(0);
    expect(getCyclePomodorosCompleted(4)).toBe(0);
    expect(getCyclePomodorosCompleted(5)).toBe(1);
  });

  it('advances from pomodoro to the scheduled break mode', () => {
    expect(getNextScheduledMode('pomodoro', 2)).toBe('short');
    expect(getNextScheduledMode('pomodoro', 3)).toBe('long');
    expect(getNextScheduledMode('short', 2)).toBe('pomodoro');
  });

  it('maps mode and completion count to schedule steps', () => {
    expect(getCurrentScheduleStep('pomodoro', 0)).toBe(0);
    expect(getCurrentScheduleStep('short', 1)).toBe(1);
    expect(getCurrentScheduleStep('long', 4)).toBe(7);
  });
});
