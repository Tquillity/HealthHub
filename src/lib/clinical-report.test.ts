import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from '@/lib/date-only';
import { buildCycleHistory } from '@/lib/cycle-history';
import type { DailyMetricsRow } from '@/lib/cycle-insights';
import {
  buildClinicalReport,
  classifyRegularity,
  isJournalCheckIn,
  linearSlope,
  MAX_NOTE_CHARS,
  MAX_NOTE_ENTRIES,
  normalizeLabel,
  reportRange,
  resolveReportToday,
  summarizeBbt,
  summarizeCycleVariability,
  summarizeNotes,
  summarizePhaseDistribution,
  summarizeSymptoms,
  summarizeVitals,
  truncateText,
  type ClinicalReportInput,
  type SymptomDay,
} from '@/lib/clinical-report';

const TODAY = '2026-11-20';
const RANGE_3 = reportRange(TODAY, 3); // 2026-08-21 .. 2026-11-20
const RANGE_6 = reportRange(TODAY, 6); // 2026-05-21 .. 2026-11-20

/** Period starts separated by the given cycle lengths. */
function startsFrom(first: string, lengths: number[]): string[] {
  const starts = [first];
  for (const length of lengths) {
    starts.push(addDaysToDateOnly(starts[starts.length - 1], length));
  }
  return starts;
}

function baseInput(
  overrides: Partial<ClinicalReportInput> = {}
): ClinicalReportInput {
  return {
    today: TODAY,
    months: 6,
    generatedAt: '2026-11-20T10:00:00.000Z',
    name: 'Alex',
    typicalCycleLength: 28,
    temperatureUnit: 'C',
    periodStarts: startsFrom('2026-05-25', [28, 30, 27, 29, 28]),
    ...overrides,
  };
}

describe('resolveReportToday / reportRange', () => {
  it('uses the viewer day only within one day of the server day', () => {
    expect(resolveReportToday(undefined, TODAY)).toBe(TODAY);
    expect(resolveReportToday('2026-11-21', TODAY)).toBe('2026-11-21');
    expect(resolveReportToday('2026-11-19', TODAY)).toBe('2026-11-19');
    expect(resolveReportToday('2026-11-23', TODAY)).toBe(TODAY);
    expect(resolveReportToday('2020-01-01', TODAY)).toBe(TODAY);
  });

  it('covers the last N calendar months including today', () => {
    expect(RANGE_3).toEqual({ start: '2026-08-21', end: TODAY, days: 92 });
    expect(reportRange(TODAY, 12)).toEqual({
      start: '2025-11-21',
      end: TODAY,
      days: 365,
    });
    expect(reportRange('2026-05-31', 3).start).toBe('2026-03-01');
  });
});

