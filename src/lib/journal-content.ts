import type { JournalEntry } from '@prisma/client';

/**
 * What counts as journal data on a JournalEntry, beside the time-of-day energy check-ins
 * (circadian insights). Safe to import from client components (no database).
 *
 * Every content field of JournalEntry is listed here; circadian-data.test.ts checks the
 * lists against the schema, so a new field must be added before it can be lost.
 */

/** Fields that are empty when null. */
export const JOURNAL_VALUE_FIELDS = [
  'mood',
  'energy',
  'sleepHours',
  'notes',
  'gratitudeNotes',
  'goalsNotes',
  'symptomsNotes',
  'temperature',
  'cervicalMucus',
  'restingHeartRate',
  'heartRateVariability',
  'sleepQuality',
] as const satisfies readonly (keyof JournalEntry)[];

/** List fields: empty when they hold no items. */
export const JOURNAL_LIST_FIELDS = [
  'tags',
  'gratitudeEntries',
  'goalsAchieved',
  'goalsProgress',
  'symptomsPhysical',
  'symptomsMental',
] as const satisfies readonly (keyof JournalEntry)[];

/** The time-of-day energy check-ins (morning, afternoon, evening). */
export const TIME_OF_DAY_ENERGY_COLUMNS = [
  'energyMorning',
  'energyAfternoon',
  'energyEvening',
] as const satisfies readonly (keyof JournalEntry)[];

export type JournalDayContent = Pick<
  JournalEntry,
  | (typeof JOURNAL_VALUE_FIELDS)[number]
  | (typeof JOURNAL_LIST_FIELDS)[number]
  | (typeof TIME_OF_DAY_ENERGY_COLUMNS)[number]
>;

const present = (value: unknown) => value !== null && value !== undefined;

/** The day holds journal data other than its time-of-day check-ins. */
export function hasJournalDataBesideCheckIns(day: JournalDayContent): boolean {
  return (
    JOURNAL_VALUE_FIELDS.some((field) => present(day[field])) ||
    JOURNAL_LIST_FIELDS.some((field) => (day[field]?.length ?? 0) > 0)
  );
}

/**
 * The day holds nothing but time-of-day check-ins: the dashboard's "How is your energy
 * right now?" created it, or only those fields were filled in on the journal form.
 */
export function isCheckInOnlyDay(day: JournalDayContent): boolean {
  return (
    TIME_OF_DAY_ENERGY_COLUMNS.some((field) => present(day[field])) &&
    !hasJournalDataBesideCheckIns(day)
  );
}
