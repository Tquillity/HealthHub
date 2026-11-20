import { describe, expect, it } from 'vitest';
import {
  buildCycleHistory,
  completedCycleLengths,
  findCycleForDate,
  getCycleDayInfo,
  getOpenCycle,
  normalizePeriodStarts,
} from '@/lib/cycle-history';

describe('normalizePeriodStarts', () => {
  it('sorts, de-duplicates and merges extra dates', () => {
    expect(
      normalizePeriodStarts(
        ['2026-03-29', '2026-03-01', '2026-03-29'],
        '2026-04-26',
        null,
        undefined
      )
    ).toEqual(['2026-03-01', '2026-03-29', '2026-04-26']);
  });

  it('drops invalid dates', () => {
    expect(normalizePeriodStarts(['2026-02-30', 'x', '2026-02-01'])).toEqual([
      '2026-02-01',
    ]);
  });
});

describe('buildCycleHistory', () => {
  it('returns no cycles without period starts', () => {
    expect(buildCycleHistory([])).toEqual([]);
  });

  it('builds completed cycles with their real length and an open last cycle', () => {
    const cycles = buildCycleHistory([
      '2026-04-26',
      '2026-03-01',
      '2026-03-29',
    ]);
    expect(cycles).toEqual([
      {
        index: 0,
        start: '2026-03-01',
        end: '2026-03-28',
        length: 28,
        isOpen: false,
      },
      {
        index: 1,
        start: '2026-03-29',
        end: '2026-04-25',
        length: 28,
        isOpen: false,
      },
      { index: 2, start: '2026-04-26', end: null, length: null, isOpen: true },
    ]);
    expect(getOpenCycle(cycles)?.start).toBe('2026-04-26');
    expect(completedCycleLengths(cycles)).toEqual([28, 28]);
  });

  it('handles irregular lengths and month boundaries', () => {
    const cycles = buildCycleHistory([
      '2026-01-20',
      '2026-02-24',
      '2026-03-17',
    ]);
    expect(completedCycleLengths(cycles)).toEqual([35, 21]);
    expect(cycles[0].end).toBe('2026-02-23');
  });
});

describe('findCycleForDate', () => {
  const cycles = buildCycleHistory(['2026-03-01', '2026-03-29']);

  it('finds the cycle a day belongs to, including first and last days', () => {
    expect(findCycleForDate(cycles, '2026-03-01')?.index).toBe(0);
    expect(findCycleForDate(cycles, '2026-03-28')?.index).toBe(0);
    expect(findCycleForDate(cycles, '2026-03-29')?.index).toBe(1);
    expect(findCycleForDate(cycles, '2026-12-31')?.index).toBe(1);
  });

  it('returns null before the first logged start', () => {
    expect(findCycleForDate(cycles, '2026-02-28')).toBeNull();
    expect(findCycleForDate([], '2026-02-28')).toBeNull();
  });
});

describe('getCycleDayInfo', () => {
  // 32-day completed cycle, then an open cycle.
  const cycles = buildCycleHistory(['2026-03-01', '2026-04-02']);

  it('uses the actual length for completed cycles', () => {
    // 32-day cycle: ovulation estimated on day 18 (32 - 14), window days 15-18.
    const info = getCycleDayInfo(cycles, '2026-03-18', 28);
    expect(info).toMatchObject({
      cycleDay: 18,
      phase: 'ovulation',
      phaseCycleLength: 32,
    });
    // Same cycle day in a 28-day model would already be luteal.
    expect(getCycleDayInfo(cycles, '2026-03-19', 28)?.phase).toBe('luteal');
    expect(getCycleDayInfo(cycles, '2026-03-14', 28)?.phase).toBe('follicular');
  });

  it("uses the user's typical length for the open cycle", () => {
    const info = getCycleDayInfo(cycles, '2026-04-15', 28);
    expect(info).toMatchObject({
      cycleDay: 14,
      phase: 'ovulation',
      phaseCycleLength: 28,
    });
    expect(getCycleDayInfo(cycles, '2026-04-02', 28)?.phase).toBe('menstrual');
  });

  it('treats late days of the open cycle as luteal', () => {
    expect(getCycleDayInfo(cycles, '2026-05-10', 28)).toMatchObject({
      cycleDay: 39,
      phase: 'luteal',
    });
  });

  it('returns null before the first start', () => {
    expect(getCycleDayInfo(cycles, '2026-02-01', 28)).toBeNull();
  });
});
