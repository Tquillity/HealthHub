import { describe, expect, it } from 'vitest';
import type { CyclePhase } from '@/lib/cycle-calculator';
import { addDaysToDateOnly } from '@/lib/date-only';
import {
  combineComponents,
  computeRecoverySeries,
  getRecoveryZone,
  isSignificantDrop,
  pickBaseline,
  sampleSd,
  scoreHrv,
  scoreRhr,
  scoreSleep,
  summarizePhaseBaselines,
  type RecoveryDayInput,
} from '@/lib/recovery';

function day(
  date: string,
  values: Partial<Omit<RecoveryDayInput, 'date'>> = {}
): RecoveryDayInput {
  return {
    date,
    phase: null,
    restingHeartRate: null,
    heartRateVariability: null,
    sleepQuality: null,
    sleepHours: null,
    ...values,
  };
}

/** `count` consecutive days from `start` with the same values. */
function days(
  start: string,
  count: number,
  values: Partial<Omit<RecoveryDayInput, 'date'>>
): RecoveryDayInput[] {
  return Array.from({ length: count }, (_, i) =>
    day(addDaysToDateOnly(start, i), values)
  );
}

describe('zones', () => {
  it('uses green ≥ 67, yellow 34-66, red < 34', () => {
    expect(getRecoveryZone(100)).toBe('green');
    expect(getRecoveryZone(67)).toBe('green');
    expect(getRecoveryZone(66)).toBe('yellow');
    expect(getRecoveryZone(34)).toBe('yellow');
    expect(getRecoveryZone(33)).toBe('red');
    expect(getRecoveryZone(0)).toBe('red');
  });
});

describe('component scores', () => {
  const rhrBaseline = { source: 'overall' as const, mean: 60, sd: 3, n: 10 };
  const hrvBaseline = {
    source: 'overall' as const,
    mean: Math.log(50),
    sd: 0.2,
    n: 10,
  };

  it('scores a day at baseline as 75 and moves 25 points per SD', () => {
    expect(scoreRhr(60, rhrBaseline)).toBe(75);
    expect(scoreRhr(63, rhrBaseline)).toBe(50); // 1 SD higher RHR = worse
    expect(scoreRhr(57, rhrBaseline)).toBe(100);
    expect(scoreHrv(50, hrvBaseline)).toBeCloseTo(75, 10);
    expect(scoreHrv(50 * Math.exp(-0.2), hrvBaseline)).toBeCloseTo(50, 10);
  });

  it('clamps to 0-100', () => {
    expect(scoreRhr(90, rhrBaseline)).toBe(0);
    expect(scoreHrv(500, hrvBaseline)).toBe(100);
  });

  it('floors tiny SDs so identical history does not explode z-scores', () => {
    const flat = { source: 'overall' as const, mean: 60, sd: 0, n: 5 };
    // SD floor of 2 bpm: 1 bpm above usual is half an SD.
    expect(scoreRhr(61, flat)).toBe(62.5);
    const flatHrv = {
      source: 'overall' as const,
      mean: Math.log(40),
      sd: 0,
      n: 5,
    };
    expect(scoreHrv(40 * Math.exp(-0.1), flatHrv)).toBeCloseTo(50, 10);
  });

  it('scores sleep from quality and hours', () => {
    expect(scoreSleep(10, null)).toBe(100);
    expect(scoreSleep(1, null)).toBe(0);
    expect(scoreSleep(null, 8)).toBe(100);
    expect(scoreSleep(null, 7)).toBe(100);
    expect(scoreSleep(null, 5.5)).toBe(50);
    expect(scoreSleep(null, 3)).toBe(0);
    expect(scoreSleep(10, 4)).toBe(50); // average of both
    expect(scoreSleep(null, null)).toBeNull();
  });

  it('re-weights missing components and returns null without any', () => {
    expect(
      combineComponents([
        { key: 'hrv', score: 80, weight: 0.4, baseline: null },
        { key: 'sleep', score: 40, weight: 0.3, baseline: null },
      ])
    ).toBe(Math.round((80 * 0.4 + 40 * 0.3) / 0.7));
    expect(combineComponents([])).toBeNull();
  });
});

