import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from '@/lib/date-only';
import { buildPhaseResolver, describeTodayPhase } from './phase';
import type { BriefingCycleData } from './types';

const OPEN_START = '2026-10-29';
const cycleDay = (day: number) => addDaysToDateOnly(OPEN_START, day - 1);

const base: BriefingCycleData = {
  typicalCycleLength: 28,
  periodStarts: ['2026-10-01', OPEN_START],
  bbtReadings: [],
};

describe('buildPhaseResolver', () => {
  it('places days on the calendar model of their cycle', () => {
    const { phaseOf } = buildPhaseResolver(base);
    expect(phaseOf('2026-10-03')).toMatchObject({
      phase: 'menstrual',
      cycleDay: 3,
      inOpenCycle: false,
    });
    expect(phaseOf('2026-10-10')?.phase).toBe('follicular');
    expect(phaseOf('2026-10-20')?.phase).toBe('luteal');
    expect(phaseOf(cycleDay(23))).toMatchObject({
      phase: 'luteal',
      cycleDay: 23,
      temperatureConfirmed: false,
      inOpenCycle: true,
    });
    expect(phaseOf('2026-09-15')).toBeNull();
  });

  it('gives an overdue cycle no phase instead of calling every later day luteal', () => {
    const resolver = buildPhaseResolver(base);
    // The last day of the typical length is still luteal ...
    expect(resolver.phaseOf(cycleDay(28))).toMatchObject({
      phase: 'luteal',
      cycleDay: 28,
    });
    // ... after it there is no estimate (and no wrapping to a guessed new cycle).
    const today = cycleDay(34);
    expect(resolver.phaseOf(today)).toMatchObject({
      phase: null,
      cycleDay: 34,
      inOpenCycle: true,
    });
    expect(describeTodayPhase(resolver, base, today)).toMatchObject({
      phase: null,
      cycleDay: 34,
      pastTypicalLength: true,
    });
    expect(resolver.phaseOf(cycleDay(180))?.phase).toBeNull();
    expect(
      describeTodayPhase(resolver, base, cycleDay(20))?.pastTypicalLength
    ).toBe(false);
  });

  it('keeps the phases of a completed long cycle', () => {
    // A completed 40-day cycle is placed on its real length: day 35 is luteal.
    const resolver = buildPhaseResolver({
      ...base,
      periodStarts: ['2026-09-19', OPEN_START],
    });
    expect(resolver.phaseOf('2026-10-23')).toMatchObject({
      phase: 'luteal',
      cycleDay: 35,
      inOpenCycle: false,
    });
  });

  it('moves the phases to a BBT-confirmed ovulation day', () => {
    // Six low readings on days 12-17, then three high ones: ovulation on day 17,
    // three days later than the calendar estimate (day 14).
    const bbtReadings = [
      ...[12, 13, 14, 15, 16, 17].map((day) => ({
        date: cycleDay(day),
        celsius: 36.4,
      })),
      ...[18, 19, 20].map((day) => ({ date: cycleDay(day), celsius: 36.7 })),
    ];
    const withBbt = { ...base, bbtReadings };
    const { phaseOf } = buildPhaseResolver(withBbt);
    // Calendar alone says luteal from day 15.
    expect(buildPhaseResolver(base).phaseOf(cycleDay(16))?.phase).toBe(
      'luteal'
    );
    expect(phaseOf(cycleDay(16))).toMatchObject({
      phase: 'ovulation',
      temperatureConfirmed: false,
    });
    expect(phaseOf(cycleDay(18))).toMatchObject({
      phase: 'luteal',
      temperatureConfirmed: true,
    });
    expect(phaseOf(cycleDay(3))?.phase).toBe('menstrual');
    expect(phaseOf(cycleDay(10))?.phase).toBe('follicular');
    // A measured late ovulation keeps the luteal phase until that day + 14 (day 31),
    // past the typical 28 days, then there is no estimate either.
    expect(phaseOf(cycleDay(30))).toMatchObject({
      phase: 'luteal',
      temperatureConfirmed: true,
    });
    expect(phaseOf(cycleDay(31))?.phase).toBe('luteal');
    expect(phaseOf(cycleDay(32))).toMatchObject({
      phase: null,
      temperatureConfirmed: false,
    });
    expect(describeTodayPhase(buildPhaseResolver(withBbt), withBbt, cycleDay(30)))
      .toMatchObject({ phase: 'luteal', pastTypicalLength: true });
  });
});
