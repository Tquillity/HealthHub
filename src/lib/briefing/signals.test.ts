import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from '@/lib/date-only';
import { buildCycleHistory } from '@/lib/cycle-history';
import {
  buildTodayRecovery,
  type DailyMetricsRow,
} from '@/lib/cycle-insights';
import {
  analyzeBriefing,
  briefingWindow,
  compareWindow,
  isEnergyGood,
  isEnergyLow,
  type Comparison,
} from './signals';
import type {
  BriefingCycleData,
  BriefingEngineInput,
  BriefingVitalsData,
  BriefingJournalDay,
} from './types';

// Friday 20 November 2026: cycle day 23 (luteal) of a cycle that began on 29 October.
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

/** Luteal days of the previous (completed, 28-day) cycle: 15-28 October. */
const PREVIOUS_LUTEAL = days('2026-10-15', '2026-10-28');
const WINDOW = briefingWindow(TODAY);

function comparison(overrides: Partial<Comparison>): Comparison {
  return {
    actual: 5,
    days: 3,
    expected: 5,
    sd: 0,
    source: 'phase',
    gap: 0,
    phase: 'luteal',
    ...overrides,
  };
}

describe('briefingWindow', () => {
  it('covers the last 3 days up to and including today', () => {
    expect(WINDOW).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });
});

describe('compareWindow', () => {
  const typical = () => 5.75;
  const window = [
    { date: '2026-11-19', phase: 'luteal' as const, value: 4 },
    { date: '2026-11-20', phase: 'luteal' as const, value: 5 },
  ];

  it("uses the user's own same-phase days when there are at least 3", () => {
    const history = [7, 7, 8].map((value, i) => ({
      date: `2026-10-1${i}`,
      phase: 'luteal' as const,
      value,
    }));
    expect(compareWindow(window, history, typical)).toMatchObject({
      actual: 4.5,
      expected: 22 / 3,
      source: 'phase',
      phase: 'luteal',
      days: 2,
    });
  });

  it('falls back to the typical pattern when the phase has fewer than 3 days', () => {
    const history = [
      { date: '2026-10-10', phase: 'luteal' as const, value: 7 },
      { date: '2026-10-11', phase: 'follicular' as const, value: 7 },
      { date: '2026-10-12', phase: 'follicular' as const, value: 7 },
    ];
    expect(compareWindow(window, history, typical)).toMatchObject({
      expected: 5.75,
      source: 'typical',
      sd: 0,
    });
  });

  it('uses the overall personal usual without a phase, and needs 2 window days', () => {
    const noPhase = window.map((d) => ({ ...d, phase: null }));
    const history = [6, 6, 6].map((value, i) => ({
      date: `2026-10-1${i}`,
      phase: null,
      value,
    }));
    expect(compareWindow(noPhase, history, typical)).toMatchObject({
      expected: 6,
      source: 'overall',
      phase: null,
    });
    expect(compareWindow(noPhase.slice(0, 1), history, typical)).toBeNull();
    expect(compareWindow(noPhase, history.slice(0, 2), typical)).toBeNull();
  });
});

describe('energy thresholds', () => {
  it('needs a 1.5-point (or 1 SD) dip against a personal baseline', () => {
    expect(isEnergyLow(comparison({ gap: 1.5 }))).toBe(true);
    expect(isEnergyLow(comparison({ gap: 1.4 }))).toBe(false);
    expect(isEnergyLow(comparison({ gap: 1.8, sd: 2 }))).toBe(false);
  });

  it('is stricter against the typical pattern and never calls 6/10 low', () => {
    expect(
      isEnergyLow(comparison({ source: 'typical', gap: 2.75, actual: 3 }))
    ).toBe(true);
    // However high the typical level, 6/10 is a fine day.
    expect(
      isEnergyLow(comparison({ source: 'typical', gap: 3.25, actual: 6 }))
    ).toBe(false);
    expect(
      isEnergyLow(comparison({ source: 'typical', gap: 2, actual: 3 }))
    ).toBe(false);
  });

  it('calls energy good from 7/10 when it is at or above the usual', () => {
    expect(isEnergyGood(comparison({ actual: 7.5, gap: -0.5 }))).toBe(true);
    expect(isEnergyGood(comparison({ actual: 7.5, gap: 0.5 }))).toBe(false);
    expect(isEnergyGood(comparison({ actual: 6.5, gap: -1 }))).toBe(false);
  });
});

