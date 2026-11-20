/**
 * Basal body temperature (BBT): units, validation and the "3-over-6" thermal shift.
 *
 * After ovulation, progesterone from the corpus luteum raises resting temperature by
 * roughly 0.2-0.5 °C until the next period. A sustained rise therefore confirms, after
 * the fact, that ovulation has most likely happened. It cannot predict ovulation.
 *
 * **3-over-6 rule** (Marshall J, "A field trial of the basal-body-temperature method of
 * regulating births", Lancet 1968;2:8-10; Weschler T, "Taking Charge of Your Fertility",
 * coverline method):
 * - Within one cycle, take the six recorded readings before a candidate day `d`.
 *   The highest of them is the **coverline**.
 * - A thermal shift starts on `d` when the readings on `d` and the next two recorded days
 *   are each at least 0.1 °C (about 0.2 °F) above the coverline. A reading exactly
 *   0.1 °C above counts.
 * - The three high readings must fall within four calendar days: at most one missing
 *   day in the run (for example d, d+1, d+3). A longer gap breaks the run, because an
 *   unrecorded low day could sit inside it.
 * - The earliest qualifying `d` is the shift. Ovulation is estimated as the last low
 *   recorded day before it (the last reading before `d`). Compared with ultrasound, the
 *   day estimated from BBT is often a day or two off, so it is shown as an estimate
 *   (Ecochard R et al., "Chronological aspects of ultrasonic, hormonal, and other
 *   indirect indices of ovulation", BJOG 2001;108:822-829; Su HW et al., "Detection of
 *   ovulation, a review of currently available methods", Bioeng Transl Med
 *   2017;2:238-246).
 *
 * Readings outside 35.5-37.8 °C (96-100 °F) are ignored: they are almost always typos
 * or a fever, not basal temperature (range from issue #1, in line with TCOYF charts).
 *
 * Limitations (shown to users as "estimates only"): fever, alcohol, poor sleep or
 * measuring at a different time can raise a reading; some cycles have no detectable
 * shift. BBT is not a contraceptive or fertility tool on its own.
 *
 * Pure functions only. Temperatures are processed in Celsius; convert at the edges.
 */

import type { CycleSpan } from '@/lib/cycle-history';
import { daysBetweenDateOnly } from '@/lib/date-only';

export const TEMPERATURE_UNITS = ['C', 'F'] as const;
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

/** Accepted BBT range in each unit (inclusive). 96 °F = 35.56 °C, 100 °F = 37.78 °C. */
export const BBT_RANGE = {
  C: { min: 35.5, max: 37.8 },
  F: { min: 96, max: 100 },
} as const satisfies Record<TemperatureUnit, { min: number; max: number }>;

/** Minimum rise above the coverline, in °C (≈ 0.2 °F). */
export const THERMAL_SHIFT_MIN_RISE_C = 0.1;
/** Number of earlier recorded readings that form the coverline. */
export const COVERLINE_READINGS = 6;
/** Number of consecutive recorded readings that must be above the coverline. */
export const HIGH_READINGS_REQUIRED = 3;
/** The high run may span at most this many days from first to last (one missing day). */
export const MAX_HIGH_RUN_SPAN_DAYS = 3;
/** Readings needed in a cycle before a shift can be found at all. */
export const MIN_READINGS_FOR_SHIFT =
  COVERLINE_READINGS + HIGH_READINGS_REQUIRED;

/**
 * Cervical mucus categories as used in fertility awareness charting (Billings EL et al.,
 * "Symptoms and hormonal changes accompanying ovulation", Lancet 1972;1:282-284;
 * Weschler T, "Taking Charge of Your Fertility"). Stored encrypted.
 */
export const CERVICAL_MUCUS_TYPES = [
  'dry',
  'sticky',
  'creamy',
  'egg-white',
  'watery',
] as const;
export type CervicalMucus = (typeof CERVICAL_MUCUS_TYPES)[number];

export const CERVICAL_MUCUS_LABELS: Record<CervicalMucus, string> = {
  dry: 'Dry',
  sticky: 'Sticky',
  creamy: 'Creamy',
  'egg-white': 'Egg white',
  watery: 'Watery',
};

export function isCervicalMucus(value: unknown): value is CervicalMucus {
  return (
    typeof value === 'string' &&
    (CERVICAL_MUCUS_TYPES as readonly string[]).includes(value)
  );
}

export function isTemperatureUnit(value: unknown): value is TemperatureUnit {
  return value === 'C' || value === 'F';
}

