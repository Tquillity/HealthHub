import { format } from 'date-fns';
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  roundTo,
  type TemperatureUnit,
} from '@/lib/bbt';

/**
 * Helpers for the quick-log forms (BBT on the cycle page, vitals on the dashboard).
 * The server validates every value again; these only turn typed text into numbers.
 */

/**
 * Typed number → value to send. Empty clears the stored value (`null`); text that is
 * not a number gives `undefined`. Accepts a comma as decimal separator ("36,45").
 */
export function parseDecimalInput(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

/** Like `parseDecimalInput`, but whole numbers only (heart rate, sleep quality). */
export function parseWholeNumberInput(text: string): number | null | undefined {
  const value = parseDecimalInput(text);
  if (value === null || value === undefined) return value;
  return Number.isInteger(value) ? value : undefined;
}

/** Stored number → input text ('' when unset). */
export function numberToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Converts a typed temperature when the unit toggle changes; other text is kept. */
export function convertTemperatureInput(
  text: string,
  from: TemperatureUnit,
  to: TemperatureUnit
): string {
  const value = parseDecimalInput(text);
  if (from === to || value === null || value === undefined) return text;
  const converted =
    to === 'F' ? celsiusToFahrenheit(value) : fahrenheitToCelsius(value);
  return String(roundTo(converted, 2));
}

/** The viewer's local calendar day as `YYYY-MM-DD` (call in event handlers, not render). */
export function localDateKey(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}
