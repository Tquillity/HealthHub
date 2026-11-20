import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from '@/lib/date-only';
import type { DailyMetricsRow } from '@/lib/cycle-insights';
import { buildDailyBriefing } from './engine';
import type {
  BriefingCycleData,
  BriefingEngineInput,
  BriefingVitalsData,
  BriefingFeedbackEntry,
  BriefingJournalDay,
  DailyBriefing,
} from './types';

// Friday 20 November 2026: cycle day 23 (late luteal) of a cycle that began on 29 October.
const TODAY = '2026-11-20';
const CYCLE: BriefingCycleData = {
  typicalCycleLength: 28,
  periodStarts: ['2026-10-01', '2026-10-29'],
  bbtReadings: [],
};

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) out.push(d);
  return out;
}

function journalDay(
  date: string,
  values: Partial<BriefingJournalDay> = {}
): BriefingJournalDay {
  return {
    date,
    mood: null,
    energy: null,
    sleepHours: null,
    symptoms: [],
    checkIn: true,
    ...values,
  };
}

function input(
  overrides: Partial<BriefingEngineInput> = {}
): BriefingEngineInput {
  return {
    today: TODAY,
    focus: 'both',
    detail: 'brief',
    journal: null,
    cycle: null,
    meals: null,
    vitals: null,
    feedback: [],
    ...overrides,
  };
}

/** Recovery score inputs as the Vitals card loads them. */
function vitalsData(
  rows: DailyMetricsRow[],
  periodStarts: string[] | null = null
): BriefingVitalsData {
  return { rows, periodStarts, typicalCycleLength: 28 };
}

const keys = (briefing: DailyBriefing) =>
  briefing.suggestions.map((s) => s.key);

/** Usual luteal energy 7 last cycle; 4-5 over the last 3 days. */
const LOW_ENERGY_JOURNAL = [
  ...days('2026-10-15', '2026-10-28').map((date) =>
    journalDay(date, { energy: 7, mood: 7 })
  ),
  journalDay('2026-11-18', { energy: 4, mood: 4 }),
  journalDay('2026-11-19', { energy: 4, mood: 5 }),
  journalDay('2026-11-20', { energy: 5, mood: 4 }),
];

const NOTHING_PLANNED = { days: [], cookedTracking: false };

