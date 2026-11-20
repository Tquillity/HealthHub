import { describe, expect, it } from 'vitest';
import {
  analyzeBbtByCycle,
  BBT_RANGE,
  celsiusToFahrenheit,
  cleanBbtReadings,
  detectThermalShift,
  fahrenheitToCelsius,
  formatTemperature,
  fromStoredCelsius,
  isBbtInRange,
  isCervicalMucus,
  parseTemperatureUnit,
  toStoredCelsius,
  type BbtReading,
} from '@/lib/bbt';
import { buildCycleHistory } from '@/lib/cycle-history';
import { addDaysToDateOnly } from '@/lib/date-only';

/** One reading per day from `start`; `null` leaves that day unrecorded. */
function series(start: string, values: (number | null)[]): BbtReading[] {
  return values.flatMap((celsius, offset) =>
    celsius === null
      ? []
      : [{ date: addDaysToDateOnly(start, offset), celsius }]
  );
}

const LOW = [36.3, 36.2, 36.4, 36.3, 36.35, 36.4]; // coverline 36.40

describe('unit conversion and validation', () => {
  it('converts between Celsius and Fahrenheit', () => {
    expect(celsiusToFahrenheit(37)).toBeCloseTo(98.6, 10);
    expect(fahrenheitToCelsius(98.6)).toBeCloseTo(37, 10);
    expect(celsiusToFahrenheit(36.5)).toBeCloseTo(97.7, 10);
  });

  it('stores Celsius rounded to 2 decimals', () => {
    expect(toStoredCelsius(36.456, 'C')).toBe(36.46);
    expect(toStoredCelsius(97.7, 'F')).toBe(36.5);
    expect(toStoredCelsius(96, 'F')).toBe(35.56);
    expect(toStoredCelsius(100, 'F')).toBe(37.78);
  });

  it('round-trips Fahrenheit readings to 2 decimals', () => {
    for (const f of [96, 97.72, 98.06, 99.5, 100]) {
      expect(fromStoredCelsius(toStoredCelsius(f, 'F'), 'F')).toBeCloseTo(f, 1);
    }
    expect(fromStoredCelsius(36.5, 'F')).toBe(97.7);
    expect(fromStoredCelsius(36.5, 'C')).toBe(36.5);
  });

  it('accepts the documented range inclusively in both units', () => {
    expect(isBbtInRange(BBT_RANGE.C.min, 'C')).toBe(true);
    expect(isBbtInRange(BBT_RANGE.C.max, 'C')).toBe(true);
    expect(isBbtInRange(35.49, 'C')).toBe(false);
    expect(isBbtInRange(37.81, 'C')).toBe(false);
    expect(isBbtInRange(96, 'F')).toBe(true);
    expect(isBbtInRange(100, 'F')).toBe(true);
    expect(isBbtInRange(95.9, 'F')).toBe(false);
    expect(isBbtInRange(100.1, 'F')).toBe(false);
    // A Celsius value is not a valid Fahrenheit reading and vice versa.
    expect(isBbtInRange(36.5, 'F')).toBe(false);
    expect(isBbtInRange(97.7, 'C')).toBe(false);
    expect(isBbtInRange(Number.NaN, 'C')).toBe(false);
  });

  it('formats in the requested unit', () => {
    expect(formatTemperature(36.5, 'C')).toBe('36.50 °C');
    expect(formatTemperature(36.5, 'F')).toBe('97.70 °F');
  });

  it('parses units and cervical mucus values defensively', () => {
    expect(parseTemperatureUnit('F')).toBe('F');
    expect(parseTemperatureUnit('K')).toBe('C');
    expect(parseTemperatureUnit(null)).toBe('C');
    expect(isCervicalMucus('egg-white')).toBe(true);
    expect(isCervicalMucus('eggwhite')).toBe(false);
  });
});

describe('cleanBbtReadings', () => {
  it('drops out-of-range readings, sorts by date and keeps one per day', () => {
    expect(
      cleanBbtReadings([
        { date: '2026-03-03', celsius: 36.4 },
        { date: '2026-03-01', celsius: 39.2 },
        { date: '2026-03-02', celsius: 36.3 },
        { date: '2026-03-02', celsius: 36.35 },
      ])
    ).toEqual([
      { date: '2026-03-02', celsius: 36.35 },
      { date: '2026-03-03', celsius: 36.4 },
    ]);
  });
});

