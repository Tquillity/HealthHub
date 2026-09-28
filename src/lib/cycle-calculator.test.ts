import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateCyclePhase, getOvulationDay, getPhaseForDay } from '@/lib/cycle-calculator';

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
