import { format } from 'date-fns';
import { fromStoredCelsius, type TemperatureUnit } from '@/lib/bbt';
import { dateOnlyToLocalDate } from '@/lib/date-only';

/**
 * Display helpers shared by the clinical summary PDF and its export dialog.
 * Date-only keys are formatted as local calendar days (see lib/date-only).
 */

export const EMPTY_VALUE = '–';

/** `2026-11-20` → "20 Nov 2026" (or another date-fns pattern). */
export function formatDateKey(key: string, pattern = 'd MMM yyyy'): string {
  return format(dateOnlyToLocalDate(key), pattern);
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDateKey(start)} – ${formatDateKey(end)}`;
}

/** A number with fixed decimals and an optional unit, or "–" when missing. */
export function formatValue(
  value: number | null | undefined,
  decimals = 1,
  unit = ''
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_VALUE;
  }
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

/** Stored °C shown in the user's unit with 2 decimals, e.g. "97.52 °F". */
export function formatReportTemperature(
  celsius: number | null | undefined,
  unit: TemperatureUnit
): string {
  if (celsius === null || celsius === undefined) return EMPTY_VALUE;
  return `${fromStoredCelsius(celsius, unit).toFixed(2)} °${unit}`;
}

/** A temperature difference (°C) in the user's unit: 0.40 °C is 0.72 °F. */
export function formatTemperatureDelta(
  celsius: number | null | undefined,
  unit: TemperatureUnit
): string {
  if (celsius === null || celsius === undefined) return EMPTY_VALUE;
  const value = unit === 'F' ? (celsius * 9) / 5 : celsius;
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} °${unit}`;
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