describe('analyzeBriefing: journal', () => {
  const history = PREVIOUS_LUTEAL.map((date) =>
    journalDay(date, { energy: 7, mood: 7, symptoms: ['Bloating'] })
  );

  it('compares energy with the same phase of earlier cycles', () => {
    const signals = analyzeBriefing(
      input({
        cycle: CYCLE,
        journal: [
          ...history,
          journalDay('2026-11-18', { energy: 4 }),
          journalDay('2026-11-19', { energy: 4 }),
          journalDay('2026-11-20', { energy: 5 }),
        ],
      })
    );
    expect(signals.phase).toMatchObject({ phase: 'luteal', cycleDay: 23 });
    expect(signals.energy?.comparison).toMatchObject({
      source: 'phase',
      phase: 'luteal',
      expected: 7,
    });
    expect(signals.energy?.comparison.actual).toBeCloseTo(13 / 3);
    expect(signals.energy?.low).toBe(true);
    expect(signals.checkInDays).toBe(3);
  });

  it('uses the typical pattern without phase history', () => {
    const signals = analyzeBriefing(
      input({
        cycle: CYCLE,
        journal: [
          journalDay('2026-11-19', { energy: 3 }),
          journalDay('2026-11-20', { energy: 3 }),
        ],
      })
    );
    expect(signals.energy?.comparison.source).toBe('typical');
    // Mean of the typical curve over luteal days 15-28 of a 28-day cycle.
    expect(signals.energy?.comparison.expected).toBeCloseTo(6.75);
    expect(signals.energy?.low).toBe(true);
  });

  it("takes the typical level of a phase from the same days the briefing gives it", () => {
    // Cycle days 11-13 of a 28-day cycle are the ovulation phase (days 11-14), where the
    // typical curve is about 6.5, not the 9.25 of days 15-18.
    const signals = analyzeBriefing(
      input({
        today: '2026-11-10',
        cycle: CYCLE,
        journal: [
          journalDay('2026-11-08', { energy: 5 }),
          journalDay('2026-11-09', { energy: 5 }),
          journalDay('2026-11-10', { energy: 5 }),
        ],
      })
    );
    expect(signals.phase).toMatchObject({ phase: 'ovulation', cycleDay: 13 });
    expect(signals.energy?.comparison).toMatchObject({
      source: 'typical',
      phase: 'ovulation',
      actual: 5,
    });
    expect(signals.energy?.comparison.expected).toBeCloseTo(6.5);
    expect(signals.energy?.low).toBe(false);
  });

  it('places a completed cycle on its real length for the typical level', () => {
    // A new period started today. 1-28 October was a 28-day cycle although the typical
    // length is 35: its last days are luteal on 28 days and compared with those days.
    const signals = analyzeBriefing(
      input({
        today: '2026-10-29',
        cycle: { ...CYCLE, typicalCycleLength: 35 },
        journal: [
          journalDay('2026-10-27', { energy: 3 }),
          journalDay('2026-10-28', { energy: 3 }),
        ],
      })
    );
    expect(signals.energy?.comparison.phase).toBe('luteal');
    expect(signals.energy?.comparison.expected).toBeCloseTo(6.75);
  });

  it('compares with the overall usual when cycle data is off', () => {
    const signals = analyzeBriefing(
      input({
        journal: [
          ...history,
          journalDay('2026-11-19', { energy: 8 }),
          journalDay('2026-11-20', { energy: 8 }),
        ],
      })
    );
    expect(signals.phase).toBeNull();
    expect(signals.energy?.comparison.source).toBe('overall');
    expect(signals.energy?.good).toBe(true);
  });

  it('finds more symptoms than usual for the phase, counting each once', () => {
    const signals = analyzeBriefing(
      input({
        cycle: CYCLE,
        journal: [
          ...history,
          journalDay('2026-11-19', {
            symptoms: ['Cramps', 'Headache', 'bloating '],
          }),
          journalDay('2026-11-20', {
            symptoms: ['cramps', 'Headache', 'Cramps'],
          }),
        ],
      })
    );
    expect(signals.symptoms?.comparison).toMatchObject({
      actual: 2.5,
      expected: 1,
      source: 'phase',
    });
    expect(signals.symptoms?.elevated).toBe(true);
    expect(signals.symptoms?.top).toEqual(['Cramps', 'Headache']);
  });

  it('ignores quick-log-only days for symptoms and flags short sleep', () => {
    const signals = analyzeBriefing(
      input({
        journal: [
          journalDay('2026-11-18', { sleepHours: 5.5, checkIn: true }),
          journalDay('2026-11-19', { sleepHours: 6, checkIn: true }),
          journalDay('2026-11-20', { checkIn: false }),
        ],
      })
    );
    expect(signals.checkInDays).toBe(2);
    expect(signals.symptoms).toBeNull();
    expect(signals.sleep).toMatchObject({
      meanHours: 5.75,
      nights: 2,
      short: true,
      veryShort: true,
    });
  });

  it('reports no check-ins when the journal is on but empty, and nothing when off', () => {
    expect(analyzeBriefing(input({ journal: [] })).checkInDays).toBe(0);
    const off = analyzeBriefing(input());
    expect(off.checkInDays).toBeNull();
    expect(off.energy).toBeNull();
    expect(off.phase).toBeNull();
  });

  it("uses today's low energy check-in only with the journal source on", () => {
    expect(analyzeBriefing(input({ journal: [] })).lowEnergyToday).toBeNull();
    for (const lowEnergyToday of ['now', 'earlier'] as const) {
      expect(
        analyzeBriefing(input({ journal: [], lowEnergyToday })).lowEnergyToday
      ).toBe(lowEnergyToday);
      // The check-in is journal data: ignored with the journal source off.
      expect(
        analyzeBriefing(input({ lowEnergyToday })).lowEnergyToday
      ).toBeNull();
    }
  });
});

