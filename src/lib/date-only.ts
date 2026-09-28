import { z } from 'zod';

/**
 * Date-only values ("YYYY-MM-DD") for calendar days that have no time of day:
 * journal entries, meal plan start dates, period dates.
 *
 * They are stored as UTC midnight (`Date.UTC(y, m - 1, d)`), which matches the rows the
 * UTC production server has always written. Build the key on the client from the local
 * calendar date (date-fns `format(date, 'yyyy-MM-dd')`) and read it back with
 * `toDateOnlyString`, never with local-time getters or `toISOString()` on a local Date.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

type DateParts = { year: number; month: number; day: number };

function parseParts(value: string): DateParts | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Date.UTC maps years 0-99 to 1900-1999, so keep to realistic years.
  if (year < 1900 || month < 1 || month > 12 || day < 1) return null;
  // Day 0 of the next month is the last day of this month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return { year, month, day };
}

/** True for a real calendar date in strict `YYYY-MM-DD` form (rejects 2026-02-30). */
export function isDateOnlyString(value: string): boolean {
  return parseParts(value) !== null;
}

/** Zod schema for a strict `YYYY-MM-DD` calendar date string. */
export const DateOnlyStringSchema = z.string().refine(isDateOnlyString, {
  message: 'Date must be a valid YYYY-MM-DD date',
});

/** `YYYY-MM-DD` → UTC-midnight Date. Throws on anything else. */
export function dateOnlyToUtcDate(value: string): Date {
  const parts = parseParts(value);
  if (!parts) {
    throw new Error(`Invalid date-only string: ${value}`);
  }
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

/** Stored UTC-midnight Date → `YYYY-MM-DD` (uses UTC components, so no timezone shift). */
export function toDateOnlyString(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` → local-midnight Date for display with date-fns `format`
 * (a UTC-midnight Date would show the previous day west of UTC).
 */
export function dateOnlyToLocalDate(value: string): Date {
  const parts = parseParts(value);
  if (!parts) {
    throw new Error(`Invalid date-only string: ${value}`);
  }
  return new Date(parts.year, parts.month - 1, parts.day);
}

/**
 * Strict `YYYY-MM` month key → UTC range `[start, end)` covering that month's
 * UTC-midnight date-only values. Returns null for anything else.
 */
export function parseMonthKey(value: string | null | undefined): {
  year: number;
  month: number;
  start: Date;
  end: Date;
} | null {
  if (!value) return null;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return null;
  return {
    year,
    month,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}
