/**
 * Geometry for the clinical summary PDF charts: scales, "nice" axis ticks and the
 * points of the cycle length and BBT charts. Pure functions (no React, no PDF library),
 * so the PDF components only draw what is computed and tested here.
 */

import { fromStoredCelsius, type TemperatureUnit } from '@/lib/bbt';
import { addDaysToDateOnly, daysBetweenDateOnly } from '@/lib/date-only';
import type { BbtTrends, CycleRow } from '@/lib/clinical-report';

export type ChartBox = {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type PlotArea = { left: number; right: number; top: number; bottom: number };

/** `label` is `value` as printed on the axis (see `formatTickLabels`). */
export type AxisTick = { value: number; y: number; label: string };

export type Point = { x: number; y: number };

function plotArea(box: ChartBox): PlotArea {
  return {
    left: box.left,
    right: box.width - box.right,
    top: box.top,
    bottom: box.height - box.bottom,
  };
}

/** Maps `domain` linearly onto `range`; a zero-width domain maps to the middle. */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number]
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (value) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0);
}

/** Decimals that represent every multiple of `step` exactly (2.5 → 1, 0.2 → 2). */
function decimalsOf(step: number): number {
  return Math.max(0, Math.ceil(-Math.log10(step)) + 1);
}

/**
 * Round numbers covering `min`..`max` with at most about `maxTicks` ticks (steps of
 * 1, 2, 2.5 or 5 × 10^n), after Heckbert, "Nice numbers for graph labels", Graphics
 * Gems (1990).
 */
export function niceTicks(min: number, max: number, maxTicks = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const rough = (high - low) / Math.max(1, maxTicks - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= rough) ??
    10 * magnitude;
  const decimals = decimalsOf(step);
  // The epsilon keeps float noise (36.0 / 0.2 = 179.999…) from adding a tick below.
  const first = Math.floor(low / step + 1e-9) * step;
  const ticks: number[] = [];
  for (let i = 0; i <= maxTicks * 3; i++) {
    const value = Number((first + i * step).toFixed(decimals));
    ticks.push(value);
    if (value >= high - 1e-9) break;
  }
  return ticks;
}

/** Fewest decimals (at most 6) that print `value` exactly. */
function decimalsNeeded(value: number): number {
  for (let decimals = 0; decimals < 6; decimals++) {
    if (Math.abs(Number(value.toFixed(decimals)) - value) < 1e-9) return decimals;
  }
  return 6;
}

/**
 * Axis labels with one number of decimals for the whole axis: enough to print every
 * tick exactly (a 0.25 step gives "97.25", not "97.3"), and at least `minDecimals`. So
 * a label always matches its gridline and two ticks never share a label.
 */
export function formatTickLabels(
  values: readonly number[],
  minDecimals = 0
): string[] {
  const decimals = Math.max(minDecimals, ...values.map(decimalsNeeded));
  return values.map((value) => value.toFixed(decimals));
}

function axisTicks(
  values: readonly number[],
  y: (value: number) => number,
  minDecimals = 0
): AxisTick[] {
  const labels = formatTickLabels(values, minDecimals);
  return values.map((value, index) => ({ value, y: y(value), label: labels[index] }));
}

export type CycleLengthChart = {
  plot: PlotArea;
  points: (Point & { length: number; start: string })[];
  yTicks: AxisTick[];
  /** y of the average line, when there is an average. */
  averageY: number | null;
};

/** Cycle length per completed cycle, evenly spaced in order, with the average line. */
export function buildCycleLengthChart(
  cycles: readonly CycleRow[],
  average: number | null,
  box: ChartBox
): CycleLengthChart | null {
  if (cycles.length === 0) return null;
  const plot = plotArea(box);
  const lengths = cycles.map((cycle) => cycle.length);
  const values = average === null ? lengths : [...lengths, average];
  const ticks = niceTicks(Math.min(...values) - 1, Math.max(...values) + 1, 5);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [plot.bottom, plot.top]);
  const band = (plot.right - plot.left) / cycles.length;
  return {
    plot,
    points: cycles.map((cycle, index) => ({
      x: plot.left + band * (index + 0.5),
      y: y(cycle.length),
      length: cycle.length,
      start: cycle.start,
    })),
    yTicks: axisTicks(ticks, y),
    averageY: average === null ? null : y(average),
  };
}