/** Falls back to Celsius for anything unexpected (the column is a plain string). */
export function parseTemperatureUnit(value: unknown): TemperatureUnit {
  return isTemperatureUnit(value) ? value : 'C';
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

/** True when `value` (in `unit`) is a plausible basal temperature. */
export function isBbtInRange(value: number, unit: TemperatureUnit): boolean {
  const range = BBT_RANGE[unit];
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

/** Canonical stored value: Celsius rounded to 2 decimals. */
export function toStoredCelsius(value: number, unit: TemperatureUnit): number {
  return roundTo(unit === 'F' ? fahrenheitToCelsius(value) : value, 2);
}

/** Stored Celsius value shown in the user's unit, rounded to 2 decimals. */
export function fromStoredCelsius(
  celsius: number,
  unit: TemperatureUnit
): number {
  return roundTo(unit === 'F' ? celsiusToFahrenheit(celsius) : celsius, 2);
}

export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit
): string {
  return `${fromStoredCelsius(celsius, unit).toFixed(2)} °${unit}`;
}

export type BbtReading = {
  /** `YYYY-MM-DD` */
  date: string;
  celsius: number;
};

export type ThermalShiftDetected = {
  detected: true;
  /** Ovulation is confirmed by the temperature pattern (still an estimate of the day). */
  bioVerified: true;
  /** Estimated ovulation day: the last low reading before the rise. */
  ovulationDate: string;
  /** First of the three high readings. */
  shiftDate: string;
  /** Third high reading: the day the shift became confirmed. */
  confirmedDate: string;
  /** Highest of the six readings before the shift, in °C. */
  coverlineCelsius: number;
  validReadings: number;
};

export type ThermalShiftNotDetected = {
  detected: false;
  bioVerified: false;
  /** Too few readings to apply the rule, or enough readings but no shift (yet). */
  reason: 'insufficient-readings' | 'no-shift';
  validReadings: number;
};

export type ThermalShiftResult = ThermalShiftDetected | ThermalShiftNotDetected;

/** Temperatures compared in hundredths of a degree to avoid float noise (36.6 - 36.5). */
function hundredths(celsius: number): number {
  return Math.round(celsius * 100);
}

/**
 * Valid readings sorted by date, one per day. If a day appears twice, the later entry
 * in the input wins (the database has one reading per day, so this is defensive).
 */
export function cleanBbtReadings(
  readings: readonly BbtReading[]
): BbtReading[] {
  const byDate = new Map<string, BbtReading>();
  for (const reading of readings) {
    if (isBbtInRange(reading.celsius, 'C')) {
      byDate.set(reading.date, reading);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Applies the 3-over-6 rule to the readings of one cycle.
 * Pass only readings from the same cycle (see `analyzeBbtByCycle`).
 */
export function detectThermalShift(
  readings: readonly BbtReading[]
): ThermalShiftResult {
  const valid = cleanBbtReadings(readings);
  if (valid.length < MIN_READINGS_FOR_SHIFT) {
    return {
      detected: false,
      bioVerified: false,
      reason: 'insufficient-readings',
      validReadings: valid.length,
    };
  }

  const minRise = hundredths(THERMAL_SHIFT_MIN_RISE_C);
  for (
    let i = COVERLINE_READINGS;
    i + HIGH_READINGS_REQUIRED - 1 < valid.length;
    i++
  ) {
    const previous = valid.slice(i - COVERLINE_READINGS, i);
    const coverline = Math.max(...previous.map((r) => hundredths(r.celsius)));
    const run = valid.slice(i, i + HIGH_READINGS_REQUIRED);
    const span = daysBetweenDateOnly(run[0].date, run[run.length - 1].date);
    if (span > MAX_HIGH_RUN_SPAN_DAYS) continue;
    if (run.every((r) => hundredths(r.celsius) - coverline >= minRise)) {
      return {
        detected: true,
        bioVerified: true,
        ovulationDate: valid[i - 1].date,
        shiftDate: run[0].date,
        confirmedDate: run[run.length - 1].date,
        coverlineCelsius: coverline / 100,
        validReadings: valid.length,
      };
    }
  }

  return {
    detected: false,
    bioVerified: false,
    reason: 'no-shift',
    validReadings: valid.length,
  };
}

export type CycleBbtAnalysis = {
  cycle: CycleSpan;
  /** Valid readings of this cycle, oldest first. */
  readings: BbtReading[];
  shift: ThermalShiftResult;
};

/**
 * Splits readings by cycle and runs the 3-over-6 rule on each, so a rise in one cycle
 * never uses readings from another. Readings before the first logged period start
 * belong to no cycle and are skipped.
 */
export function analyzeBbtByCycle(
  cycles: readonly CycleSpan[],
  readings: readonly BbtReading[]
): CycleBbtAnalysis[] {
  const valid = cleanBbtReadings(readings);
  return cycles.map((cycle) => {
    const inCycle = valid.filter(
      (r) =>
        r.date >= cycle.start && (cycle.end === null || r.date <= cycle.end)
    );
    return { cycle, readings: inCycle, shift: detectThermalShift(inCycle) };
  });
}
