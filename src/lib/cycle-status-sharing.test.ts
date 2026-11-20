import { describe, expect, it } from 'vitest';
import type { CyclePhase } from './cycle-calculator';
import {
  buildSupportSuggestion,
  CYCLE_SHARE_LEVELS,
  CYCLE_SHARE_LEVEL_INFO,
  firstNameOf,
  getEffectiveShareLevel,
  getTimeOfDay,
  levelIncludes,
  parseFocusPreference,
  projectCycleStatus,
  SUPPORT_MESSAGE_MAX_LENGTH,
  toCycleSnapshot,
  TYPICAL_PHASE_ENERGY,
  UpdateCycleSharingSchema,
  type CycleStatusSource,
  type SupportViewer,
  type TimeOfDay,
} from './cycle-status-sharing';
import type { FocusPreference } from '@/types/cycle';

const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
const FOCUSES: FocusPreference[] = ['workout', 'hormonal', 'both'];
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

const viewer: SupportViewer = { focus: 'workout', timeOfDay: 'morning' };

function source(overrides: Partial<CycleStatusSource> = {}): CycleStatusSource {
  return {
    id: 'user-1',
    name: 'Mikael Andersson',
    level: 'FULL',
    snapshot: { phase: 'luteal', cycleDay: 20, daysUntilNextPeriod: 9 },
    todayEnergy: 6,
    supportMessage: 'A quiet evening would be lovely.',
    ...overrides,
  };
}

describe('projectCycleStatus', () => {
  it('shares nothing at NONE or without cycle data', () => {
    expect(projectCycleStatus(source({ level: 'NONE' }), viewer)).toBeNull();
    expect(projectCycleStatus(source({ snapshot: null }), viewer)).toBeNull();
  });

  it('PHASE reveals only the first name, the phase and a suggestion', () => {
    const status = projectCycleStatus(source({ level: 'PHASE', todayEnergy: 2 }), viewer);
    expect(status).toEqual({
      level: 'PHASE',
      id: 'user-1',
      firstName: 'Mikael',
      phase: { key: 'luteal', name: 'Luteal', color: '#6366f1' },
      suggestion:
        'Mikael is in the luteal phase. A low-intensity routine together could feel good today, like a walk, steady cardio or yoga.',
    });
    // The low logged energy must not leak through the suggestion either.
    expect(status?.suggestion).not.toMatch(/energy/i);
  });

  it('ENERGY adds the typical energy pattern and today’s logged energy', () => {
    const status = projectCycleStatus(source({ level: 'ENERGY' }), viewer);
    expect(Object.keys(status ?? {}).sort()).toEqual(
      ['firstName', 'id', 'level', 'phase', 'suggestion', 'todayEnergy', 'typicalEnergy'].sort()
    );
    expect(status).toMatchObject({
      level: 'ENERGY',
      typicalEnergy: TYPICAL_PHASE_ENERGY.luteal,
      todayEnergy: 6,
    });
    expect(JSON.stringify(status)).not.toContain('quiet evening');
  });

  it('FULL adds cycle day, days until the next period and the message', () => {
    const status = projectCycleStatus(source(), viewer);
    expect(Object.keys(status ?? {}).sort()).toEqual(
      [
        'cycleDay',
        'daysUntilNextPeriod',
        'firstName',
        'id',
        'level',
        'phase',
        'suggestion',
        'supportMessage',
        'todayEnergy',
        'typicalEnergy',
      ].sort()
    );
    expect(status).toMatchObject({
      level: 'FULL',
      cycleDay: 20,
      daysUntilNextPeriod: 9,
      supportMessage: 'A quiet evening would be lovely.',
    });
  });

  it('never passes on other fields, even if a caller hands them over', () => {
    const withExtras = {
      ...source(),
      notes: 'private journal note',
      symptomsPhysical: ['cramps'],
      bbt: 36.9,
      email: 'mikael@example.com',
    };
    for (const level of CYCLE_SHARE_LEVELS) {
      const json = JSON.stringify(projectCycleStatus({ ...withExtras, level }, viewer));
      for (const secret of ['private journal note', 'cramps', '36.9', 'mikael@example.com', 'Andersson']) {
        expect(json).not.toContain(secret);
      }
    }
  });

  it('drops invalid energy values and tidies the message', () => {
    for (const todayEnergy of [0, 11, 2.5, Number.NaN]) {
      expect(projectCycleStatus(source({ level: 'ENERGY', todayEnergy }), viewer)).toMatchObject({
        todayEnergy: null,
      });
    }
    expect(projectCycleStatus(source({ supportMessage: '   ' }), viewer)).toMatchObject({
      supportMessage: null,
    });
    const long = 'x'.repeat(SUPPORT_MESSAGE_MAX_LENGTH + 20);
    const status = projectCycleStatus(source({ supportMessage: long }), viewer);
    expect(status?.level === 'FULL' && status.supportMessage?.length).toBe(
      SUPPORT_MESSAGE_MAX_LENGTH
    );
  });
});

