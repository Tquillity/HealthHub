import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from '@/lib/date-only';
import { buildCycleHistory } from '@/lib/cycle-history';
import {
  buildCycleInsights,
  buildRecoveryInputs,
  buildTodayRecovery,
  summarizeThermalShift,
  type DailyMetricsRow,
} from '@/lib/cycle-insights';

function row(
  date: string,
  values: Partial<Omit<DailyMetricsRow, 'date'>> = {}
): DailyMetricsRow {
  return {
    date,
    temperature: null,
    restingHeartRate: null,
    heartRateVariability: null,
    sleepQuality: null,
    sleepHours: null,
    ...values,
  };
}

function temps(start: string, values: number[]): DailyMetricsRow[] {
  return values.map((temperature, i) =>
    row(addDaysToDateOnly(start, i), { temperature })
  );
}

const CYCLE_TEMPS = [
  36.3, 36.2, 36.25, 36.3, 36.2, 36.3, 36.25, 36.2, 36.3, 36.25, 36.3, 36.3,
  36.6, 36.65, 36.7, 36.7, 36.75,
];

describe('summarizeThermalShift', () => {
  it('summarises a missing analysis as not detected with 0 readings', () => {
    expect(summarizeThermalShift(null, null)).toEqual({
      cycleStart: null,
      detected: false,
      ovulationDate: null,
      shiftDate: null,
      confirmedDate: null,
      coverlineCelsius: null,
      validReadings: 0,
      readingsNeeded: 9,
    });
  });
});

describe('buildCycleInsights', () => {
  const base = {
    cycleLength: 28,
    temperatureUnit: 'C' as const,
    includeRecovery: false,
  };

  it('maps the open cycle BBT readings to chart days and confirms ovulation', () => {
    // Period started 2026-03-01; today is cycle day 17.
    const insights = buildCycleInsights({
      ...base,
      today: '2026-03-17',
      daysIntoCycle: 17,
      periodStarts: ['2026-02-01', '2026-03-01'],
      rows: [
        // Previous cycle readings are not part of this cycle's analysis.
        ...temps('2026-02-10', [36.9, 36.9, 36.9]),
        ...temps('2026-03-01', CYCLE_TEMPS),
      ],
    });

    expect(insights.cycles).toHaveLength(2);
    expect(insights.shift).toMatchObject({
      cycleStart: '2026-03-01',
      detected: true,
      ovulationDate: '2026-03-12',
      shiftDate: '2026-03-13',
      coverlineCelsius: 36.3,
      validReadings: 17,
    });
    const { bbt, chartStart, recovery } = insights.overlays;
    expect(chartStart).toBe('2026-03-01');
    expect(bbt.points).toHaveLength(17);
    expect(bbt.points[0]).toEqual({
      day: 1,
      date: '2026-03-01',
      celsius: 36.3,
      value: 36.3,
    });
    expect(bbt.ovulationDay).toBe(12);
    expect(bbt.coverline).toBe(36.3);
    expect(recovery).toBeNull();
  });

  it('converts chart values and the coverline to Fahrenheit', () => {
    const insights = buildCycleInsights({
      ...base,
      temperatureUnit: 'F',
      today: '2026-03-17',
      daysIntoCycle: 17,
      periodStarts: ['2026-03-01'],
      rows: temps('2026-03-01', CYCLE_TEMPS),
    });
    expect(insights.overlays.bbt.unit).toBe('F');
    expect(insights.overlays.bbt.points[0].value).toBe(97.34);
    expect(insights.overlays.bbt.coverline).toBe(97.34);
    // The analysis itself stays in Celsius.
    expect(insights.shift.coverlineCelsius).toBe(36.3);
  });

  it('reports insufficient readings early in a cycle', () => {
    const insights = buildCycleInsights({
      ...base,
      today: '2026-03-05',
      daysIntoCycle: 5,
      periodStarts: ['2026-03-01'],
      rows: temps('2026-03-01', [36.3, 36.2, 36.3, 36.25, 36.3]),
    });
    expect(insights.shift).toMatchObject({
      detected: false,
      validReadings: 5,
      readingsNeeded: 9,
    });
    expect(insights.overlays.bbt.ovulationDay).toBeNull();
  });

  it('works without any logged period start', () => {
    const insights = buildCycleInsights({
      ...base,
      today: '2026-03-05',
      daysIntoCycle: 5,
      periodStarts: [],
      rows: temps('2026-03-01', [36.3, 36.4]),
    });
    expect(insights.cycles).toEqual([]);
    expect(insights.shift.cycleStart).toBeNull();
    // Readings still appear on the chart window.
    expect(insights.overlays.bbt.points.map((p) => p.day)).toEqual([1, 2]);
  });

  it('leaves out out-of-range and future readings', () => {
    const insights = buildCycleInsights({
      ...base,
      today: '2026-03-03',
      daysIntoCycle: 3,
      periodStarts: ['2026-03-01'],
      rows: [
        row('2026-03-01', { temperature: 36.3 }),
        row('2026-03-02', { temperature: 39.4 }),
        row('2026-03-03', { temperature: 36.4 }),
        row('2026-03-04', { temperature: 36.5 }),
      ],
    });
    expect(insights.overlays.bbt.points.map((p) => p.date)).toEqual([
      '2026-03-01',
      '2026-03-03',
    ]);
  });

  it('aligns the chart with the wrapped day when the period is late', () => {
    // 28-day setting, last logged start 30 days ago: the existing model shows day 3
    // of a projected cycle, so the chart window starts 2 days ago.
    const insights = buildCycleInsights({
      ...base,
      today: '2026-03-31',
      daysIntoCycle: 3,
      periodStarts: ['2026-03-01'],
      rows: temps('2026-03-01', CYCLE_TEMPS),
    });
    expect(insights.overlays.chartStart).toBe('2026-03-29');
    // The shift is still found in the real open cycle, but its day is off this chart.
    expect(insights.shift.detected).toBe(true);
    expect(insights.overlays.bbt.ovulationDay).toBeNull();
  });

  it('adds recovery points, alerts and phase baselines when vitals are on', () => {
    const rows: DailyMetricsRow[] = [];
    // Three earlier cycles of steady vitals, then today well below usual.
    for (let d = 0; d < 84; d++) {
      rows.push(
        row(addDaysToDateOnly('2026-01-01', d), {
          restingHeartRate: 60,
          heartRateVariability: 50,
          sleepQuality: 7,
        })
      );
    }
    rows.push(
      row('2026-03-26', {
        restingHeartRate: 68,
        heartRateVariability: 35,
        sleepQuality: 3,
      })
    );
    const insights = buildCycleInsights({
      ...base,
      includeRecovery: true,
      today: '2026-03-26',
      daysIntoCycle: 1,
      periodStarts: ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'],
      rows,
    });
    const recovery = insights.overlays.recovery;
    expect(recovery).not.toBeNull();
    expect(recovery?.points).toHaveLength(1);
    expect(recovery?.points[0]).toMatchObject({
      day: 1,
      date: '2026-03-26',
      zone: 'red',
      alert: true,
      restingHeartRate: 68,
    });
    expect(recovery?.points[0].drop).toBeGreaterThanOrEqual(15);
    // Every phase has a usual score, drawn over that phase's chart days.
    expect(recovery?.phaseBaselines.map((b) => b.phase)).toEqual([
      'menstrual',
      'follicular',
      'ovulation',
      'luteal',
    ]);
    expect(recovery?.phaseBaselines[0]).toMatchObject({
      startDay: 1,
      endDay: 5,
    });
    expect(recovery?.phaseBaselines[3]).toMatchObject({
      startDay: 15,
      endDay: 28,
    });
  });
});

