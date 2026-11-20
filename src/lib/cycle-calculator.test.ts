import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculateCyclePhase,
  getOvulationDay,
  getPhaseForDateKey,
  getPhaseForDay,
} from '@/lib/cycle-calculator';

describe('calculateCyclePhase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-19T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns menstrual phase on cycle day 3', () => {
    const result = calculateCyclePhase(new Date('2026-05-17'), 28);
    expect(result.daysIntoCycle).toBe(3);
    expect(result.currentPhase).toBe('menstrual');
    expect(result.ovulationDay).toBe(14);
  });

  it('returns follicular phase mid-follicular window', () => {
    const result = calculateCyclePhase(new Date('2026-05-13'), 28);
    expect(result.daysIntoCycle).toBe(7);
    expect(result.currentPhase).toBe('follicular');
  });

  it('returns ovulation phase on the calculated ovulation day', () => {
    const result = calculateCyclePhase(new Date('2026-05-06'), 28);
    expect(result.daysIntoCycle).toBe(14);
    expect(result.currentPhase).toBe('ovulation');
  });

  it('returns luteal phase after ovulation', () => {
    const result = calculateCyclePhase(new Date('2026-05-01'), 28);
    expect(result.daysIntoCycle).toBe(19);
    expect(result.currentPhase).toBe('luteal');
  });

  it('calculates ovulationDay as cycleLength minus 14', () => {
    const result = calculateCyclePhase(new Date('2026-04-19'), 35);
    expect(result.ovulationDay).toBe(21);
  });

  it('defaults to follicular when last period is in the future', () => {
    const result = calculateCyclePhase(new Date('2026-05-25'), 28);
    expect(result.currentPhase).toBe('follicular');
    expect(result.daysIntoCycle).toBe(1);
  });

  it('places ovulation 14 days before the next period on short cycles', () => {
    // 21-day cycle: ovulation ~day 7, not clamped to day 14
    const result = calculateCyclePhase(new Date('2026-05-13'), 21);
    expect(result.ovulationDay).toBe(7);
    expect(result.daysIntoCycle).toBe(7);
    expect(result.currentPhase).toBe('ovulation');
  });

  it('keeps a ~14 day luteal phase on a 24-day cycle', () => {
    const result = calculateCyclePhase(new Date('2026-05-08'), 24);
    expect(result.ovulationDay).toBe(10);
    expect(result.daysIntoCycle).toBe(12);
    expect(result.currentPhase).toBe('luteal');
  });
});

describe('getOvulationDay', () => {
  it.each([
    [20, 6],
    [21, 7],
    [28, 14],
    [35, 21],
    [45, 31],
  ])('cycle length %i ovulates on day %i', (cycleLength, expected) => {
    expect(getOvulationDay(cycleLength)).toBe(expected);
  });
});

describe('getPhaseForDay', () => {
  it('uses cycle-length-aware boundaries', () => {
    // 28-day cycle: ovulation day 14, window 11-14
    expect(getPhaseForDay(5, 28)).toBe('menstrual');
    expect(getPhaseForDay(10, 28)).toBe('follicular');
    expect(getPhaseForDay(11, 28)).toBe('ovulation');
    expect(getPhaseForDay(15, 28)).toBe('luteal');
    // 21-day cycle: ovulation day 7, so day 12 is already luteal
    expect(getPhaseForDay(6, 21)).toBe('ovulation');
    expect(getPhaseForDay(12, 21)).toBe('luteal');
    // 35-day cycle: ovulation day 21, so day 16 is still follicular
    expect(getPhaseForDay(16, 35)).toBe('follicular');
  });
});

describe('getPhaseForDateKey', () => {
  // Stored like the profile action stores it: UTC midnight of the calendar day
  const periodStart = new Date(Date.UTC(2026, 10, 1)); // 2026-11-01

  it('projects the phase of any calendar day from the last period start', () => {
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-01')).toBe('menstrual');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-05')).toBe('menstrual');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-06')).toBe('follicular');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-11')).toBe('ovulation');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-14')).toBe('ovulation');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-15')).toBe('luteal');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-28')).toBe('luteal');
    // Day 29 starts the next projected cycle
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-29')).toBe('menstrual');
  });

  it('matches getPhaseForDay for every day of several cycles', () => {
    for (let offset = 0; offset < 90; offset += 1) {
      const day = new Date(periodStart.getTime() + offset * 86_400_000);
      const key = day.toISOString().slice(0, 10);
      expect(getPhaseForDateKey(periodStart, 32, key), key).toBe(
        getPhaseForDay((offset % 32) + 1, 32)
      );
    }
  });

  it('is not shifted by daylight saving time', () => {
    // Europe switches to summer time on 2027-03-28; counting whole UTC days stays exact
    const winterStart = new Date(Date.UTC(2027, 2, 1)); // 2027-03-01
    expect(getPhaseForDateKey(winterStart, 28, '2027-03-28')).toBe('luteal');
    expect(getPhaseForDateKey(winterStart, 28, '2027-03-29')).toBe('menstrual');
  });

  it('projects the next cycle only while today is still inside the current one', () => {
    // Today is day 20: the period is not due yet, so day 29 starts the projected next cycle.
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-28', '2026-11-20')).toBe('luteal');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-29', '2026-11-20')).toBe('menstrual');
    expect(getPhaseForDateKey(periodStart, 28, '2026-12-27', '2026-11-28')).toBe('menstrual');
    // Today is day 29 or later and no new start was logged: the next start is unknown, so
    // every day from day 29 on has no estimate (the daily briefing pauses there too).
    for (const today of ['2026-11-29', '2026-12-05', '2027-04-01']) {
      expect(getPhaseForDateKey(periodStart, 28, '2026-11-28', today)).toBe('luteal');
      expect(getPhaseForDateKey(periodStart, 28, '2026-11-29', today)).toBeNull();
      expect(getPhaseForDateKey(periodStart, 28, '2026-12-05', today)).toBeNull();
      expect(getPhaseForDateKey(periodStart, 28, '2027-01-15', today)).toBeNull();
    }
    // A today before the start (saved ahead of time) is not late.
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-29', '2026-10-30')).toBe('menstrual');
    expect(getPhaseForDateKey(periodStart, 28, '2026-11-29', '2026-02-30')).toBeNull();
  });

  it('has no estimate before the last period start or for invalid input', () => {
    expect(getPhaseForDateKey(periodStart, 28, '2026-10-31')).toBeNull();
    expect(getPhaseForDateKey(periodStart, 28, '2026-02-30')).toBeNull();
    expect(getPhaseForDateKey(periodStart, 0, '2026-11-02')).toBeNull();
    expect(getPhaseForDateKey(new Date('invalid'), 28, '2026-11-02')).toBeNull();
  });

  it('has no estimate, and does not throw, for a stored date outside 1900-9999', () => {
    // Rows saved before the profile action validated dates (a year typed as "25")
    const legacy = [
      new Date('0025-11-03'),
      new Date(Date.UTC(1899, 11, 31)),
      new Date(Date.UTC(10000, 0, 1)),
      new Date(Date.UTC(-25, 0, 1)),
    ];
    for (const lastPeriodDate of legacy) {
      expect(() => getPhaseForDateKey(lastPeriodDate, 28, '2026-11-20')).not.toThrow();
      expect(getPhaseForDateKey(lastPeriodDate, 28, '2026-11-20')).toBeNull();
    }
  });
});
