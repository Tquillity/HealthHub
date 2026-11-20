/**
 * Cycle insights: joins period history, BBT readings and vitals into the data the cycle
 * dashboard, the dashboard Vitals card and later reports need.
 *
 * Pure functions only (no database, no clock): `lib/daily-metrics.ts` loads the rows and
 * calls these. Everything is serialisable, so it can go straight to client components.
 *
 * Chart alignment: the cycle chart draws days 1..cycleLength of the cycle that contains
 * "today" in the existing model (`calculateCyclePhase`, which wraps after cycleLength
 * days). So chart day N is `today − (daysIntoCycle − 1) + (N − 1)`. The thermal shift is
 * always computed on the real open cycle (from the latest logged period start); in the
 * normal case that is the same cycle as the chart.
 */

import { getPhaseForDay, type CyclePhase } from '@/lib/cycle-calculator';
import {
  buildCycleHistory,
  getCycleDayInfo,
  getOpenCycle,
  type CycleSpan,
} from '@/lib/cycle-history';
import {
  analyzeBbtByCycle,
  cleanBbtReadings,
  fromStoredCelsius,
  MIN_READINGS_FOR_SHIFT,
  type BbtReading,
  type TemperatureUnit,
  type ThermalShiftResult,
} from '@/lib/bbt';
import {
  computeRecoverySeries,
  RECOVERY_BASELINE_WINDOW_DAYS,
  summarizePhaseBaselines,
  type BaselineSource,
  type RecoveryComponentKey,
  type RecoveryDayInput,
  type RecoveryDayResult,
  type RecoveryZone,
} from '@/lib/recovery';
import { addDaysToDateOnly, daysBetweenDateOnly } from '@/lib/date-only';

/**
 * Days of journal rows needed to score the last 90 days with full baselines
 * (each of those days looks back another 90 days).
 */
export const RECOVERY_HISTORY_DAYS = RECOVERY_BASELINE_WINDOW_DAYS * 2;

/** One journal day's numeric metrics (all plain numbers; no encrypted fields). */
export type DailyMetricsRow = {
  /** `YYYY-MM-DD` */
  date: string;
  /** °C */
  temperature: number | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
};

export type ThermalShiftSummary = {
  /** Start of the cycle the summary is for, or null when no period start is logged. */
  cycleStart: string | null;
  detected: boolean;
  ovulationDate: string | null;
  shiftDate: string | null;
  confirmedDate: string | null;
  coverlineCelsius: number | null;
  validReadings: number;
  readingsNeeded: number;
};

export type ChartBbtPoint = {
  /** Chart day (1-based). */
  day: number;
  date: string;
  celsius: number;
  /** In the user's unit. */
  value: number;
};

export type ChartBbtOverlay = {
  unit: TemperatureUnit;
  points: ChartBbtPoint[];
  shift: ThermalShiftSummary;
  /** Chart day of the bio-verified ovulation, when it falls inside the chart. */
  ovulationDay: number | null;
  /** Coverline in the user's unit. */
  coverline: number | null;
};

export type ChartRecoveryPoint = {
  day: number;
  date: string;
  score: number;
  zone: RecoveryZone;
  alert: boolean;
  /** Points below the usual score for the phase (rounded), when known. */
  drop: number | null;
  /** Usual score this day was compared with (rounded), when known. */
  usualScore: number | null;
  restingHeartRate: number | null;
  heartRateVariability: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
};

export type ChartPhaseBaseline = {
  phase: CyclePhase;
  startDay: number;
  endDay: number;
  /** Usual recovery score in this phase over the last 90 days (rounded). */
  score: number;
};

export type ChartRecoveryOverlay = {
  points: ChartRecoveryPoint[];
  phaseBaselines: ChartPhaseBaseline[];
};

export type CycleChartOverlays = {
  /** Date of chart day 1. */
  chartStart: string;
  bbt: ChartBbtOverlay;
  /** null when vitals tracking is off. */
  recovery: ChartRecoveryOverlay | null;
};

