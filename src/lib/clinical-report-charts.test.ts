import { describe, expect, it } from 'vitest';
import {
  buildBbtChart,
  buildCycleLengthChart,
  formatTickLabels,
  linearScale,
  monthStartsInRange,
  niceTicks,
  toSvgPoints,
  type ChartBox,
} from '@/lib/clinical-report-charts';
import type { BbtTrends } from '@/lib/clinical-report';

const BOX: ChartBox = {
  width: 500,
  height: 200,
  top: 10,
  right: 10,
  bottom: 30,
  left: 40,
};

describe('linearScale', () => {
  it('maps the domain onto the range (inverted y axes too)', () => {
    const y = linearScale([0, 10], [100, 0]);
    expect(y(0)).toBe(100);
    expect(y(10)).toBe(0);
    expect(y(2.5)).toBe(75);
  });

  it('maps a zero-width domain to the middle', () => {
    expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
  });
});

describe('niceTicks', () => {
  it('returns round, evenly spaced ticks covering the values', () => {
    expect(niceTicks(25, 33, 5)).toEqual([24, 26, 28, 30, 32, 34]);
    expect(niceTicks(36.05, 36.95, 6)).toEqual([36, 36.2, 36.4, 36.6, 36.8, 37]);
    expect(niceTicks(0, 100, 5)).toEqual([0, 25, 50, 75, 100]);
  });

  it('widens a single value and rejects non-finite input', () => {
    expect(niceTicks(28, 28, 5)).toEqual([27, 27.5, 28, 28.5, 29]);
    expect(niceTicks(Number.NaN, 1)).toEqual([]);
  });
});

