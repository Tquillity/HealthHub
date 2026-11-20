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
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('hasCycleEstimate / toGeneratorCycleOptions', () => {
  it('hides cycle options from people who do not track their cycle', () => {
    const off = { ...tracking, enableCycleTracking: false };
    expect(hasCycleEstimate(off)).toBe(false);
    expect(toGeneratorCycleOptions(off, 'HOUSEHOLD')).toBeNull();
    expect(toGeneratorCycleOptions(null, 'HOUSEHOLD')).toBeNull();
  });

  it('needs a last period date before the toggle can be used', () => {
    const noDate = { ...tracking, lastPeriodDate: null };
    expect(hasCycleEstimate(noDate)).toBe(false);
    expect(toGeneratorCycleOptions(noDate, 'HOUSEHOLD')).toEqual({
      canAlign: false,
      alignByDefault: true,
    });
  });

  it('treats a stored date outside 1900-9999 as no date', () => {
    // Saved before the profile action validated dates (a year typed as "25")
    const legacy = { ...tracking, lastPeriodDate: new Date('0025-11-03') };
    expect(hasCycleEstimate(legacy)).toBe(false);
    expect(toGeneratorCycleOptions(legacy, 'HOUSEHOLD')).toEqual({
      canAlign: false,
      alignByDefault: true,
    });
    expect(buildPhaseCalendar(legacy, ['2026-11-20'])).toEqual({});
    expect(hasCycleEstimate({ ...tracking, lastPeriodDate: new Date('invalid') })).toBe(false);
  });

  it('reflects the saved choice', () => {
    expect(
      toGeneratorCycleOptions({ ...tracking, alignMealsWithCycle: false }, 'HOUSEHOLD')
    ).toEqual({
      canAlign: true,
      alignByDefault: false,
    });
  });

  it('offers the toggle in households only, where the shared plan may follow a cycle', () => {
    expect(toGeneratorCycleOptions(tracking, 'HOUSEHOLD')).toEqual({
      canAlign: true,
      alignByDefault: true,
    });
    for (const type of ['COLLECTIVE', 'COMMUNITY', 'CORPORATE'] as const) {
      expect(toGeneratorCycleOptions(tracking, type), type).toBeNull();
    }
  });
});

describe('buildPhaseCalendar', () => {
  it('estimates a phase for each calendar day', () => {
    expect(
      buildPhaseCalendar(tracking, ['2026-11-03', '2026-11-08', '2026-11-12', '2026-11-20'])
    ).toEqual({
      '2026-11-03': 'menstrual',
      '2026-11-08': 'follicular',
      '2026-11-12': 'ovulation',
      '2026-11-20': 'luteal',
    });
  });

  it('leaves out days without an estimate', () => {
    expect(buildPhaseCalendar(tracking, ['2026-10-31', '2026-11-01'])).toEqual({
      '2026-11-01': 'menstrual',
    });
    expect(buildPhaseCalendar({ ...tracking, lastPeriodDate: null }, ['2026-11-01'])).toEqual(
      {}
    );
    expect(
      buildPhaseCalendar({ ...tracking, enableCycleTracking: false }, ['2026-11-01'])
    ).toEqual({});
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

    const data = await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD');

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'viewer' } })
    );
    expect(mocks.recipeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['bowl', 'toast'] } } })
    );
    expect(data).toEqual({
      generator: { canAlign: true, alignByDefault: true },
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
  });

  it('keeps the badges but hides the toggle outside households', async () => {
    mocks.userFindUnique.mockResolvedValue(tracking);
    mocks.recipeFindMany.mockResolvedValue([]);
    const data = await getMealPlannerCycleData('viewer', window, 'CORPORATE');
    expect(data.generator).toBeNull();
    // Badges are rendered for the viewer only
    expect(data.board?.phaseByDate['2026-11-18']).toBe('luteal');
  });

  it('shows no badges without a cycle estimate', async () => {
    mocks.userFindUnique.mockResolvedValue({ ...tracking, enableCycleTracking: false });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD')).toEqual({
      generator: null,
      board: null,
    });

    mocks.userFindUnique.mockResolvedValue({ ...tracking, lastPeriodDate: null });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD')).toEqual({
      generator: { canAlign: false, alignByDefault: true },
      board: null,
    });
    expect(mocks.recipeFindMany).not.toHaveBeenCalled();
  });

  it('loads the page for a stored date outside 1900-9999 instead of throwing', async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...tracking,
      lastPeriodDate: new Date('0025-11-03'),
    });
    expect(await getMealPlannerCycleData('viewer', window, 'HOUSEHOLD')).toEqual({
      generator: { canAlign: false, alignByDefault: true },
      board: null,
    });
  });
});