describe('getEffectiveShareLevel', () => {
  it('needs the master switch and cycle tracking', () => {
    const on = { shareCycleStatus: true, shareCycleLevel: 'ENERGY' as const, cycleConfigured: true };
    expect(getEffectiveShareLevel(on)).toBe('ENERGY');
    expect(getEffectiveShareLevel({ ...on, shareCycleStatus: false })).toBe('NONE');
    expect(getEffectiveShareLevel({ ...on, cycleConfigured: false })).toBe('NONE');
    expect(getEffectiveShareLevel({ ...on, shareCycleLevel: 'NONE' })).toBe('NONE');
  });

  it('orders levels from least to most', () => {
    expect(levelIncludes('FULL', 'ENERGY')).toBe(true);
    expect(levelIncludes('ENERGY', 'ENERGY')).toBe(true);
    expect(levelIncludes('PHASE', 'ENERGY')).toBe(false);
    expect(levelIncludes('NONE', 'PHASE')).toBe(false);
  });

  it('explains every level', () => {
    for (const level of CYCLE_SHARE_LEVELS) {
      expect(CYCLE_SHARE_LEVEL_INFO[level].description.length).toBeGreaterThan(10);
    }
  });
});

describe('buildSupportSuggestion', () => {
  it('matches the example from the issue', () => {
    expect(
      buildSupportSuggestion({
        firstName: 'Mikael',
        phase: 'luteal',
        viewerFocus: 'workout',
        timeOfDay: 'morning',
      })
    ).toBe(
      'Mikael is in the luteal phase. A low-intensity routine together could feel good today, like a walk, steady cardio or yoga.'
    );
  });

  it('fits the viewer’s focus and the time of day', () => {
    const base = { firstName: 'Sarah', phase: 'menstrual' as const };
    const movement = buildSupportSuggestion({ ...base, viewerFocus: 'workout', timeOfDay: 'evening' });
    const food = buildSupportSuggestion({ ...base, viewerFocus: 'hormonal', timeOfDay: 'evening' });
    expect(movement).not.toBe(food);
    expect(food).toBe(
      'Sarah is in the menstrual phase. A comforting, iron-rich meal this evening could be a kind gesture.'
    );
    expect(buildSupportSuggestion({ ...base, viewerFocus: 'hormonal', timeOfDay: 'afternoon' })).toContain(
      'this afternoon'
    );
    expect(buildSupportSuggestion({ ...base, viewerFocus: 'workout', timeOfDay: 'night' })).toBe(
      'Sarah is in the menstrual phase. Some quiet time and an early night could feel good tonight.'
    );
  });

  it('does not push hard training during a period; it follows their lead', () => {
    const text = buildSupportSuggestion({
      firstName: 'Sarah',
      phase: 'menstrual',
      viewerFocus: 'workout',
      timeOfDay: 'morning',
    });
    expect(text).toContain('Let them set the pace today');
    expect(text).not.toMatch(/encourage|push/i);
  });

  it('mentions logged energy only when it is low or high', () => {
    const base = {
      firstName: 'Sam',
      phase: 'follicular' as const,
      viewerFocus: 'both' as const,
      timeOfDay: 'morning' as const,
    };
    expect(buildSupportSuggestion({ ...base, todayEnergy: 2 })).toMatch(
      /Sam logged low energy today, so keeping plans easy could mean a lot\.$/
    );
    expect(buildSupportSuggestion({ ...base, todayEnergy: 9 })).toMatch(
      /Sam logged plenty of energy today\.$/
    );
    expect(buildSupportSuggestion({ ...base, todayEnergy: 5 })).not.toMatch(/logged/);
    expect(buildSupportSuggestion({ ...base, todayEnergy: null })).not.toMatch(/logged/);
  });

  it('is friendly and non-medical for every phase, focus and time of day', () => {
    for (const phase of PHASES) {
      for (const viewerFocus of FOCUSES) {
        for (const timeOfDay of TIMES) {
          const text = buildSupportSuggestion({ firstName: 'Alex', phase, viewerFocus, timeOfDay });
          expect(text.startsWith(`Alex is in the ${phase} phase. `)).toBe(true);
          expect(text).not.toMatch(
            /diagnos|treat|cure|disorder|PMS|PMDD|medic|symptom|should|must|\bshe\b|\bhe\b|\bher\b|\bhis\b/i
          );
          expect(text).not.toContain('  ');
          expect(text.endsWith('.')).toBe(true);
        }
      }
    }
  });
});