describe('monthStartsInRange', () => {
  it('lists the first day of each month inside the range', () => {
    expect(monthStartsInRange('2026-08-21', '2026-11-20')).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
    expect(monthStartsInRange('2026-11-01', '2027-01-15')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
    expect(monthStartsInRange('2026-11-02', '2026-11-20')).toEqual([]);
  });
});

describe('buildCycleLengthChart', () => {
  it('spaces cycles evenly and places the average line', () => {
    const chart = buildCycleLengthChart(
      [
        { start: '2026-06-01', end: '2026-06-28', length: 28 },
        { start: '2026-06-29', end: '2026-07-28', length: 30 },
      ],
      29,
      BOX
    );
    expect(chart).not.toBeNull();
    expect(chart?.points.map((p) => p.x)).toEqual([152.5, 377.5]);
    const top = chart?.plot.top ?? 0;
    const bottom = chart?.plot.bottom ?? 0;
    for (const point of chart?.points ?? []) {
      expect(point.y).toBeGreaterThanOrEqual(top);
      expect(point.y).toBeLessThanOrEqual(bottom);
    }
    // Longer cycle sits higher on the page (smaller y).
    expect(chart?.points[1].y).toBeLessThan(chart?.points[0].y ?? 0);
    expect(chart?.averageY).toBeCloseTo(
      ((chart?.points[0].y ?? 0) + (chart?.points[1].y ?? 0)) / 2
    );
    expect(chart?.yTicks.map((t) => t.label)).toEqual([
      '27',
      '28',
      '29',
      '30',
      '31',
    ]);
  });

  it('returns null without cycles', () => {
    expect(buildCycleLengthChart([], null, BOX)).toBeNull();
  });
});

describe('buildBbtChart', () => {
  const bbt: BbtTrends = {
    unit: 'C',
    readings: [
      { date: '2026-10-01', celsius: 36.3 },
      { date: '2026-10-02', celsius: 36.2 },
      { date: '2026-10-06', celsius: 36.3 },
      { date: '2026-10-07', celsius: 36.7 },
      { date: '2026-10-29', celsius: 36.25 },
      { date: '2026-10-30', celsius: 36.3 },
    ],
    daysWithReading: 6,
    phaseAverages: [],
    cycles: [
      {
        start: '2026-10-01',
        end: '2026-10-28',
        isOpen: false,
        readings: 4,
        status: 'confirmed',
        ovulationDate: '2026-10-06',
        shiftDate: '2026-10-07',
        confirmedDate: '2026-10-09',
        coverlineCelsius: 36.3,
        preShiftAverageCelsius: 36.27,
        postShiftAverageCelsius: 36.7,
        riseCelsius: 0.43,
        lutealLength: 22,
      },
    ],
    ovulationDates: ['2026-10-06'],
  };
  const range = { start: '2026-08-21', end: '2026-11-20' };

  it('breaks the line at gaps and period starts and marks ovulation', () => {
    const chart = buildBbtChart(bbt, ['2026-10-01', '2026-10-29'], range, BOX);
    expect(chart).not.toBeNull();
    // 10-01..10-02 | gap of 4 days | 10-06..10-07 | new cycle 10-29..10-30
    expect(chart?.segments.map((s) => s.length)).toEqual([2, 2, 2]);
    expect(chart?.ovulations).toHaveLength(1);
    expect(chart?.ovulations[0].x).toBe(chart?.points[2].x);
    expect(chart?.coverlines).toHaveLength(1);
    expect(chart?.coverlines[0].x1).toBeLessThan(chart?.coverlines[0].x2 ?? 0);
    expect(chart?.periodStarts.map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-29',
    ]);
    expect(chart?.xTicks.map((t) => t.date)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
    const ticks = chart?.yTicks.map((t) => t.value) ?? [];
    expect(ticks[0]).toBeLessThanOrEqual(36.1);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(36.8);
    // First and last day of the range map to the plot edges.
    expect(chart?.plot.left).toBe(40);
    expect(chart?.plot.right).toBe(490);
  });

  it('draws in the user unit', () => {
    const chart = buildBbtChart({ ...bbt, unit: 'F' }, [], range, BOX);
    const ticks = chart?.yTicks.map((t) => t.value) ?? [];
    expect(ticks[0]).toBeGreaterThan(96);
    expect(ticks[ticks.length - 1]).toBeLessThan(99);
  });

  it('returns null without readings', () => {
    expect(buildBbtChart({ ...bbt, readings: [] }, [], range, BOX)).toBeNull();
  });

  function labelsFor(unit: 'C' | 'F', celsius: number[]) {
    const chart = buildBbtChart(
      {
        ...bbt,
        unit,
        readings: celsius.map((value, i) => ({
          date: `2026-10-${String(i + 1).padStart(2, '0')}`,
          celsius: value,
        })),
        cycles: [],
        ovulationDates: [],
      },
      [],
      range,
      BOX
    );
    return chart?.yTicks ?? [];
  }

  it('labels every y tick with enough decimals for its step', () => {
    // 97.3-98.0 °F: ticks every 0.25 °F.
    const fahrenheit = labelsFor('F', [36.2778, 36.6667]);
    expect(fahrenheit.map((t) => t.label)).toEqual([
      '97.00',
      '97.25',
      '97.50',
      '97.75',
      '98.00',
      '98.25',
    ]);
    // A single reading: ticks every 0.05 °C, never three gridlines labelled "36.5".
    const single = labelsFor('C', [36.5]);
    expect(single.map((t) => t.label)).toEqual([
      '36.40',
      '36.45',
      '36.50',
      '36.55',
      '36.60',
    ]);
    for (const ticks of [fahrenheit, single, labelsFor('C', [36.1, 37.0])]) {
      const labels = ticks.map((t) => t.label);
      expect(labels.map(Number)).toEqual(ticks.map((t) => t.value));
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('keeps one decimal on temperature labels when the step allows', () => {
    const chart = buildBbtChart(bbt, [], range, BOX);
    expect(chart?.yTicks.map((t) => t.label)).toEqual([
      '36.0',
      '36.2',
      '36.4',
      '36.6',
      '36.8',
    ]);
  });
});

describe('formatTickLabels', () => {
  it('uses the same, sufficient number of decimals for every tick', () => {
    expect(formatTickLabels([24, 26, 28])).toEqual(['24', '26', '28']);
    expect(formatTickLabels([27, 27.5, 28])).toEqual(['27.0', '27.5', '28.0']);
    expect(formatTickLabels([36, 36.2], 1)).toEqual(['36.0', '36.2']);
    expect(formatTickLabels([36.4, 36.45], 1)).toEqual(['36.40', '36.45']);
    expect(formatTickLabels([], 1)).toEqual([]);
  });
});

describe('toSvgPoints', () => {
  it('formats points for an SVG polyline', () => {
    expect(
      toSvgPoints([
        { x: 1, y: 2.345 },
        { x: 3.1, y: 4 },
      ])
    ).toBe('1.00,2.35 3.10,4.00');
  });
});