describe('buildDailyBriefing: phase comparison', () => {
  it('suggests moderate routines and magnesium when luteal energy is below usual', () => {
    const briefing = buildDailyBriefing(
      input({ cycle: CYCLE, journal: LOW_ENERGY_JOURNAL })
    );
    expect(briefing.phase).toMatchObject({ phase: 'luteal', cycleDay: 23 });
    expect(keys(briefing)).toEqual([
      'routine.ease-intensity',
      'meal.magnesium',
    ]);

    const [ease, magnesium] = briefing.suggestions;
    expect(ease).toMatchObject({
      category: 'routine',
      urgency: 'high',
      title: 'Swap high intensity for moderate this week',
      action: {
        href: '/routines?energy=medium',
        label: 'Browse moderate routines',
      },
      rating: null,
    });
    expect(ease.body).toContain('lower than your usual for the luteal phase');
    expect(ease.evidence).toContain(
      'Energy: 4.3/10 on average over your last 3 check-ins.'
    );
    expect(ease.evidence).toContain(
      'Your usual for the luteal phase: about 7/10.'
    );
    expect(ease.evidence.some((line) => line.startsWith('Mood:'))).toBe(true);
    expect(magnesium.category).toBe('meal');
    expect(briefing.headline).toBe(
      "A gentler day may suit you. Here's what your recent logs suggest."
    );
  });

  it('says when energy is compared with the typical pattern', () => {
    const briefing = buildDailyBriefing(
      input({
        cycle: CYCLE,
        journal: [
          journalDay('2026-11-19', { energy: 3 }),
          journalDay('2026-11-20', { energy: 2 }),
        ],
      })
    );
    const ease = briefing.suggestions.find(
      (s) => s.key === 'routine.ease-intensity'
    );
    expect(ease?.body).toContain('the typical pattern for the luteal phase');
    expect(briefing.notes.join(' ')).toContain('typical pattern');
  });

  it('encourages a challenging routine on good follicular energy', () => {
    const briefing = buildDailyBriefing(
      input({
        today: '2026-11-06', // cycle day 9: follicular
        cycle: CYCLE,
        journal: [
          ...days('2026-10-06', '2026-10-10').map((date) =>
            journalDay(date, { energy: 6 })
          ),
          journalDay('2026-11-05', { energy: 8 }),
          journalDay('2026-11-06', { energy: 8 }),
        ],
      })
    );
    expect(keys(briefing)).toEqual([
      'routine.go-for-it',
      'meal.follicular-foods',
    ]);
    expect(briefing.suggestions[0].body).toContain('follicular phase');
    expect(briefing.headline).toContain('doing well');
  });

  it('suggests iron during and just after the period', () => {
    const during = buildDailyBriefing(
      input({ today: '2026-10-31', cycle: CYCLE })
    );
    expect(during.suggestions[0]).toMatchObject({
      key: 'meal.iron',
      title: 'Add iron-rich foods',
    });
    const after = buildDailyBriefing(
      input({ today: '2026-11-05', cycle: CYCLE })
    );
    expect(after.phase?.phase).toBe('follicular');
    expect(after.suggestions[0]).toMatchObject({
      key: 'meal.iron',
      title: 'Prioritise iron-rich recipes this week',
    });
    const later = buildDailyBriefing(
      input({ today: '2026-11-06', cycle: CYCLE })
    );
    expect(keys(later)).toEqual(['meal.follicular-foods']);
    const ovulation = buildDailyBriefing(
      input({ today: '2026-11-08', cycle: CYCLE })
    );
    expect(keys(ovulation)).toEqual(['meal.ovulation-foods']);
  });
});

describe('buildDailyBriefing: focus preference', () => {
  // Energy below usual (no mood dip): routine 67, magnesium 50, meal planning 50.
  const journal = LOW_ENERGY_JOURNAL.map((day) => ({ ...day, mood: null }));
  const base = input({ cycle: CYCLE, journal, meals: NOTHING_PLANNED });

  it('orders by relevance for "both"', () => {
    expect(keys(buildDailyBriefing(base))).toEqual([
      'routine.ease-intensity',
      'meal.magnesium',
      'meal.plan-ahead',
    ]);
  });

  it('puts meal and cycle nutrition first for "hormonal"', () => {
    expect(keys(buildDailyBriefing({ ...base, focus: 'hormonal' }))).toEqual([
      'meal.magnesium',
      'meal.plan-ahead',
      'routine.ease-intensity',
    ]);
  });

  it('puts routine and recovery first for "workout"', () => {
    const briefing = buildDailyBriefing({
      ...base,
      focus: 'workout',
      journal: [
        ...journal.slice(0, -3),
        journalDay('2026-11-18', { energy: 4, sleepHours: 6.5 }),
        journalDay('2026-11-19', { energy: 4, sleepHours: 6.5 }),
        journalDay('2026-11-20', { energy: 5, sleepHours: 6.5 }),
      ],
    });
    expect(keys(briefing)).toEqual([
      'routine.ease-intensity',
      'recovery.sleep',
      'meal.magnesium',
    ]);
  });
});

