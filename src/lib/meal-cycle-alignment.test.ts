import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  recipeFindMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    recipe: { findMany: mocks.recipeFindMany },
  },
}));

import {
  boardDateKeys,
  buildPhaseCalendar,
  getMealPlannerCycleData,
  hasCycleEstimate,
  toGeneratorCycleOptions,
  type MealCycleSettings,
} from './meal-cycle-alignment';

const tracking: MealCycleSettings = {
  enableCycleTracking: true,
  cycleLength: 28,
  // Stored like the profile action stores it: UTC midnight of the calendar day
  lastPeriodDate: new Date(Date.UTC(2026, 10, 1)), // 2026-11-01
  alignMealsWithCycle: true,
  timezone: 'UTC',
};
// Day 20 of the cycle above: still inside it.
const today = '2026-11-20';
const now = new Date('2026-11-20T12:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasCycleEstimate / toGeneratorCycleOptions', () => {
  it('hides cycle options from people who do not track their cycle', () => {
    const off = { ...tracking, enableCycleTracking: false };
    expect(hasCycleEstimate(off)).toBe(false);
    expect(toGeneratorCycleOptions(off, 'HOUSEHOLD', today)).toBeNull();
    expect(toGeneratorCycleOptions(null, 'HOUSEHOLD', today)).toBeNull();
  });

  it('needs a last period date before the toggle can be used', () => {
    const noDate = { ...tracking, lastPeriodDate: null };
    expect(hasCycleEstimate(noDate)).toBe(false);
    expect(toGeneratorCycleOptions(noDate, 'HOUSEHOLD', today)).toEqual({
      canAlign: false,
      alignByDefault: true,
      cycleLongerThanUsual: false,
    });
  });

  it('treats a stored date outside 1900-9999 as no date', () => {
    // Saved before the profile action validated dates (a year typed as "25")
    const legacy = { ...tracking, lastPeriodDate: new Date('0025-11-03') };
    expect(hasCycleEstimate(legacy)).toBe(false);
    expect(toGeneratorCycleOptions(legacy, 'HOUSEHOLD', today)).toEqual({
      canAlign: false,
      alignByDefault: true,
      cycleLongerThanUsual: false,
    });
    expect(buildPhaseCalendar(legacy, ['2026-11-20'], today)).toEqual({});
    expect(hasCycleEstimate({ ...tracking, lastPeriodDate: new Date('invalid') })).toBe(false);
  });

  it('reflects the saved choice', () => {
    expect(
      toGeneratorCycleOptions({ ...tracking, alignMealsWithCycle: false }, 'HOUSEHOLD', today)
    ).toEqual({
      canAlign: true,
      alignByDefault: false,
      cycleLongerThanUsual: false,
    });
  });

  it('turns the toggle off and says why once the cycle is longer than usual', () => {
    // 2026-11-01 + 28 days: day 29 on 2026-11-29 is past the usual length (period late)
    expect(toGeneratorCycleOptions(tracking, 'HOUSEHOLD', '2026-11-28')).toEqual({
      canAlign: true,
      alignByDefault: true,
      cycleLongerThanUsual: false,
    });
    expect(toGeneratorCycleOptions(tracking, 'HOUSEHOLD', '2026-11-29')).toEqual({
      canAlign: false,
      alignByDefault: true,
      cycleLongerThanUsual: true,
    });
    // A long-stale date as well
    expect(
      toGeneratorCycleOptions(
        { ...tracking, lastPeriodDate: new Date(Date.UTC(2026, 5, 1)) },
        'HOUSEHOLD',
        today
      )
    ).toMatchObject({ canAlign: false, cycleLongerThanUsual: true });
    // A start date after the user's today (saved from an earlier time zone) is not late
    expect(
      toGeneratorCycleOptions(
        { ...tracking, lastPeriodDate: new Date(Date.UTC(2026, 10, 21)) },
        'HOUSEHOLD',
        today
      )
    ).toMatchObject({ canAlign: true, cycleLongerThanUsual: false });
  });

  it('offers the toggle in households only, where the shared plan may follow a cycle', () => {
    expect(toGeneratorCycleOptions(tracking, 'HOUSEHOLD', today)).toEqual({
      canAlign: true,
      alignByDefault: true,
      cycleLongerThanUsual: false,
    });
    for (const type of ['COLLECTIVE', 'COMMUNITY', 'CORPORATE'] as const) {
      expect(toGeneratorCycleOptions(tracking, type, today), type).toBeNull();
    }
  });
});

