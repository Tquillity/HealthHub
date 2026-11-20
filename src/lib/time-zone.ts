/**
 * Small, pure helpers for "what time / which day is it for this person". The profile stores a
 * free-text IANA time zone (default "UTC"), so every helper falls back to UTC for anything
 * the runtime does not recognize instead of throwing. Partner sync fills in the device's zone
 * while the profile still has the default (timeZoneToAdopt), so a person's "today" matches the
 * day their journal entries are filed under.
 */

export const DEFAULT_TIME_ZONE = 'UTC';

/** The time zone itself when the runtime recognizes it, otherwise UTC. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/** Hour of the day (0-23) at `now` in `timeZone`. */
export function getLocalHour(now: Date, timeZone: string): number {
  const hour = Number(localParts(now, timeZone).hour);
  // Some runtimes print midnight as "24" even with h23.
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Calendar day (`YYYY-MM-DD`) at `now` in `timeZone`, the key journal entries are stored by. */
export function getLocalDateKey(now: Date, timeZone: string): string {
  const { year, month, day } = localParts(now, timeZone);
  return `${year}-${month}-${day}`;
}

/**
 * True when the stored zone says nothing about where the person is: empty, not a zone the
 * runtime knows, or UTC. UTC is the column default, which most people never change, so a stored
 * UTC counts as never set (someone who really lives on UTC is treated the same way).
 */
export function isUnsetTimeZone(stored: string | null | undefined): boolean {
  return !stored || stored === DEFAULT_TIME_ZONE || resolveTimeZone(stored) !== stored;
}

/**
 * The device's time zone, when it should replace the one in the profile: the stored zone is
 * still unset (isUnsetTimeZone) and the device reports a zone the runtime knows. A zone the
 * person typed in Profile is never replaced. Null when nothing should change.
 */
export function timeZoneToAdopt(
  stored: string | null | undefined,
  device: string | null | undefined
): string | null {
  if (!device || resolveTimeZone(device) !== device) return null;
  if (!isUnsetTimeZone(stored) || device === stored) return null;
  return device;
}