describe('pickBaseline', () => {
  const window = [
    { phase: 'luteal' as CyclePhase, value: 64 },
    { phase: 'luteal' as CyclePhase, value: 66 },
    { phase: 'luteal' as CyclePhase, value: 65 },
    { phase: 'follicular' as CyclePhase, value: 60 },
    { phase: 'follicular' as CyclePhase, value: 61 },
  ];

  it('prefers the same phase with at least 3 readings', () => {
    expect(pickBaseline(window, 'luteal')).toMatchObject({
      source: 'phase',
      mean: 65,
      n: 3,
    });
  });

  it('falls back to all readings when the phase has fewer than 3', () => {
    expect(pickBaseline(window, 'follicular')).toMatchObject({
      source: 'overall',
      mean: (64 + 66 + 65 + 60 + 61) / 5,
      n: 5,
    });
    expect(pickBaseline(window, null)).toMatchObject({ source: 'overall' });
  });

  it('returns null with fewer than 3 readings in total', () => {
    expect(pickBaseline(window.slice(3), 'follicular')).toBeNull();
    expect(pickBaseline([], null)).toBeNull();
  });

  it('computes a sample SD', () => {
    expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(sampleSd([5])).toBe(0);
  });
});

describe('computeRecoverySeries', () => {
  it('returns no score for days without usable data', () => {
    const [result] = computeRecoverySeries([day('2026-03-01')]);
    expect(result).toMatchObject({
      score: null,
      zone: null,
      components: [],
      alert: false,
    });
  });

  it('has no HRV/RHR component until 3 earlier readings exist, but scores sleep', () => {
    const series = computeRecoverySeries([
      ...days('2026-03-01', 3, { restingHeartRate: 60, sleepQuality: 7 }),
      day('2026-03-04', { restingHeartRate: 60, sleepQuality: 7 }),
    ]);
    expect(series[0].components.map((c) => c.key)).toEqual(['sleep']);
    expect(series[0].score).toBe(67);
    expect(series[3].components.map((c) => c.key)).toEqual(['rhr', 'sleep']);
    // RHR at baseline (75, weight .3) + sleep 66.7 (weight .3)
    expect(series[3].score).toBe(
      Math.round((75 * 0.3 + (6 / 9) * 100 * 0.3) / 0.6)
    );
  });

  it('never includes the day itself in its own baseline', () => {
    const series = computeRecoverySeries([
      ...days('2026-03-01', 5, { heartRateVariability: 50 }),
      day('2026-03-06', { heartRateVariability: 25 }),
    ]);
    const last = series[5];
    expect(last.components[0].baseline?.mean).toBeCloseTo(Math.log(50), 10);
    expect(last.components[0].score).toBe(0); // far below usual
  });

  it('uses only the previous 90 days', () => {
    const series = computeRecoverySeries([
      ...days('2025-11-01', 5, { restingHeartRate: 80 }),
      ...days('2026-03-01', 3, { restingHeartRate: 60 }),
      day('2026-03-10', { restingHeartRate: 60 }),
    ]);
    const last = series[series.length - 1];
    expect(last.components[0].baseline).toMatchObject({ mean: 60, n: 3 });
  });

  it('compares luteal days with luteal history (phase-specific baseline)', () => {
    // Luteal RHR is typically a few bpm higher: 64 vs 60 in the follicular phase.
    const history = [
      ...days('2026-01-05', 5, { phase: 'follicular', restingHeartRate: 60 }),
      ...days('2026-01-15', 5, { phase: 'luteal', restingHeartRate: 64 }),
    ];
    const series = computeRecoverySeries([
      ...history,
      day('2026-01-25', { phase: 'luteal', restingHeartRate: 64 }),
      day('2026-01-26', { phase: 'follicular', restingHeartRate: 64 }),
    ]);
    const luteal = series[10];
    const follicular = series[11];
    expect(luteal.components[0].baseline).toMatchObject({
      source: 'phase',
      mean: 64,
    });
    expect(luteal.score).toBe(75); // normal for the luteal phase
    expect(follicular.components[0].baseline).toMatchObject({
      source: 'phase',
      mean: 60,
    });
    expect(follicular.score).toBe(25); // 4 bpm above the follicular usual (SD floor 2)
  });

  it('falls back to the overall baseline when the phase has under 3 readings', () => {
    const series = computeRecoverySeries([
      ...days('2026-01-05', 4, { phase: 'follicular', restingHeartRate: 60 }),
      day('2026-01-20', { phase: 'luteal', restingHeartRate: 60 }),
    ]);
    expect(series[4].components[0].baseline).toMatchObject({
      source: 'overall',
      n: 4,
    });
  });

  it('combines all three components with the documented weights', () => {
    const history = days('2026-02-01', 10, {
      phase: 'follicular',
      heartRateVariability: 50,
      restingHeartRate: 60,
      sleepQuality: 7,
    });
    const series = computeRecoverySeries([
      ...history,
      day('2026-02-11', {
        phase: 'follicular',
        heartRateVariability: 50,
        restingHeartRate: 60,
        sleepQuality: 10,
        sleepHours: 8,
      }),
    ]);
    const today = series[10];
    expect(today.components.map((c) => c.key)).toEqual(['hrv', 'rhr', 'sleep']);
    // HRV 75 (.4), RHR 75 (.3), sleep 100 (.3)
    expect(today.score).toBe(Math.round(75 * 0.4 + 75 * 0.3 + 100 * 0.3));
    expect(today.zone).toBe('green');
  });

  it('alerts on a drop of at least 15 points below the usual phase score', () => {
    const steady = days('2026-02-01', 10, {
      phase: 'luteal',
      restingHeartRate: 60,
      heartRateVariability: 50,
    });
    const series = computeRecoverySeries([
      ...steady,
      day('2026-02-11', {
        phase: 'luteal',
        restingHeartRate: 62, // 1 SD (floor 2 bpm) above usual
        heartRateVariability: 50 * Math.exp(-0.1), // 1 SD (floor 0.1) below usual
      }),
    ]);
    const today = series[10];
    expect(today.comparison).toMatchObject({ source: 'phase', n: 7 });
    // 7 earlier scored days (the first 3 had no baseline yet), all 75.
    expect(today.comparison?.mean).toBe(75);
    expect(today.score).toBe(50);
    expect(today.drop).toBe(25);
    expect(today.alert).toBe(true);
  });

  it('does not alert on small dips', () => {
    const series = computeRecoverySeries([
      ...days('2026-02-01', 10, { restingHeartRate: 60 }),
      day('2026-02-11', { restingHeartRate: 61 }),
    ]);
    const today = series[10];
    expect(today.score).toBe(63); // 75 - 12.5, rounded
    expect(today.drop).toBe(12);
    expect(today.alert).toBe(false);
  });

  it('does not alert without at least 3 earlier scores', () => {
    const series = computeRecoverySeries([
      day('2026-02-01', { sleepQuality: 10 }),
      day('2026-02-02', { sleepQuality: 10 }),
      day('2026-02-03', { sleepQuality: 1 }),
    ]);
    expect(series[2]).toMatchObject({
      score: 0,
      comparison: null,
      alert: false,
    });
  });

  it('keeps earlier results unchanged when a later day is added', () => {
    const base = days('2026-02-01', 6, {
      restingHeartRate: 60,
      sleepQuality: 6,
    });
    const before = computeRecoverySeries(base);
    const after = computeRecoverySeries([
      ...base,
      day('2026-02-07', { restingHeartRate: 70 }),
    ]);
    expect(after.slice(0, 6)).toEqual(before);
  });

  it('sorts input and keeps the last duplicate', () => {
    const series = computeRecoverySeries([
      day('2026-02-02', { sleepQuality: 10 }),
      day('2026-02-01', { sleepQuality: 1 }),
      day('2026-02-02', { sleepQuality: 4 }),
    ]);
    expect(series.map((r) => [r.date, r.score])).toEqual([
      ['2026-02-01', 0],
      ['2026-02-02', 33],
    ]);
  });
});