export type RecoverySummary = {
  date: string;
  phase: CyclePhase | null;
  score: number;
  zone: RecoveryZone;
  alert: boolean;
  drop: number | null;
  usualScore: number | null;
  comparedWith: BaselineSource | null;
  components: {
    key: RecoveryComponentKey;
    score: number;
    baseline: BaselineSource | null;
  }[];
};

export function summarizeThermalShift(
  cycleStart: string | null,
  result: ThermalShiftResult | null
): ThermalShiftSummary {
  const base = {
    cycleStart,
    validReadings: result?.validReadings ?? 0,
    readingsNeeded: MIN_READINGS_FOR_SHIFT,
  };
  if (result?.detected) {
    return {
      ...base,
      detected: true,
      ovulationDate: result.ovulationDate,
      shiftDate: result.shiftDate,
      confirmedDate: result.confirmedDate,
      coverlineCelsius: result.coverlineCelsius,
    };
  }
  return {
    ...base,
    detected: false,
    ovulationDate: null,
    shiftDate: null,
    confirmedDate: null,
    coverlineCelsius: null,
  };
}

function hasRecoveryData(row: DailyMetricsRow): boolean {
  return (
    row.restingHeartRate !== null ||
    row.heartRateVariability !== null ||
    row.sleepQuality !== null ||
    row.sleepHours !== null
  );
}

/**
 * Recovery inputs with each day's cycle phase. Pass `cycles: null` when cycle tracking
 * is off: every day then uses the overall personal baseline.
 */
export function buildRecoveryInputs(
  rows: readonly DailyMetricsRow[],
  cycles: readonly CycleSpan[] | null,
  typicalCycleLength: number
): RecoveryDayInput[] {
  return rows.filter(hasRecoveryData).map((row) => ({
    date: row.date,
    phase: cycles
      ? (getCycleDayInfo(cycles, row.date, typicalCycleLength)?.phase ?? null)
      : null,
    restingHeartRate: row.restingHeartRate,
    heartRateVariability: row.heartRateVariability,
    sleepQuality: row.sleepQuality,
    sleepHours: row.sleepHours,
  }));
}

export function summarizeRecoveryDay(
  result: RecoveryDayResult | undefined
): RecoverySummary | null {
  if (!result || result.score === null || result.zone === null) return null;
  return {
    date: result.date,
    phase: result.phase,
    score: result.score,
    zone: result.zone,
    alert: result.alert,
    drop: result.drop !== null ? Math.round(result.drop) : null,
    usualScore: result.comparison ? Math.round(result.comparison.mean) : null,
    comparedWith: result.comparison?.source ?? null,
    components: result.components.map((c) => ({
      key: c.key,
      score: Math.round(c.score),
      baseline: c.baseline?.source ?? null,
    })),
  };
}

/** Today's recovery from the loaded rows (null when today has no usable data). */
export function buildTodayRecovery(input: {
  today: string;
  rows: readonly DailyMetricsRow[];
  cycles: readonly CycleSpan[] | null;
  typicalCycleLength: number;
}): RecoverySummary | null {
  const series = computeRecoverySeries(
    buildRecoveryInputs(input.rows, input.cycles, input.typicalCycleLength)
  );
  return summarizeRecoveryDay(series.find((r) => r.date === input.today));
}

export type CycleInsightsInput = {
  /** `YYYY-MM-DD` */
  today: string;
  /** User's typical cycle length (also the chart length). */
  cycleLength: number;
  /** Today's day in the chart's cycle (from `calculateCyclePhase`). */
  daysIntoCycle: number;
  /** Logged period starts (any order; lastPeriodDate merged in by the caller). */
  periodStarts: readonly string[];
  rows: readonly DailyMetricsRow[];
  temperatureUnit: TemperatureUnit;
  /** Vitals opt-in: without it no recovery data is computed or returned. */
  includeRecovery: boolean;
};

export type CycleInsights = {
  cycles: CycleSpan[];
  /** Thermal shift of the open cycle. */
  shift: ThermalShiftSummary;
  overlays: CycleChartOverlays;
};