describe('buildDailyBriefing: recovery', () => {
  const vitalsRow = (
    date: string,
    values: Partial<DailyMetricsRow> = {}
  ): DailyMetricsRow => ({
    date,
    temperature: null,
    restingHeartRate: 60,
    heartRateVariability: 50,
    sleepQuality: 8,
    sleepHours: null,
    ...values,
  });
  const usual = days('2026-10-20', '2026-11-18').map((date) => vitalsRow(date));

  it('suggests a rest day first when recovery is low, even for a "hormonal" focus', () => {
    const briefing = buildDailyBriefing(
      input({
        focus: 'hormonal',
        cycle: CYCLE,
        vitals: vitalsData(
          [
            ...usual,
            vitalsRow('2026-11-19'),
            vitalsRow(TODAY, {
              restingHeartRate: 72,
              heartRateVariability: 25,
              sleepQuality: 3,
            }),
          ],
          CYCLE.periodStarts
        ),
      })
    );
    expect(keys(briefing)).toEqual(['recovery.rest-day', 'meal.magnesium']);
    expect(briefing.suggestions[0].urgency).toBe('high');
    expect(briefing.suggestions[0].evidence[0]).toMatch(
      /^Recovery today: \d+\/100 \(Prioritise rest\)\.$/
    );
  });

  it('names no phase in the recovery wording when the cycle source is off', () => {
    // The score still uses the phase baselines (as on the Vitals card) ...
    const rows = [
      ...usual,
      vitalsRow('2026-11-19'),
      vitalsRow(TODAY, {
        restingHeartRate: 72,
        heartRateVariability: 25,
        sleepQuality: 3,
      }),
    ];
    const withCycle = buildDailyBriefing(
      input({ cycle: CYCLE, vitals: vitalsData(rows, CYCLE.periodStarts) })
    );
    const cycleOff = buildDailyBriefing(
      input({ vitals: vitalsData(rows, CYCLE.periodStarts) })
    );
    const rest = (briefing: DailyBriefing) =>
      briefing.suggestions.find((s) => s.key === 'recovery.rest-day');
    expect(rest(cycleOff)?.evidence[0]).toBe(rest(withCycle)?.evidence[0]);
    expect(rest(withCycle)?.body).toContain('below your usual for this phase');
    // ... but with the cycle source off nothing mentions a phase.
    const text = [
      cycleOff.headline,
      ...cycleOff.notes,
      ...cycleOff.suggestions.flatMap((s) => [s.title, s.body, ...s.evidence]),
    ].join(' ');
    expect(text).toContain('Recovery today');
    expect(text).not.toMatch(/phase/i);
  });

  it('encourages when recovery is good', () => {
    const briefing = buildDailyBriefing(
      input({
        vitals: vitalsData([
          ...usual,
          vitalsRow('2026-11-19', { restingHeartRate: 58 }),
          vitalsRow(TODAY, { restingHeartRate: 58 }),
        ]),
      })
    );
    expect(keys(briefing)).toEqual(['recovery.well-recovered']);
    expect(briefing.suggestions[0].title).toBe('Great recovery this week');
  });
});

describe('buildDailyBriefing: headline and suggestions agree', () => {
  const vitalsRow = (
    date: string,
    values: Partial<DailyMetricsRow> = {}
  ): DailyMetricsRow => ({
    date,
    temperature: null,
    restingHeartRate: 60,
    heartRateVariability: 50,
    sleepQuality: 8,
    sleepHours: null,
    ...values,
  });

  it('does not suggest a harder routine on a gentler day of short sleep', () => {
    // Usual energy 6; the last 3 days 8/10 with 6.5 hours of sleep a night.
    const briefing = buildDailyBriefing(
      input({
        journal: [
          ...days('2026-10-20', '2026-10-30').map((date) =>
            journalDay(date, { energy: 6 })
          ),
          ...days('2026-11-18', TODAY).map((date) =>
            journalDay(date, { energy: 8, sleepHours: 6.5 })
          ),
        ],
      })
    );
    expect(briefing.headline).toBe(
      "A gentler day may suit you. Here's what your recent logs suggest."
    );
    expect(keys(briefing)).toEqual(['recovery.sleep']);
  });

  it('does not call recovery great next to "go gently" for symptoms', () => {
    const briefing = buildDailyBriefing(
      input({
        focus: 'workout',
        journal: [
          ...days('2026-10-20', '2026-10-30').map((date) => journalDay(date)),
          journalDay('2026-11-19', { symptoms: ['Cramps', 'Headache'] }),
          journalDay(TODAY, { symptoms: ['Cramps', 'Headache'] }),
        ],
        vitals: vitalsData([
          ...days('2026-10-20', '2026-11-18').map((date) => vitalsRow(date)),
          vitalsRow('2026-11-19', { restingHeartRate: 58 }),
          vitalsRow(TODAY, { restingHeartRate: 58 }),
        ]),
      })
    );
    expect(keys(briefing)).toEqual(['recovery.gentle-symptoms']);
    expect(briefing.headline).toBe(
      "A gentler day may suit you. Here's what your recent logs suggest."
    );
  });
});