/** Readings further apart than this are not joined by the BBT line. */
export const BBT_LINE_MAX_GAP_DAYS = 3;

export type BbtChart = {
  plot: PlotArea;
  unit: TemperatureUnit;
  /** Polylines: a new one starts after a gap or at a period start. */
  segments: Point[][];
  points: (Point & { date: string })[];
  ovulations: (Point & { date: string })[];
  coverlines: { x1: number; x2: number; y: number }[];
  periodStarts: { x: number; date: string }[];
  yTicks: AxisTick[];
  /** First day of each month in the range. */
  xTicks: { x: number; date: string }[];
};

/** First day of every month that starts inside `start`..`end`. */
export function monthStartsInRange(start: string, end: string): string[] {
  const result: string[] = [];
  let current = start.endsWith('-01')
    ? start
    : addDaysToDateOnly(`${start.slice(0, 7)}-01`, 32).slice(0, 7) + '-01';
  while (current <= end) {
    result.push(current);
    current = addDaysToDateOnly(current, 32).slice(0, 7) + '-01';
  }
  return result;
}

export function buildBbtChart(
  bbt: BbtTrends,
  periodStarts: readonly string[],
  range: { start: string; end: string },
  box: ChartBox
): BbtChart | null {
  if (bbt.readings.length === 0) return null;
  const unit = bbt.unit;
  const plot = plotArea(box);
  const toUnit = (celsius: number) => fromStoredCelsius(celsius, unit);

  const confirmed = bbt.cycles.filter(
    (cycle) => cycle.status === 'confirmed' && cycle.coverlineCelsius !== null
  );
  const values = [
    ...bbt.readings.map((r) => toUnit(r.celsius)),
    ...confirmed.map((cycle) => toUnit(cycle.coverlineCelsius ?? 0)),
  ];
  const pad = unit === 'C' ? 0.1 : 0.2;
  const ticks = niceTicks(Math.min(...values) - pad, Math.max(...values) + pad, 6);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [plot.bottom, plot.top]);
  const lastDay = Math.max(1, daysBetweenDateOnly(range.start, range.end));
  const xDay = linearScale([0, lastDay], [plot.left, plot.right]);
  const x = (date: string) => xDay(daysBetweenDateOnly(range.start, date));

  const startsInRange = periodStarts.filter(
    (date) => date >= range.start && date <= range.end
  );
  const points = bbt.readings.map((reading) => ({
    x: x(reading.date),
    y: y(toUnit(reading.celsius)),
    date: reading.date,
  }));

  const segments: Point[][] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const breakHere =
      !previous ||
      daysBetweenDateOnly(previous.date, point.date) > BBT_LINE_MAX_GAP_DAYS ||
      startsInRange.some((start) => start > previous.date && start <= point.date);
    if (breakHere) segments.push([]);
    segments[segments.length - 1].push({ x: point.x, y: point.y });
  });

  const pointByDate = new Map(points.map((point) => [point.date, point]));
  return {
    plot,
    unit,
    segments,
    points,
    ovulations: bbt.ovulationDates.flatMap((date) => {
      const point = pointByDate.get(date);
      return point ? [{ x: point.x, y: point.y, date }] : [];
    }),
    coverlines: confirmed.map((cycle) => {
      const from = cycle.start > range.start ? cycle.start : range.start;
      const to = cycle.end !== null && cycle.end < range.end ? cycle.end : range.end;
      return {
        x1: x(from),
        x2: x(to),
        y: y(toUnit(cycle.coverlineCelsius ?? 0)),
      };
    }),
    periodStarts: startsInRange.map((date) => ({ x: x(date), date })),
    // Temperatures read best with at least one decimal (36.0, not 36).
    yTicks: axisTicks(ticks, y, 1),
    xTicks: monthStartsInRange(range.start, range.end).map((date) => ({
      x: x(date),
      date,
    })),
  };
}

/** "x1,y1 x2,y2 …" for SVG polylines, rounded to 0.01 pt. */
export function toSvgPoints(points: readonly Point[]): string {
  return points
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
}