describe('helpers', () => {
  it('computes a least-squares slope', () => {
    expect(linearSlope([])).toBe(0);
    expect(linearSlope([28])).toBe(0);
    expect(linearSlope([28, 29, 30, 31])).toBeCloseTo(1);
    expect(linearSlope([30, 28, 26])).toBeCloseTo(-2);
    expect(linearSlope([28, 30, 27, 29])).toBeCloseTo(0);
  });

  it('classifies regularity with the documented SD bands', () => {
    expect(classifyRegularity(0)).toBe('consistent');
    expect(classifyRegularity(2.8)).toBe('consistent');
    expect(classifyRegularity(2.9)).toBe('somewhat-variable');
    expect(classifyRegularity(3.6)).toBe('somewhat-variable');
    expect(classifyRegularity(3.7)).toBe('variable');
  });

  it('truncates by whole characters with an ellipsis', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('abcdefghij', 5)).toBe('abcd…');
    expect(truncateText('ab cdef', 4)).toBe('ab…');
    // Never splits an emoji (surrogate pair) in half.
    expect(truncateText('😀😀😀', 2)).toBe('😀…');
  });

  it('normalizes free-text labels for grouping', () => {
    expect(normalizeLabel('  cramps. ')).toEqual({
      key: 'cramps',
      label: 'Cramps',
    });
    expect(normalizeLabel('Lower   back PAIN')).toEqual({
      key: 'lower back pain',
      label: 'Lower back PAIN',
    });
    expect(normalizeLabel('   ')).toBeNull();
    expect(normalizeLabel('Tired 😴')).toEqual({ key: 'tired', label: 'Tired' });
    expect(normalizeLabel('❤️‍🩹')).toBeNull();
    expect(normalizeLabel('x'.repeat(100))?.label).toHaveLength(60);
  });

  it('tells journal check-ins from quick-log-only days', () => {
    const empty = {
      mood: null,
      energy: null,
      sleepHours: null,
      notes: null,
      gratitudeNotes: null,
      goalsNotes: null,
      symptomsNotes: null,
      tags: [],
      gratitudeEntries: [],
      goalsAchieved: [],
      goalsProgress: [],
      symptomsPhysical: [],
      symptomsMental: [],
    };
    expect(isJournalCheckIn(empty)).toBe(false);
    expect(isJournalCheckIn({ ...empty, mood: 5 })).toBe(true);
    expect(isJournalCheckIn({ ...empty, symptomsMental: ['enc'] })).toBe(true);
    expect(isJournalCheckIn({ ...empty, notes: 'enc' })).toBe(true);
    expect(isJournalCheckIn({ ...empty, tags: ['travel'] })).toBe(true);
  });
});

describe('summarizeCycleVariability', () => {
  it('lists completed cycles that began in the range with their statistics', () => {
    // Range starts 05-21. Starts: 05-25, 06-22, 07-22, 08-18, 09-16 and 10-14 (open).
    const cycles = buildCycleHistory(
      startsFrom('2026-05-25', [28, 30, 27, 29, 28])
    );
    const result = summarizeCycleVariability(cycles, RANGE_6);
    expect(result.completed.map((c) => c.length)).toEqual([28, 30, 27, 29, 28]);
    expect(result.completed[0]).toEqual({
      start: '2026-05-25',
      end: '2026-06-21',
      length: 28,
    });
    expect(result.count).toBe(5);
    expect(result.enoughForVariability).toBe(true);
    expect(result.averageLength).toBe(28.4);
    expect(result.minLength).toBe(27);
    expect(result.maxLength).toBe(30);
    expect(result.variationDays).toBe(3);
    // Sample SD of 28, 30, 27, 29, 28 = sqrt(5.2 / 4) ≈ 1.14
    expect(result.sdLength).toBe(1.1);
    expect(result.trend).toEqual({ direction: 'stable', slopePerCycle: -0.1 });
    expect(result.current).toEqual({ start: '2026-10-14', day: 38 });
    expect(result.periodStartsInRange).toHaveLength(6);
  });

  it('leaves out cycles that began before the range', () => {
    const cycles = buildCycleHistory(['2026-08-01', '2026-08-29', '2026-09-26']);
    const result = summarizeCycleVariability(cycles, RANGE_3);
    // 08-01 began before 08-21; only the 08-29 cycle (28 days) is complete and in range.
    expect(result.completed).toEqual([
      { start: '2026-08-29', end: '2026-09-25', length: 28 },
    ]);
    expect(result.periodStartsInRange).toEqual(['2026-08-29', '2026-09-26']);
  });

  it('says when there are fewer than 2 completed cycles', () => {
    const one = summarizeCycleVariability(
      buildCycleHistory(['2026-09-01', '2026-09-29']),
      RANGE_3
    );
    expect(one.count).toBe(1);
    expect(one.enoughForVariability).toBe(false);
    expect(one.averageLength).toBeNull();
    expect(one.sdLength).toBeNull();
    expect(one.variationDays).toBeNull();
    expect(one.trend).toBeNull();

    const none = summarizeCycleVariability([], RANGE_3);
    expect(none.count).toBe(0);
    expect(none.current).toBeNull();
    expect(none.completed).toEqual([]);
  });

  it('describes a lengthening or shortening trend from 3 cycles', () => {
    const longer = summarizeCycleVariability(
      buildCycleHistory(startsFrom('2026-05-25', [26, 28, 30, 32])),
      RANGE_6
    );
    expect(longer.trend).toEqual({ direction: 'lengthening', slopePerCycle: 2 });
    const shorter = summarizeCycleVariability(
      buildCycleHistory(startsFrom('2026-05-25', [33, 31, 29])),
      RANGE_6
    );
    expect(shorter.trend?.direction).toBe('shortening');
    const two = summarizeCycleVariability(
      buildCycleHistory(startsFrom('2026-05-25', [26, 34])),
      RANGE_6
    );
    expect(two.trend).toBeNull();
    expect(two.sdLength).toBe(5.7);
  });
});