describe('buildRecoveryInputs / buildTodayRecovery', () => {
  const cycles = buildCycleHistory(['2026-03-01']);

  it('keeps only rows with recovery data and tags them with the cycle phase', () => {
    const inputs = buildRecoveryInputs(
      [
        row('2026-03-02', { sleepHours: 8 }),
        row('2026-03-03', { temperature: 36.4 }),
        row('2026-03-20', { restingHeartRate: 60 }),
      ],
      cycles,
      28
    );
    expect(inputs.map((i) => [i.date, i.phase])).toEqual([
      ['2026-03-02', 'menstrual'],
      ['2026-03-20', 'luteal'],
    ]);
    expect(
      buildRecoveryInputs([row('2026-03-02', { sleepHours: 8 })], null, 28)[0]
        .phase
    ).toBeNull();
  });

  it("summarises today's recovery or returns null without data", () => {
    const rows = [
      row('2026-03-02', { sleepQuality: 10 }),
      row('2026-03-03', { sleepQuality: 7 }),
    ];
    expect(
      buildTodayRecovery({
        today: '2026-03-03',
        rows,
        cycles,
        typicalCycleLength: 28,
      })
    ).toMatchObject({
      date: '2026-03-03',
      score: 67,
      zone: 'green',
      alert: false,
      comparedWith: null,
      components: [{ key: 'sleep', score: 67, baseline: null }],
    });
    expect(
      buildTodayRecovery({
        today: '2026-03-04',
        rows,
        cycles,
        typicalCycleLength: 28,
      })
    ).toBeNull();
  });
});