describe('helpers', () => {
  it('splits the day into parts', () => {
    expect(getTimeOfDay(4)).toBe('night');
    expect(getTimeOfDay(5)).toBe('morning');
    expect(getTimeOfDay(11)).toBe('morning');
    expect(getTimeOfDay(12)).toBe('afternoon');
    expect(getTimeOfDay(17)).toBe('evening');
    expect(getTimeOfDay(21)).toBe('evening');
    expect(getTimeOfDay(22)).toBe('night');
    expect(getTimeOfDay(0)).toBe('night');
  });

  it('uses only the first name', () => {
    expect(firstNameOf('  Mikael  Andersson ')).toBe('Mikael');
    expect(firstNameOf('')).toBe('Someone');
    expect(firstNameOf(null)).toBe('Someone');
  });

  it('counts days until the next expected period', () => {
    const result = { currentPhase: 'menstrual' as const, daysIntoCycle: 1, nextPeriodDate: new Date() };
    expect(toCycleSnapshot(result, 28)).toEqual({
      phase: 'menstrual',
      cycleDay: 1,
      daysUntilNextPeriod: 28,
    });
    expect(
      toCycleSnapshot({ ...result, currentPhase: 'luteal', daysIntoCycle: 28 }, 28).daysUntilNextPeriod
    ).toBe(1);
  });

  it('reads focus preferences defensively', () => {
    expect(parseFocusPreference('workout')).toBe('workout');
    expect(parseFocusPreference('hormonal')).toBe('hormonal');
    expect(parseFocusPreference(null)).toBe('both');
    expect(parseFocusPreference('anything')).toBe('both');
  });
});

describe('UpdateCycleSharingSchema', () => {
  it('accepts partial updates and trims the message', () => {
    expect(UpdateCycleSharingSchema.parse({ shareCycleStatus: false })).toEqual({
      shareCycleStatus: false,
    });
    expect(UpdateCycleSharingSchema.parse({ supportMessage: '  Tea, please  ' })).toEqual({
      supportMessage: 'Tea, please',
    });
    expect(UpdateCycleSharingSchema.parse({ supportMessage: null })).toEqual({
      supportMessage: null,
    });
  });

  it('rejects empty updates, unknown levels, unknown fields and long messages', () => {
    expect(UpdateCycleSharingSchema.safeParse({}).success).toBe(false);
    expect(UpdateCycleSharingSchema.safeParse({ shareCycleLevel: 'ALL' }).success).toBe(false);
    expect(UpdateCycleSharingSchema.safeParse({ shareCycleLevel: 'phase' }).success).toBe(false);
    expect(
      UpdateCycleSharingSchema.safeParse({ shareCycleStatus: true, userId: 'someone-else' }).success
    ).toBe(false);
    const long = UpdateCycleSharingSchema.safeParse({
      supportMessage: 'x'.repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1),
    });
    expect(long.success).toBe(false);
    expect(long.error?.issues[0]?.message).toBe('Keep your message to 280 characters or fewer');
  });
});