describe('summarizePhaseDistribution', () => {
  it('splits the range into phases and averages estimated phase lengths', () => {
    const cycles = buildCycleHistory(['2026-08-21', '2026-09-18', '2026-10-16']);
    const result = summarizePhaseDistribution(cycles, RANGE_3, 28);
    expect(result.trackedDays).toBe(92);
    expect(result.untrackedDays).toBe(0);
    const byPhase = Object.fromEntries(result.phases.map((p) => [p.phase, p]));
    // 28-day model: menstrual 1-5, follicular 6-10, ovulation 11-14, luteal 15-28.
    // Two complete cycles (56 days) + 36 days of the open cycle at the typical 28
    // (days 29-36 continue as luteal).
    expect(byPhase.menstrual.days).toBe(15);
    expect(byPhase.follicular.days).toBe(15);
    expect(byPhase.ovulation.days).toBe(12);
    expect(byPhase.luteal.days).toBe(50);
    expect(
      result.phases.reduce((sum, phase) => sum + phase.days, 0)
    ).toBe(92);
    expect(byPhase.menstrual.percent).toBe(16.3);
    expect(byPhase.luteal.averageLength).toBe(14);
    expect(byPhase.follicular.averageLength).toBe(5);
    expect(result.cyclesForLengths).toBe(2);
    expect(result.regularity).toEqual({ level: 'consistent', sd: 0, cycles: 2 });
  });

  it('counts days before the first logged period as untracked', () => {
    const cycles = buildCycleHistory(['2026-11-01']);
    const result = summarizePhaseDistribution(cycles, RANGE_3, 28);
    expect(result.untrackedDays).toBe(72);
    expect(result.trackedDays).toBe(20);
    expect(result.regularity).toBeNull();
    expect(result.phases.every((p) => p.averageLength === null)).toBe(true);
  });

  it('handles no period history at all', () => {
    const result = summarizePhaseDistribution([], RANGE_3, 28);
    expect(result.trackedDays).toBe(0);
    expect(result.phases.every((p) => p.days === 0 && p.percent === 0)).toBe(
      true
    );
  });

  it('flags variable cycles with the SD bands', () => {
    const cycles = buildCycleHistory(
      startsFrom('2026-05-25', [24, 33, 26, 35])
    );
    const result = summarizePhaseDistribution(cycles, RANGE_6, 28);
    expect(result.regularity?.level).toBe('variable');
    expect(result.regularity?.cycles).toBe(4);
  });
});