describe('isSignificantDrop', () => {
  const comparison = (sd: number) => ({
    source: 'phase' as const,
    mean: 70,
    sd,
    n: 10,
  });

  it('alerts from exactly 15 points when that is more than 1 SD', () => {
    expect(isSignificantDrop(15, comparison(8))).toBe(true);
    expect(isSignificantDrop(14.9, comparison(8))).toBe(false);
    expect(isSignificantDrop(15, comparison(0))).toBe(true);
  });

  it('does not alert on dips over 1 SD but under 15 points (steady history)', () => {
    expect(isSignificantDrop(6, comparison(5))).toBe(false);
    expect(isSignificantDrop(14, comparison(5))).toBe(false);
  });

  it('needs more than 1 SD when scores usually swing by more than 15', () => {
    expect(isSignificantDrop(18, comparison(20))).toBe(false);
    expect(isSignificantDrop(20, comparison(20))).toBe(false);
    expect(isSignificantDrop(20.5, comparison(20))).toBe(true);
  });
});

describe('summarizePhaseBaselines', () => {
  it('averages scores per phase in the window and needs 3 per phase', () => {
    const series = computeRecoverySeries([
      ...days('2026-03-01', 4, { phase: 'follicular', sleepQuality: 10 }),
      ...days('2026-03-10', 2, { phase: 'luteal', sleepQuality: 1 }),
      // Outside the 90-day window ending 2026-03-31.
      ...days('2025-11-01', 3, { phase: 'menstrual', sleepQuality: 1 }),
    ]);
    const baselines = summarizePhaseBaselines(series, '2026-03-31');
    expect(baselines.follicular).toMatchObject({ mean: 100, n: 4 });
    expect(baselines.luteal).toBeNull();
    expect(baselines.menstrual).toBeNull();
    expect(baselines.ovulation).toBeNull();
  });
});