describe('buildDailyBriefing: missing data', () => {
  it('returns an empty briefing without any sources', () => {
    const briefing = buildDailyBriefing(input());
    expect(briefing).toMatchObject({
      date: TODAY,
      phase: null,
      phaseNote: null,
      suggestions: [],
      notes: [],
      headline: 'Here are a few ideas for today.',
    });
  });

  it('asks for a check-in when the journal is on but empty', () => {
    const briefing = buildDailyBriefing(input({ journal: [] }));
    expect(briefing.headline).toBe(
      'Check in with your journal to make your briefing more personal.'
    );
    expect(briefing.notes[0]).toContain(
      'No journal check-ins in the last 3 days'
    );
  });

  it('does not claim no check-ins when energy is checked in by time of day only', () => {
    // As loaded with circadian insights on: no journal entry, energy from the check-ins.
    const energyOnly = (date: string, energy: number) =>
      journalDay(date, { energy, checkIn: false, energyCheckIn: true });
    const briefing = buildDailyBriefing(
      input({
        journal: [
          ...days('2026-11-01', '2026-11-14').map((date) => energyOnly(date, 7)),
          ...days('2026-11-18', TODAY).map((date) => energyOnly(date, 2.5)),
        ],
      })
    );
    expect(briefing.notes).toEqual([
      'Your last 3 days have only energy check-ins by time of day, so mood, sleep and symptoms are not part of this briefing. Log them in your journal to make it more personal.',
    ]);
    // Their energy counts: a week of low check-ins makes it a gentler day.
    expect(briefing.headline).toBe(
      "A gentler day may suit you. Here's what your recent logs suggest."
    );
    expect(keys(briefing)).toContain('routine.ease-intensity');
  });

  it('ignores a single check-in and works without a logged period', () => {
    const briefing = buildDailyBriefing(
      input({
        cycle: { ...CYCLE, periodStarts: [] },
        journal: [journalDay(TODAY, { energy: 1, sleepHours: 3 })],
      })
    );
    expect(briefing.phase).toBeNull();
    expect(briefing.suggestions).toEqual([]);
  });

  it('estimates no phase for a cycle longer than usual and says so up front', () => {
    const briefing = buildDailyBriefing(
      input({
        today: '2026-12-02',
        cycle: CYCLE,
        journal: [
          ...LOW_ENERGY_JOURNAL.slice(0, -3),
          journalDay('2026-11-30', { energy: 4 }),
          journalDay('2026-12-01', { energy: 4 }),
          journalDay('2026-12-02', { energy: 4 }),
        ],
      })
    );
    expect(briefing.phase).toMatchObject({
      phase: null,
      cycleDay: 35,
      pastTypicalLength: true,
    });
    // Not "luteal": no phase-based meal idea, no phase in the headline or the evidence.
    expect(keys(briefing)).toEqual(['routine.ease-intensity']);
    const text = JSON.stringify(briefing);
    expect(text).not.toMatch(/luteal/i);
    expect(briefing.suggestions[0].evidence).toContain(
      'Cycle day 35, longer than your usual 28 days, so no phase is estimated.'
    );
    // The caveat is its own field, shown at every detail level, not a detail note.
    expect(briefing.phaseNote).toBe(
      'Day 35 is longer than your usual 28-day cycle, so phase-based ideas are paused. If your period has started, log it on the cycle page.'
    );
    expect(briefing.notes.join(' ')).not.toContain('Day 35');
    expect(
      buildDailyBriefing(input({ today: '2026-12-02', cycle: CYCLE })).headline
    ).toBe('Here are a few ideas for today.');
  });

  it('has no phase note within the usual cycle length', () => {
    expect(buildDailyBriefing(input({ cycle: CYCLE })).phaseNote).toBeNull();
  });

  it('uses meal adherence only when cooked meals are tracked', () => {
    const mealDays = days('2026-11-17', '2026-11-22').map((date) => ({
      date,
      planned: 3,
      cooked: 0,
    }));
    expect(
      keys(
        buildDailyBriefing(
          input({ meals: { days: mealDays, cookedTracking: false } })
        )
      )
    ).toEqual([]);
    expect(
      keys(
        buildDailyBriefing(
          input({ meals: { days: mealDays, cookedTracking: true } })
        )
      )
    ).toEqual(['meal.adherence-slipping']);
  });
});

