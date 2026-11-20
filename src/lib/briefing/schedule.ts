import {
  addDaysToDateOnly,
  daysBetweenDateOnly,
  dateOnlyToUtcDate,
} from '@/lib/date-only';
import type { BriefingFrequency } from './types';

/**
 * When the briefing is shown, and for which calendar day.
 *
 * The briefing day is the user's own calendar day in their profile timezone
 * (User.timezone, an IANA name such as "Europe/Stockholm"), so a weekly briefing
 * arrives on their Monday, not the server's. The profile accepts free text, so an
 * unknown timezone falls back to UTC instead of failing.
 */

/** Weekly briefings are shown on this weekday (0 = Sunday … 6 = Saturday): Monday. */
export const WEEKLY_BRIEFING_WEEKDAY = 1;

export const FALLBACK_TIME_ZONE = 'UTC';

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day (`YYYY-MM-DD`) of `instant` in `timeZone` (UTC when it is unknown). */
export function dateKeyInTimeZone(instant: Date, timeZone: string): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Weekday of a `YYYY-MM-DD` day (0 = Sunday … 6 = Saturday). */
export function weekdayOfDateKey(dateKey: string): number {
  return dateOnlyToUtcDate(dateKey).getUTCDay();
}

/** Whether a briefing is due on `dateKey` (the user's calendar day). */
export function isBriefingDue(
  frequency: BriefingFrequency,
  dateKey: string
): boolean {
  switch (frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return weekdayOfDateKey(dateKey) === WEEKLY_BRIEFING_WEEKDAY;
    case 'never':
      return false;
  }
}

/** The next day a briefing is due on or after `dateKey`, or null for "never". */
export function nextBriefingDate(
  frequency: BriefingFrequency,
  dateKey: string
): string | null {
  if (frequency === 'never') return null;
  for (let offset = 0; offset < 7; offset++) {
    const day = addDaysToDateOnly(dateKey, offset);
    if (isBriefingDue(frequency, day)) return day;
  }
  return null;
}

/**
 * The day a client asks about, if it is within one day of the user's day on the server
 * (the device may be in another timezone than the profile says); otherwise null.
 */
export function acceptBriefingDate(
  requested: string,
  serverToday: string
): string | null {
  return Math.abs(daysBetweenDateOnly(serverToday, requested)) <= 1
    ? requested
    : null;
}