describe('buildPhaseCalendar', () => {
  it('estimates a phase for each calendar day', () => {
    expect(
      buildPhaseCalendar(
        tracking,
        ['2026-11-03', '2026-11-08', '2026-11-12', '2026-11-20'],
        today
      )
    ).toEqual({
      '2026-11-03': 'menstrual',
      '2026-11-08': 'follicular',
      '2026-11-12': 'ovulation',
      '2026-11-20': 'luteal',
    });
  });

  it('leaves out days without an estimate', () => {
    expect(buildPhaseCalendar(tracking, ['2026-10-31', '2026-11-01'], today)).toEqual({
      '2026-11-01': 'menstrual',
    });
    expect(
      buildPhaseCalendar({ ...tracking, lastPeriodDate: null }, ['2026-11-01'], today)
    ).toEqual({});
    expect(
      buildPhaseCalendar({ ...tracking, enableCycleTracking: false }, ['2026-11-01'], today)
    ).toEqual({});
  });

  const week = (first: number) =>
    Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(Date.UTC(2026, 10, first + offset));
      return day.toISOString().slice(0, 10);
    });

  it('projects the next cycle while today is still inside the current one', () => {
    // Today is day 20, so the period is not late: days 29 and later are the next cycle.
    expect(buildPhaseCalendar(tracking, week(26), today)).toEqual({
      '2026-11-26': 'luteal',
      '2026-11-27': 'luteal',
      '2026-11-28': 'luteal',
      '2026-11-29': 'menstrual',
      '2026-11-30': 'menstrual',
      '2026-12-01': 'menstrual',
      '2026-12-02': 'menstrual',
    });
  });

  it('gives no phase after the usual length once the period is late', () => {
    // Today is day 35 of a 28-day cycle: no new start was logged, so no new cycle is made up.
    const late = { ...tracking, lastPeriodDate: new Date(Date.UTC(2026, 9, 17)) }; // 2026-10-17
    expect(buildPhaseCalendar(late, week(10), today)).toEqual({
      '2026-11-10': 'luteal',
      '2026-11-11': 'luteal',
      '2026-11-12': 'luteal',
      '2026-11-13': 'luteal',
    });
    expect(buildPhaseCalendar(late, week(20), today)).toEqual({});
    // Months without a logged period: nothing at all.
    const stale = { ...tracking, lastPeriodDate: new Date(Date.UTC(2026, 5, 1)) };
    expect(buildPhaseCalendar(stale, week(20), today)).toEqual({});
  });
});

describe('boardDateKeys', () => {
  it('covers the board window plus two days on each side', () => {
    const keys = boardDateKeys(new Date(2026, 10, 23), 7);
    expect(keys).toHaveLength(11);
    expect(keys[0]).toBe('2026-11-21');
    expect(keys[2]).toBe('2026-11-23');
    expect(keys.at(-1)).toBe('2026-12-01');
  });
});