describe('analyzeBriefing: recovery', () => {
  const vitalsRow = (
    date: string,
    values: Partial<DailyMetricsRow>
  ): DailyMetricsRow => ({
    date,
    temperature: null,
    restingHeartRate: 60,
    heartRateVariability: 50,
    sleepQuality: 8,
    sleepHours: null,
    ...values,
  });
  const usual = days('2026-10-20', '2026-11-17').map((date) =>
    vitalsRow(date, {})
  );

  it('flags low recovery on the latest day', () => {
    const signals = analyzeBriefing(
      input({
        vitals: vitalsData([
          ...usual,
          vitalsRow('2026-11-19', {}),
          vitalsRow('2026-11-20', {
            restingHeartRate: 72,
            heartRateVariability: 25,
            sleepQuality: 3,
          }),
        ]),
      })
    );
    expect(signals.recovery?.latest).toMatchObject({
      date: '2026-11-20',
      zone: 'red',
    });
    expect(signals.recovery?.low).toBe(true);
    expect(signals.recovery?.good).toBe(false);
  });

  it('does not call an earlier dip low once the latest day is green', () => {
    const signals = analyzeBriefing(
      input({
        vitals: vitalsData([
          ...usual,
          vitalsRow('2026-11-19', {
            restingHeartRate: 72,
            heartRateVariability: 25,
            sleepQuality: 3,
          }),
          vitalsRow('2026-11-20', { restingHeartRate: 58 }),
        ]),
      })
    );
    expect(signals.recovery?.latest.zone).toBe('green');
    expect(signals.recovery?.low).toBe(false);
  });

  it('calls recovery good when every window day is green and above usual', () => {
    const signals = analyzeBriefing(
      input({
        vitals: vitalsData([
          ...usual,
          vitalsRow('2026-11-18', { restingHeartRate: 58 }),
          vitalsRow('2026-11-19', { restingHeartRate: 58 }),
          vitalsRow('2026-11-20', { restingHeartRate: 58 }),
        ]),
      })
    );
    expect(signals.recovery?.scoredDays).toBe(3);
    expect(signals.recovery?.good).toBe(true);
    expect(signals.recovery?.low).toBe(false);
  });

  it('scores recovery exactly as the Vitals card, whatever the journal and cycle sources', () => {
    // Sleep hours (a journal value) and the cycle phases are part of the card's score.
    const rows = [
      ...days('2026-08-20', '2026-11-19').map((date, i) =>
        vitalsRow(date, {
          restingHeartRate: 58 + (i % 5),
          heartRateVariability: 46 + (i % 7),
          sleepQuality: 7 + (i % 2),
          sleepHours: 7 + (i % 3) * 0.5,
        })
      ),
      vitalsRow('2026-11-20', {
        restingHeartRate: 63,
        heartRateVariability: 44,
        sleepQuality: 6,
        sleepHours: 4,
      }),
    ];
    const card = buildTodayRecovery({
      today: TODAY,
      rows,
      cycles: buildCycleHistory(CYCLE.periodStarts),
      typicalCycleLength: 28,
    });
    // Leaving out sleep hours would give another score.
    const withoutSleepHours = buildTodayRecovery({
      today: TODAY,
      rows: rows.map((row) => ({ ...row, sleepHours: null })),
      cycles: buildCycleHistory(CYCLE.periodStarts),
      typicalCycleLength: 28,
    });
    expect(card?.score).not.toBe(withoutSleepHours?.score);

    // Journal and cycle sources off: the briefing still has the card's score and zone.
    const signals = analyzeBriefing(
      input({ vitals: vitalsData(rows, CYCLE.periodStarts) })
    );
    expect(signals.recovery?.latest).toMatchObject({
      date: TODAY,
      score: card?.score,
      zone: card?.zone,
      usualScore: card?.usualScore,
      comparedWith: card?.comparedWith,
    });
  });

  it('has no recovery signal without vitals', () => {
    expect(analyzeBriefing(input({ vitals: vitalsData([]) })).recovery).toBeNull();
  });
});

describe('analyzeBriefing: meals', () => {
  it('uses cooked counts only when the household tracks them', () => {
    const mealDays = [
      { date: '2026-11-17', planned: 3, cooked: 1 },
      { date: '2026-11-18', planned: 2, cooked: 0 },
      { date: '2026-11-19', planned: 2, cooked: 0 },
      { date: '2026-11-20', planned: 2, cooked: 0 },
      { date: '2026-11-12', planned: 4, cooked: 4 },
    ];
    const untracked = analyzeBriefing(
      input({ meals: { days: mealDays, cookedTracking: false } })
    ).meals;
    expect(untracked).toMatchObject({
      plannedAhead: 2,
      recent: { planned: 7, cooked: 1 },
      adherence: null,
      priorAdherence: null,
    });
    const tracked = analyzeBriefing(
      input({ meals: { days: mealDays, cookedTracking: true } })
    ).meals;
    expect(tracked?.adherence).toBeCloseTo(1 / 7);
    expect(tracked?.priorAdherence).toBe(1);
  });
});