describe('detectThermalShift (3-over-6)', () => {
  it('needs at least nine valid readings', () => {
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.6, 36.7])
    );
    expect(result).toEqual({
      detected: false,
      bioVerified: false,
      reason: 'insufficient-readings',
      validReadings: 8,
    });
  });

  it('detects a classic shift and estimates ovulation on the last low day', () => {
    const readings = series('2026-03-01', [
      36.2,
      36.25,
      36.3,
      ...LOW,
      36.6,
      36.65,
      36.7,
      36.7,
    ]);
    const result = detectThermalShift(readings);
    expect(result).toEqual({
      detected: true,
      bioVerified: true,
      ovulationDate: '2026-03-09', // last low reading (day 9)
      shiftDate: '2026-03-10',
      confirmedDate: '2026-03-12',
      coverlineCelsius: 36.4,
      validReadings: 13,
    });
  });

  it('counts readings exactly 0.1 °C above the coverline', () => {
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.5, 36.5, 36.5])
    );
    expect(result).toMatchObject({
      detected: true,
      coverlineCelsius: 36.4,
      shiftDate: '2026-03-07',
      ovulationDate: '2026-03-06',
    });
  });

  it('does not count readings just below the threshold', () => {
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.5, 36.49, 36.6])
    );
    expect(result).toMatchObject({ detected: false, reason: 'no-shift' });
  });

  it('works on Fahrenheit input converted to stored Celsius (≈0.2 °F rise)', () => {
    const fahrenheit = [97.3, 97.2, 97.5, 97.4, 97.3, 97.5, 97.7, 97.8, 97.9];
    const readings = series(
      '2026-03-01',
      fahrenheit.map((f) => toStoredCelsius(f, 'F'))
    );
    // Coverline 97.5 °F = 36.39 °C; 97.7 °F = 36.5 °C is 0.11 °C above it.
    expect(detectThermalShift(readings)).toMatchObject({
      detected: true,
      coverlineCelsius: 36.39,
      shiftDate: '2026-03-07',
    });
  });

  it('reports no shift for a flat (anovulatory-looking) cycle', () => {
    const flat = Array.from({ length: 28 }, (_, i) => 36.3 + (i % 3) * 0.05);
    expect(detectThermalShift(series('2026-03-01', flat))).toEqual({
      detected: false,
      bioVerified: false,
      reason: 'no-shift',
      validReadings: 28,
    });
  });

  it('needs three high readings, not two', () => {
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.6, 36.6, 36.3, 36.4, 36.3])
    );
    expect(result.detected).toBe(false);
  });

  it('allows one missing day inside the high run', () => {
    // High readings on days 7, 8 and 10 (day 9 not recorded): span of 3 days.
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.6, 36.65, null, 36.7])
    );
    expect(result).toMatchObject({
      detected: true,
      shiftDate: '2026-03-07',
      confirmedDate: '2026-03-10',
    });
  });

  it('rejects a high run with two missing days', () => {
    // Days 7, 8, (9, 10 missing), 11: span of 4 days, so this run does not count.
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 36.6, 36.65, null, null, 36.7])
    );
    expect(result).toMatchObject({ detected: false, reason: 'no-shift' });
  });

  it('uses the previous six recorded readings even across gaps', () => {
    // Gaps among the low readings do not matter: the six recorded ones form the coverline.
    const result = detectThermalShift(
      series('2026-03-01', [
        36.3,
        null,
        36.2,
        null,
        36.4,
        36.3,
        null,
        36.35,
        36.4,
        36.6,
        36.6,
        36.7,
      ])
    );
    expect(result).toMatchObject({
      detected: true,
      ovulationDate: '2026-03-09',
      shiftDate: '2026-03-10',
      coverlineCelsius: 36.4,
    });
  });

  it('ignores out-of-range readings (typos, fever) instead of treating them as highs', () => {
    const result = detectThermalShift(
      series('2026-03-01', [...LOW, 38.5, 39, 38.9])
    );
    expect(result).toMatchObject({
      detected: false,
      reason: 'insufficient-readings',
      validReadings: 6,
    });
  });

  it('a single early spike raises the coverline and delays the shift', () => {
    const result = detectThermalShift(
      series('2026-03-01', [
        36.3,
        36.7, // spike, part of the coverline until it scrolls out
        36.3,
        36.3,
        36.35,
        36.3,
        36.3,
        36.6,
        36.75,
        36.8,
        36.8,
      ])
    );
    // Day 8's coverline (days 2-7) includes the 36.7 spike, so 36.6 is not high enough.
    // From day 9 the spike has left the six-reading window (coverline 36.6 from day 8).
    expect(result).toMatchObject({
      detected: true,
      shiftDate: '2026-03-09',
      ovulationDate: '2026-03-08',
    });
  });

  it('is order-independent', () => {
    const readings = series('2026-03-01', [...LOW, 36.6, 36.6, 36.6]);
    expect(detectThermalShift([...readings].reverse())).toEqual(
      detectThermalShift(readings)
    );
  });
});

describe('analyzeBbtByCycle', () => {
  it('analyses each cycle separately and never mixes readings across cycles', () => {
    const cycles = buildCycleHistory([
      '2026-03-01',
      '2026-03-29',
      '2026-04-26',
    ]);
    const readings = [
      // Before the first logged start: ignored.
      ...series('2026-02-20', [37.2, 37.2, 37.2]),
      // Cycle 1: shift on day 13.
      ...series(
        '2026-03-01',
        [
          36.3, 36.2, 36.25, 36.3, 36.2, 36.3, 36.25, 36.2, 36.3, 36.25, 36.3,
          36.3, 36.6, 36.65, 36.7, 36.7,
        ]
      ),
      // Cycle 2: only high readings late in the cycle, nothing low before them.
      ...series('2026-04-20', [36.7, 36.7, 36.75, 36.7]),
      // Cycle 3 (open): low then high.
      ...series('2026-04-26', [...LOW, 36.55, 36.6, 36.6]),
    ];

    const [first, second, third] = analyzeBbtByCycle(cycles, readings);

    expect(first.readings).toHaveLength(16);
    expect(first.shift).toMatchObject({
      detected: true,
      ovulationDate: '2026-03-12',
      shiftDate: '2026-03-13',
    });

    // Cycle 1's low readings must not form a coverline for cycle 2.
    expect(second.readings).toHaveLength(4);
    expect(second.shift).toMatchObject({
      detected: false,
      reason: 'insufficient-readings',
    });

    expect(third.cycle.isOpen).toBe(true);
    expect(third.shift).toMatchObject({
      detected: true,
      shiftDate: '2026-05-02',
    });
  });

  it('returns no analyses without cycles', () => {
    expect(
      analyzeBbtByCycle([], series('2026-03-01', [...LOW, 36.6, 36.6, 36.6]))
    ).toEqual([]);
  });
});