/** Contiguous runs of the same phase across chart days 1..cycleLength. */
function phaseRuns(
  cycleLength: number
): { phase: CyclePhase; startDay: number; endDay: number }[] {
  const runs: { phase: CyclePhase; startDay: number; endDay: number }[] = [];
  for (let day = 1; day <= cycleLength; day++) {
    const phase = getPhaseForDay(day, cycleLength);
    const last = runs[runs.length - 1];
    if (last && last.phase === phase) {
      last.endDay = day;
    } else {
      runs.push({ phase, startDay: day, endDay: day });
    }
  }
  return runs;
}

export function buildCycleInsights(input: CycleInsightsInput): CycleInsights {
  const { today, cycleLength, temperatureUnit } = input;
  const cycles = buildCycleHistory(input.periodStarts);
  const openCycle = getOpenCycle(cycles);

  const readings: BbtReading[] = input.rows.flatMap((row) =>
    row.temperature !== null && row.date <= today
      ? [{ date: row.date, celsius: row.temperature }]
      : []
  );
  const openAnalysis = openCycle
    ? analyzeBbtByCycle([openCycle], readings)[0]
    : null;
  const shift = summarizeThermalShift(
    openCycle?.start ?? null,
    openAnalysis?.shift ?? null
  );

  const chartStart = addDaysToDateOnly(
    today,
    -(Math.max(1, input.daysIntoCycle) - 1)
  );
  const chartDay = (date: string): number | null => {
    if (date > today) return null;
    const day = daysBetweenDateOnly(chartStart, date) + 1;
    return day >= 1 && day <= cycleLength ? day : null;
  };

  // Out-of-range readings never reach the chart (same rule as the analysis).
  const bbtPoints: ChartBbtPoint[] = cleanBbtReadings(readings).flatMap(
    (reading) => {
      const day = chartDay(reading.date);
      return day === null
        ? []
        : [
            {
              day,
              date: reading.date,
              celsius: reading.celsius,
              value: fromStoredCelsius(reading.celsius, temperatureUnit),
            },
          ];
    }
  );

  let recovery: ChartRecoveryOverlay | null = null;
  if (input.includeRecovery) {
    const series = computeRecoverySeries(
      buildRecoveryInputs(
        input.rows,
        cycles.length > 0 ? cycles : null,
        cycleLength
      )
    );
    const rowsByDate = new Map(input.rows.map((row) => [row.date, row]));
    const points: ChartRecoveryPoint[] = series.flatMap((result) => {
      const day = chartDay(result.date);
      const summary = summarizeRecoveryDay(result);
      if (day === null || !summary) return [];
      const row = rowsByDate.get(result.date);
      return [
        {
          day,
          date: result.date,
          score: summary.score,
          zone: summary.zone,
          alert: summary.alert,
          drop: summary.drop,
          usualScore: summary.usualScore,
          restingHeartRate: row?.restingHeartRate ?? null,
          heartRateVariability: row?.heartRateVariability ?? null,
          sleepQuality: row?.sleepQuality ?? null,
          sleepHours: row?.sleepHours ?? null,
        },
      ];
    });
    const baselines = summarizePhaseBaselines(series, today);
    const phaseBaselines = phaseRuns(cycleLength).flatMap((run) => {
      const baseline = baselines[run.phase];
      return baseline ? [{ ...run, score: Math.round(baseline.mean) }] : [];
    });
    recovery = { points, phaseBaselines };
  }

  const ovulationDay = shift.ovulationDate
    ? chartDay(shift.ovulationDate)
    : null;

  return {
    cycles,
    shift,
    overlays: {
      chartStart,
      bbt: {
        unit: temperatureUnit,
        points: bbtPoints,
        shift,
        ovulationDay,
        coverline:
          shift.coverlineCelsius !== null
            ? fromStoredCelsius(shift.coverlineCelsius, temperatureUnit)
            : null,
      },
      recovery,
    },
  };
}
