import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateCyclePhase } from '@/lib/cycle-calculator';

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
});
