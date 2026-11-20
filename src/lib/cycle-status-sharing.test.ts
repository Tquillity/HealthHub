import { describe, expect, it } from 'vitest';
import { getPhaseForDay, type CyclePhase } from './cycle-calculator';
import {
  buildSupportSuggestion,
  cycleSnapshotOn,
  CYCLE_SHARE_LEVELS,
  CYCLE_SHARE_LEVEL_INFO,
  describeAudience,
  describeShareChange,
  firstNameOf,
  getEffectiveShareLevel,
  getTimeOfDay,
  isCoveredByShare,
  levelIncludes,
  listNames,
  membersNotYetIncluded,
  parseFocusPreference,
  projectCycleStatus,
  SetCycleStatusShareSchema,
  SUPPORT_MESSAGE_MAX_LENGTH,
  timeOfDayIn,
  TYPICAL_PHASE_ENERGY,
  UpdateSupportMessageSchema,
  type CycleShareHousehold,
  type CycleStatusSource,
  type SupportViewer,
  type TimeOfDay,
} from './cycle-status-sharing';
import type { FocusPreference } from '@/types/cycle';

const PHASES: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal'];
const FOCUSES: FocusPreference[] = ['workout', 'hormonal', 'both'];
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night', 'unknown'];

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
  it('needs a share with the household and cycle tracking', () => {
    const on = { level: 'ENERGY' as const, cycleConfigured: true };
    expect(getEffectiveShareLevel(on)).toBe('ENERGY');
    expect(getEffectiveShareLevel({ ...on, cycleConfigured: false })).toBe('NONE');
    expect(getEffectiveShareLevel({ ...on, level: 'NONE' })).toBe('NONE');
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

  it('uses neutral daytime wording when the viewer’s hour is unknown, never night ideas', () => {
    for (const phase of PHASES) {
      for (const viewerFocus of FOCUSES) {
        const input = { firstName: 'Sarah', phase, viewerFocus };
        const text = buildSupportSuggestion({ ...input, timeOfDay: 'unknown' });
        expect(text).toBe(buildSupportSuggestion({ ...input, timeOfDay: 'morning' }));
        expect(text).not.toBe(buildSupportSuggestion({ ...input, timeOfDay: 'night' }));
        expect(text).not.toMatch(/tonight|this evening|this afternoon|end of the day/);
      }
    }
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

  it('takes the time of day from a chosen time zone, and calls it unknown while the zone is unset', () => {
    // 03:00 UTC is 19:00 the evening before in Los Angeles; 22:00 UTC is 08:00 in Sydney.
    const lateUtc = new Date('2026-11-20T03:00:00Z');
    const eveningUtc = new Date('2026-11-20T22:00:00Z');
    expect(timeOfDayIn('America/Los_Angeles', lateUtc)).toBe('evening');
    expect(timeOfDayIn('Australia/Sydney', eveningUtc)).toBe('morning');
    expect(timeOfDayIn('Europe/Stockholm', lateUtc)).toBe('night');
    // The UTC default (or no usable zone) says nothing about where the viewer is.
    for (const stored of ['UTC', '', null, undefined, 'Not/AZone']) {
      expect(timeOfDayIn(stored, lateUtc)).toBe('unknown');
      expect(timeOfDayIn(stored, eveningUtc)).toBe('unknown');
    }
  });

  it('uses only the first name', () => {
    expect(firstNameOf('  Mikael  Andersson ')).toBe('Mikael');
    expect(firstNameOf('')).toBe('Someone');
    expect(firstNameOf(null)).toBe('Someone');
  });

  it('counts the cycle day and days until the next period on the given day', () => {
    const start = new Date('2026-11-01T00:00:00Z');
    expect(cycleSnapshotOn(start, 28, '2026-11-01')).toEqual({
      phase: 'menstrual',
      cycleDay: 1,
      daysUntilNextPeriod: 28,
    });
    expect(cycleSnapshotOn(start, 28, '2026-11-14')).toEqual({
      phase: 'ovulation',
      cycleDay: 14,
      daysUntilNextPeriod: 15,
    });
    expect(cycleSnapshotOn(start, 28, '2026-11-15')).toMatchObject({ phase: 'luteal', cycleDay: 15 });
    expect(cycleSnapshotOn(start, 28, '2026-11-28')?.daysUntilNextPeriod).toBe(1);
    // A new cycle starts after cycleLength days.
    expect(cycleSnapshotOn(start, 28, '2026-11-29')).toMatchObject({ phase: 'menstrual', cycleDay: 1 });
    // Same boundaries as the cycle page for every day.
    for (let day = 1; day <= 28; day += 1) {
      const key = `2026-11-${String(day).padStart(2, '0')}`;
      expect(cycleSnapshotOn(start, 28, key)?.phase).toBe(getPhaseForDay(day, 28));
    }
  });

  it('treats a period start after the sharer’s day as day 1 of the period, not follicular', () => {
    // Saved as "today" in Sydney before that day had started in the zone used for the lookup.
    expect(cycleSnapshotOn(new Date('2026-11-21T00:00:00Z'), 28, '2026-11-20')).toEqual({
      phase: 'menstrual',
      cycleDay: 1,
      daysUntilNextPeriod: 28,
    });
  });

  it('gives nothing for invalid input', () => {
    const start = new Date('2026-11-01T00:00:00Z');
    expect(cycleSnapshotOn(start, 28, '2026-11-31')).toBeNull();
    expect(cycleSnapshotOn(start, 0, '2026-11-02')).toBeNull();
    expect(cycleSnapshotOn(new Date('nope'), 28, '2026-11-02')).toBeNull();
  });

  it('reads focus preferences defensively', () => {
    expect(parseFocusPreference('workout')).toBe('workout');
    expect(parseFocusPreference('hormonal')).toBe('hormonal');
    expect(parseFocusPreference(null)).toBe('both');
    expect(parseFocusPreference('anything')).toBe('both');
  });
});

describe('SetCycleStatusShareSchema', () => {
  const valid = {
    organizationId: 'org_home',
    level: 'PHASE',
    listedMembersJoinedBy: '2026-11-20T10:00:00.000Z',
  };

  it('names one household, a level and when its members were listed', () => {
    expect(SetCycleStatusShareSchema.parse(valid)).toEqual(valid);
    expect(SetCycleStatusShareSchema.parse({ ...valid, level: 'NONE' }).level).toBe('NONE');
    expect(SetCycleStatusShareSchema.parse({ ...valid, includeNewMembers: true })).toMatchObject({
      includeNewMembers: true,
    });
  });

  it('rejects a missing household or list time, unknown levels and unknown fields', () => {
    expect(SetCycleStatusShareSchema.safeParse({ ...valid, organizationId: undefined }).success).toBe(
      false
    );
    expect(
      SetCycleStatusShareSchema.safeParse({ ...valid, listedMembersJoinedBy: undefined }).success
    ).toBe(false);
    expect(SetCycleStatusShareSchema.safeParse({ ...valid, organizationId: ' ' }).success).toBe(
      false
    );
    expect(
      SetCycleStatusShareSchema.safeParse({ ...valid, listedMembersJoinedBy: 'now' }).success
    ).toBe(false);
    expect(SetCycleStatusShareSchema.safeParse({ ...valid, level: 'ALL' }).success).toBe(false);
    expect(SetCycleStatusShareSchema.safeParse({ ...valid, level: 'phase' }).success).toBe(false);
    expect(SetCycleStatusShareSchema.safeParse({ ...valid, userId: 'someone-else' }).success).toBe(
      false
    );
  });
});

describe('UpdateSupportMessageSchema', () => {
  it('trims the message and accepts null to clear it', () => {
    expect(UpdateSupportMessageSchema.parse({ supportMessage: '  Tea, please  ' })).toEqual({
      supportMessage: 'Tea, please',
    });
    expect(UpdateSupportMessageSchema.parse({ supportMessage: null })).toEqual({
      supportMessage: null,
    });
  });

  it('rejects empty updates, unknown fields and long messages', () => {
    expect(UpdateSupportMessageSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateSupportMessageSchema.safeParse({ supportMessage: 'Hi', userId: 'someone-else' }).success
    ).toBe(false);
    const long = UpdateSupportMessageSchema.safeParse({
      supportMessage: 'x'.repeat(SUPPORT_MESSAGE_MAX_LENGTH + 1),
    });
    expect(long.success).toBe(false);
    expect(long.error?.issues[0]?.message).toBe('Keep your message to 280 characters or fewer');
  });
});

describe('who a share covers', () => {
  const household = (overrides: Partial<CycleShareHousehold> = {}): CycleShareHousehold => ({
    id: 'org_home',
    name: 'Our home',
    share: null,
    members: [
      { name: 'Robin Partner', seesStatus: false },
      { name: 'Sam Lodger', seesStatus: false },
    ],
    listedMembersJoinedBy: '2026-11-20T10:00:00.000Z',
    ...overrides,
  });
  const shared = { level: 'PHASE' as const, coversMembersJoinedBy: '2026-11-20T10:00:00.000Z' };

  it('covers members who had joined by the time the sharer agreed, nobody later', () => {
    expect(isCoveredByShare('2026-11-20T09:59:59.999Z', shared.coversMembersJoinedBy)).toBe(true);
    expect(isCoveredByShare('2026-11-20T10:00:00.000Z', shared.coversMembersJoinedBy)).toBe(true);
    expect(isCoveredByShare('2026-11-20T10:00:00.001Z', shared.coversMembersJoinedBy)).toBe(false);
    expect(isCoveredByShare(new Date('2026-11-21T00:00:00Z'), new Date(shared.coversMembersJoinedBy))).toBe(false);
  });

  it('names who would see it before sharing, and who sees it after', () => {
    expect(describeAudience(household())).toBe(
      'If you share, Robin Partner and Sam Lodger will see it. People who join later will not, until you include them.'
    );
    expect(
      describeAudience(
        household({
          share: shared,
          members: [
            { name: 'Robin Partner', seesStatus: true },
            { name: 'Sam Lodger', seesStatus: false },
          ],
        })
      )
    ).toBe('Seen by Robin Partner.');
    expect(describeAudience(household({ share: shared }))).toBe('Nobody in Our home sees it yet.');
    expect(describeAudience(household({ members: [] }))).toBe('Nobody else is in Our home yet.');
    expect(describeAudience(household({ members: [], share: shared }))).toBe(
      'Nobody else is in Our home yet. People who join later see nothing until you include them.'
    );
  });

  it('confirms a save with what is actually shared, and with whom', () => {
    const robinSees = [
      { name: 'Robin Partner', seesStatus: true },
      { name: 'Carol Later', seesStatus: false },
    ];
    expect(describeShareChange(household({ share: shared, members: robinSees }), true)).toBe(
      'Robin Partner now sees your cycle status: Phase only.'
    );
    expect(
      describeShareChange(
        household({
          share: { ...shared, level: 'FULL' },
          members: robinSees.map((member) => ({ ...member, seesStatus: true })),
        }),
        true
      )
    ).toBe('Robin Partner and Carol Later now see your cycle status: Full status.');
    // Nothing is shown without cycle tracking set up.
    expect(describeShareChange(household({ share: shared, members: robinSees }), false)).toBe(
      'Sharing with Our home is on, but nothing is shown until cycle tracking and your last period date are set.'
    );
    // Nobody to see it.
    expect(describeShareChange(household({ share: shared, members: [] }), true)).toBe(
      'Sharing with Our home is on, but nobody else is in it yet.'
    );
    expect(describeShareChange(household({ share: shared }), true)).toBe(
      'Sharing with Our home is on, but nobody there sees it yet.'
    );
    expect(describeShareChange(household(), true)).toBe(
      'Our home can no longer see your cycle status.'
    );
  });

  it('lists the members who joined later and do not see it', () => {
    expect(membersNotYetIncluded(household())).toEqual([]);
    expect(
      membersNotYetIncluded(
        household({
          share: shared,
          members: [
            { name: 'Robin Partner', seesStatus: true },
            { name: 'Carol Sitter', seesStatus: false },
          ],
        })
      )
    ).toEqual(['Carol Sitter']);
    expect(listNames(['A', 'B', 'C'])).toBe('A, B, and C');
  });
});