describe('buildDailyBriefing: preferences and feedback', () => {
  const base = input({
    cycle: CYCLE,
    journal: LOW_ENERGY_JOURNAL.map((day) =>
      day.date >= '2026-11-18' ? { ...day, sleepHours: 5.5 } : day
    ),
    meals: NOTHING_PLANNED,
  });

  it('shows more, longer suggestions when detailed', () => {
    const brief = buildDailyBriefing(base);
    const detailed = buildDailyBriefing({ ...base, detail: 'detailed' });
    expect(brief.suggestions).toHaveLength(3);
    expect(detailed.suggestions).toHaveLength(4);
    expect(detailed.detail).toBe('detailed');
    const briefBody = brief.suggestions[0].body;
    const detailedBody = detailed.suggestions[0].body;
    expect(detailedBody.startsWith(briefBody)).toBe(true);
    expect(detailedBody.length).toBeGreaterThan(briefBody.length);
  });

  it("hides today's dismissed suggestions and shows today's ratings", () => {
    const feedback: BriefingFeedbackEntry[] = [
      { date: TODAY, key: 'routine.ease-intensity', action: 'dismissed' },
      { date: TODAY, key: 'recovery.sleep', action: 'helpful' },
    ];
    const briefing = buildDailyBriefing({ ...base, feedback });
    expect(keys(briefing)).not.toContain('routine.ease-intensity');
    expect(
      briefing.suggestions.find((s) => s.key === 'recovery.sleep')?.rating
    ).toBe('helpful');
  });

  it('learns from earlier feedback', () => {
    const before = keys(buildDailyBriefing(base));
    expect(before[0]).toBe('routine.ease-intensity');
    const feedback: BriefingFeedbackEntry[] = [
      {
        date: '2026-11-16',
        key: 'routine.ease-intensity',
        action: 'not_helpful',
      },
      {
        date: '2026-11-18',
        key: 'routine.ease-intensity',
        action: 'dismissed',
      },
      {
        date: '2026-11-19',
        key: 'routine.ease-intensity',
        action: 'not_helpful',
      },
      { date: '2026-11-17', key: 'meal.magnesium', action: 'helpful' },
      { date: '2026-11-19', key: 'meal.magnesium', action: 'helpful' },
    ];
    const after = keys(buildDailyBriefing({ ...base, feedback }));
    expect(after.indexOf('meal.magnesium')).toBeLessThan(
      after.indexOf('meal.plan-ahead')
    );
    expect(after).not.toContain('routine.ease-intensity');
  });

  it('keeps the copy non-medical', () => {
    const scenarios = [
      buildDailyBriefing({ ...base, detail: 'detailed' }),
      buildDailyBriefing(
        input({ today: '2026-10-31', cycle: CYCLE, detail: 'detailed' })
      ),
    ];
    for (const briefing of scenarios) {
      for (const suggestion of briefing.suggestions) {
        expect(suggestion.body).not.toMatch(
          /diagnos|deficien|disorder|cure|treat/i
        );
      }
    }
  });
});