describe('getMealPlannerCycleData', () => {
  const window = {
    startDate: new Date(2026, 10, 18),
    days: 3,
    recipeIds: ['bowl', 'bowl', 'toast'],
  };

  it("reads only the viewer's own settings and sends phases, not cycle details", async () => {
    mocks.userFindUnique.mockResolvedValue(tracking);
    mocks.recipeFindMany.mockResolvedValue([
      {
        id: 'bowl',
        phaseTags: ['luteal'],
        nutrientHighlights: ['magnesium'],
        leanRole: 'Daily',
        ingredients: [],
      },
      {
        id: 'toast',
        phaseTags: [],
        nutrientHighlights: [],
        leanRole: null,
        ingredients: [{ name: 'Salt', unit: 'krm' }],
      },
    ]);

    const data = await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD', now);

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'viewer' } })
    );
    expect(mocks.recipeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['bowl', 'toast'] } } })
    );
    expect(data).toEqual({
      generator: { canAlign: true, alignByDefault: true, cycleLongerThanUsual: false },
      board: {
        phaseByDate: {
          '2026-11-16': 'luteal',
          '2026-11-17': 'luteal',
          '2026-11-18': 'luteal',
          '2026-11-19': 'luteal',
          '2026-11-20': 'luteal',
          '2026-11-21': 'luteal',
          '2026-11-22': 'luteal',
        },
        profiles: {
          bowl: { phases: ['luteal'], nutrients: ['magnesium'] },
          toast: { phases: [], nutrients: [] },
        },
      },
    });
    const json = JSON.stringify(data);
    expect(json).not.toContain('lastPeriodDate');
    expect(json).not.toContain('cycleLength');
    expect(json).not.toContain('2026-11-01');
    expect(json).not.toContain('timezone');
  });

  it("decides whether the period is late on the viewer's own day, in their profile time zone", async () => {
    // Day 28 ends on 2026-11-20. At 20:00 UTC it is still the 20th in UTC (on time), but
    // already the 21st, day 29, in Auckland (late).
    const dueToday = { ...tracking, lastPeriodDate: new Date(Date.UTC(2026, 9, 24)) };
    const evening = new Date('2026-11-20T20:00:00Z');
    mocks.recipeFindMany.mockResolvedValue([]);
    const phasesFor = async (timezone: string) => {
      mocks.userFindUnique.mockResolvedValue({ ...dueToday, timezone });
      const data = await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD', evening);
      return data.board?.phaseByDate;
    };

    const onTime = await phasesFor('UTC');
    expect(onTime?.['2026-11-20']).toBe('luteal');
    expect(onTime?.['2026-11-21']).toBe('menstrual');
    // A zone the runtime does not know falls back to UTC.
    expect(await phasesFor('Not/AZone')).toEqual(onTime);

    const late = await phasesFor('Pacific/Auckland');
    expect(late?.['2026-11-20']).toBe('luteal');
    expect(late).not.toHaveProperty('2026-11-21');
    expect(late).not.toHaveProperty('2026-11-22');
  });

  it('keeps the badges but hides the toggle outside households', async () => {
    mocks.userFindUnique.mockResolvedValue(tracking);
    mocks.recipeFindMany.mockResolvedValue([]);
    const data = await getMealPlannerCycleData('viewer', window, 'CORPORATE', now);
    expect(data.generator).toBeNull();
    // Badges are rendered for the viewer only
    expect(data.board?.phaseByDate['2026-11-18']).toBe('luteal');
  });

  it('shows no badges without a cycle estimate', async () => {
    mocks.userFindUnique.mockResolvedValue({ ...tracking, enableCycleTracking: false });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD', now)).toEqual({
      generator: null,
      board: null,
    });

    mocks.userFindUnique.mockResolvedValue({ ...tracking, lastPeriodDate: null });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD', now)).toEqual({
      generator: { canAlign: false, alignByDefault: true, cycleLongerThanUsual: false },
      board: null,
    });
    expect(mocks.recipeFindMany).not.toHaveBeenCalled();
  });

  it('loads the page for a stored date outside 1900-9999 instead of throwing', async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...tracking,
      lastPeriodDate: new Date('0025-11-03'),
    });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD', now)).toEqual({
      generator: { canAlign: false, alignByDefault: true, cycleLongerThanUsual: false },
      board: null,
    });
  });
});