describe('summarizeBbt', () => {
  const LOW = [36.3, 36.2, 36.25, 36.3, 36.2, 36.3, 36.25, 36.2, 36.3, 36.25, 36.3, 36.3];
  const HIGH = [36.6, 36.65, 36.7, 36.7, 36.75];

  function cycleReadings(start: string, values: number[]) {
    return values.map((celsius, i) => ({
      date: addDaysToDateOnly(start, i),
      celsius,
    }));
  }

  it('finds bio-verified ovulation, phase averages and the luteal length', () => {
    const cycles = buildCycleHistory(['2026-09-01', '2026-09-29']);
    const readings = cycleReadings('2026-09-01', [...LOW, ...HIGH]);
    const result = summarizeBbt(cycles, readings, RANGE_3, 28, 'F');
    expect(result.unit).toBe('F');
    expect(result.daysWithReading).toBe(17);
    expect(result.ovulationDates).toEqual(['2026-09-12']);
    expect(result.cycles).toHaveLength(1);
    const cycle = result.cycles[0];
    expect(cycle.status).toBe('confirmed');
    expect(cycle.shiftDate).toBe('2026-09-13');
    expect(cycle.coverlineCelsius).toBe(36.3);
    expect(cycle.preShiftAverageCelsius).toBe(36.26);
    expect(cycle.postShiftAverageCelsius).toBe(36.68);
    expect(cycle.riseCelsius).toBe(0.42);
    // Ovulation 09-12, next period 09-29: luteal days 09-13 .. 09-28.
    expect(cycle.lutealLength).toBe(16);
    const menstrual = result.phaseAverages.find((p) => p.phase === 'menstrual');
    expect(menstrual?.readings).toBe(5);
    expect(menstrual?.averageCelsius).toBe(36.25);
  });

  it('uses readings from before the range for a cycle that began earlier', () => {
    // Range starts 08-21; the cycle began 08-12, so 9 of its low readings are before it.
    const cycles = buildCycleHistory(['2026-08-12']);
    const readings = cycleReadings('2026-08-12', [...LOW, ...HIGH]);
    const result = summarizeBbt(cycles, readings, RANGE_3, 28, 'C');
    expect(result.readings.every((r) => r.date >= RANGE_3.start)).toBe(true);
    expect(result.daysWithReading).toBe(8);
    expect(result.cycles[0].status).toBe('confirmed');
    expect(result.cycles[0].isOpen).toBe(true);
    expect(result.cycles[0].lutealLength).toBeNull();
    expect(result.ovulationDates).toEqual(['2026-08-23']);
  });

  it('reports cycles without a shift and ignores out-of-range temperatures', () => {
    const cycles = buildCycleHistory(['2026-10-01', '2026-10-29']);
    const readings = [
      ...cycleReadings('2026-10-01', [36.3, 36.4, 36.3]),
      { date: '2026-10-05', celsius: 39.5 },
      ...cycleReadings('2026-10-29', LOW),
    ];
    const result = summarizeBbt(cycles, readings, RANGE_3, 28, 'C');
    expect(result.daysWithReading).toBe(15);
    expect(result.cycles.map((c) => c.status)).toEqual([
      'not-enough-readings',
      'no-shift',
    ]);
    expect(result.ovulationDates).toEqual([]);
  });

  it('handles no readings', () => {
    const result = summarizeBbt([], [], RANGE_3, 28, 'C');
    expect(result.readings).toEqual([]);
    expect(result.cycles).toEqual([]);
    expect(result.phaseAverages.every((p) => p.averageCelsius === null)).toBe(
      true
    );
  });
});

describe('summarizeSymptoms', () => {
  const cycles = buildCycleHistory(['2026-10-01', '2026-10-29']);

  function day(
    date: string,
    physical: string[],
    mental: string[] = [],
    mood: number | null = null,
    energy: number | null = null
  ): SymptomDay {
    return { date, physical, mental, mood, energy };
  }

  it('counts symptom frequency by phase and common pairs', () => {
    const result = summarizeSymptoms(
      cycles,
      [
        day('2026-10-01', ['Cramps', 'Headache'], ['Tired'], 4, 3),
        day('2026-10-02', ['cramps ', 'bloating'], ['tired'], 5, 4),
        day('2026-10-03', ['Cramps'], [], 6, 5),
        day('2026-10-20', ['Headache', 'Bloating'], ['Irritable'], 5, 6),
        day('2026-10-21', [], [], 7, 7),
        day('2026-10-22', ['Headache', 'bloating', 'Headache']),
      ],
      RANGE_3,
      28
    );
    expect(result.checkInDays).toBe(6);
    expect(result.daysWithSymptoms).toBe(5);
    expect(result.checkInDaysByPhase).toEqual({
      menstrual: 3,
      follicular: 0,
      ovulation: 0,
      luteal: 3,
    });
    const cramps = result.physical.find((s) => s.label === 'Cramps');
    expect(cramps?.days).toBe(3);
    expect(cramps?.byPhase).toEqual({
      menstrual: 3,
      follicular: 0,
      ovulation: 0,
      luteal: 0,
    });
    // Headache and bloating are both logged on 3 days; ties sort by label.
    expect(result.physical.map((s) => [s.label, s.days])).toEqual([
      ['Bloating', 3],
      ['Cramps', 3],
      ['Headache', 3],
    ]);
    expect(result.mental.map((s) => [s.label, s.days])).toEqual([
      ['Tired', 2],
      ['Irritable', 1],
    ]);
    expect(result.pairs[0]).toEqual({ a: 'Bloating', b: 'Headache', days: 2 });
    expect(result.pairs).toContainEqual({ a: 'Cramps', b: 'Tired', days: 2 });
    // Pairs seen only once are not listed.
    expect(result.pairs.every((pair) => pair.days >= 2)).toBe(true);
    const menstrual = result.moodEnergyByPhase.find(
      (p) => p.phase === 'menstrual'
    );
    expect(menstrual).toEqual({ phase: 'menstrual', mood: 5, energy: 4, days: 3 });
  });

  it('ignores days outside the range and counts days with no phase', () => {
    const result = summarizeSymptoms(
      buildCycleHistory(['2026-11-01']),
      [day('2026-08-01', ['Cramps']), day('2026-09-01', ['Cramps'])],
      RANGE_3,
      28
    );
    expect(result.checkInDays).toBe(1);
    expect(result.checkInDaysWithoutPhase).toBe(1);
    expect(result.physical[0].days).toBe(1);
    expect(result.physical[0].byPhase.menstrual).toBe(0);
  });

  it('handles no check-ins', () => {
    const result = summarizeSymptoms(cycles, [], RANGE_3, 28);
    expect(result.checkInDays).toBe(0);
    expect(result.physical).toEqual([]);
    expect(result.pairs).toEqual([]);
    expect(result.moodEnergyByPhase.every((p) => p.mood === null)).toBe(true);
  });
});

describe('summarizeVitals', () => {
  it('averages vitals by phase over the range only', () => {
    const cycles = buildCycleHistory(['2026-10-01', '2026-10-29']);
    const rows: DailyMetricsRow[] = [
      {
        date: '2026-06-01',
        temperature: null,
        restingHeartRate: 80,
        heartRateVariability: 20,
        sleepQuality: 2,
        sleepHours: 4,
      },
      {
        date: '2026-10-02',
        temperature: 36.4,
        restingHeartRate: 60,
        heartRateVariability: 50,
        sleepQuality: 8,
        sleepHours: 8,
      },
      {
        date: '2026-10-03',
        temperature: null,
        restingHeartRate: 62,
        heartRateVariability: null,
        sleepQuality: null,
        sleepHours: 7,
      },
      {
        date: '2026-10-04',
        temperature: 36.5,
        restingHeartRate: null,
        heartRateVariability: null,
        sleepQuality: null,
        sleepHours: null,
      },
    ];
    const result = summarizeVitals(cycles, rows, RANGE_3, 28);
    expect(result.overall.days).toBe(2);
    expect(result.overall.restingHeartRate).toBe(61);
    expect(result.overall.heartRateVariability).toBe(50);
    expect(result.overall.sleepHours).toBe(7.5);
    const menstrual = result.byPhase.find((p) => p.phase === 'menstrual');
    expect(menstrual?.days).toBe(2);
    const luteal = result.byPhase.find((p) => p.phase === 'luteal');
    expect(luteal?.days).toBe(0);
    expect(luteal?.restingHeartRate).toBeNull();
    // Sleep scores on its own scale, so both in-range days get a score.
    expect(result.scoredDays).toBe(2);
    expect(result.overall.recoveryScore).not.toBeNull();
  });
});

describe('summarizeNotes', () => {
  const cycles = buildCycleHistory(['2026-10-01']);

  it('keeps notes and tags in the range, truncated, newest kept', () => {
    const days = [
      { date: '2026-01-01', note: 'Too old', symptomNote: null, tags: [] },
      {
        date: '2026-10-02',
        note: '  Flu, stayed home  ',
        symptomNote: 'x'.repeat(MAX_NOTE_CHARS + 50),
        tags: ['Illness', 'illness ', 'travel'],
      },
      { date: '2026-10-03', note: '   ', symptomNote: null, tags: ['Travel'] },
      { date: '2026-10-04', note: null, symptomNote: null, tags: [] },
    ];
    const result = summarizeNotes(cycles, days, RANGE_3, 28);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      date: '2026-10-02',
      phase: 'menstrual',
      note: 'Flu, stayed home',
      tags: ['Illness', 'Travel'],
    });
    expect(Array.from(result.entries[0].symptomNote ?? '')).toHaveLength(
      MAX_NOTE_CHARS
    );
    expect(result.entries[1]).toMatchObject({ note: null, tags: ['Travel'] });
    expect(result.tagCounts).toEqual([
      { tag: 'Travel', days: 2 },
      { tag: 'Illness', days: 1 },
    ]);
  });

  it('keeps only the newest entries when there are many', () => {
    const days = Array.from({ length: MAX_NOTE_ENTRIES + 5 }, (_, i) => ({
      date: addDaysToDateOnly(RANGE_3.start, i),
      note: `Note ${i}`,
      symptomNote: null,
      tags: [],
    }));
    const result = summarizeNotes(cycles, days, RANGE_3, 28);
    expect(result.entries).toHaveLength(MAX_NOTE_ENTRIES);
    expect(result.omittedEntries).toBe(5);
    expect(result.entries[0].note).toBe('Note 5');
  });
});

describe('buildClinicalReport', () => {
  it('omits every section that was not requested', () => {
    const report = buildClinicalReport(baseInput({ name: null }));
    expect(Object.keys(report).sort()).toEqual(['cycles', 'meta', 'phases']);
    expect(report.meta.sections).toEqual({
      name: false,
      bbt: false,
      symptoms: false,
      vitals: false,
      notes: false,
    });
    expect(report.meta.name).toBeNull();
    expect(JSON.stringify(report)).not.toContain('Alex');
  });

  it('includes exactly the requested sections', () => {
    const report = buildClinicalReport(
      baseInput({
        bbtReadings: [{ date: '2026-11-16', celsius: 36.4 }],
        noteDays: [
          { date: '2026-11-16', note: 'Travel week', symptomNote: null, tags: [] },
        ],
      })
    );
    expect(report.bbt?.daysWithReading).toBe(1);
    expect(report.notes?.entries[0].note).toBe('Travel week');
    expect(report.symptoms).toBeUndefined();
    expect(report.vitals).toBeUndefined();
    expect('symptoms' in report).toBe(false);
    expect('vitals' in report).toBe(false);
    expect(report.meta).toMatchObject({
      name: 'Alex',
      months: 6,
      rangeStart: '2026-05-21',
      rangeEnd: TODAY,
      typicalCycleLength: 28,
      sections: { name: true, bbt: true, notes: true, symptoms: false, vitals: false },
    });
  });

  it('ignores period starts after the report end', () => {
    const report = buildClinicalReport(
      baseInput({ periodStarts: ['2026-10-01', '2026-10-29', '2026-12-01'] })
    );
    expect(report.cycles.periodStartsInRange).toEqual(['2026-10-01', '2026-10-29']);
    expect(report.cycles.current?.start).toBe('2026-10-29');
  });

  it('builds an empty report for a user with no data', () => {
    const report = buildClinicalReport(
      baseInput({
        periodStarts: [],
        bbtReadings: [],
        symptomDays: [],
        vitalsRows: [],
        noteDays: [],
      })
    );
    expect(report.cycles.count).toBe(0);
    expect(report.phases.trackedDays).toBe(0);
    expect(report.bbt?.readings).toEqual([]);
    expect(report.symptoms?.checkInDays).toBe(0);
    expect(report.vitals?.overall.days).toBe(0);
    expect(report.notes?.entries).toEqual([]);
  });
});
