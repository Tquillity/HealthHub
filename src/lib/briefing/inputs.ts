import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { decryptArray } from '@/lib/encryption';
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  toDateOnlyString,
} from '@/lib/date-only';
import {
  buildCycleHistory,
  findCycleForDate,
  normalizePeriodStarts,
} from '@/lib/cycle-history';
import { isJournalCheckIn } from '@/lib/clinical-report';
import {
  ENERGY_SLOTS,
  ENERGY_SLOT_FIELDS,
} from '@/lib/circadian-recommendations';
import { RECOVERY_HISTORY_DAYS } from '@/lib/cycle-insights';
import { listPeriodStartDates } from '@/lib/period-starts';
import { BASELINE_WINDOW_DAYS, BRIEFING_WINDOW_DAYS } from './signals';
import type {
  BriefingCycleData,
  BriefingEngineInput,
  BriefingJournalDay,
  BriefingSource,
  BriefingVitalsData,
} from './types';

/**
 * Loads the briefing's journal, cycle and vitals inputs: what its signals (signals.ts) and
 * the take-it-easy check (rules.ts `isTakeItEasyDay`) are computed from. lib/briefing/data
 * builds the briefing from them, and lib/easy-day gives the circadian card the same
 * take-it-easy answer from the same inputs. The privacy rules are in data.ts.
 */

export function dateRange(from: string, to: string) {
  return { gte: dateOnlyToUtcDate(from), lte: dateOnlyToUtcDate(to) };
}

export const briefingUserSelect = {
  timezone: true,
  focusPreference: true,
  enableCycleTracking: true,
  cycleLength: true,
  lastPeriodDate: true,
  trackVitals: true,
  enableCircadianInsights: true,
  briefingFrequency: true,
  briefingSources: true,
  briefingDetail: true,
} as const;

export type BriefingUser = Prisma.UserGetPayload<{
  select: typeof briefingUserSelect;
}>;

async function loadJournalDays(
  userId: string,
  from: string,
  to: string,
  /** Also note the days with a time-of-day energy check-in (circadian insights on). */
  timeOfDayEnergy: boolean
): Promise<BriefingJournalDay[]> {
  const rows = await prisma.journalEntry.findMany({
    where: { userId, date: dateRange(from, to) },
    select: {
      date: true,
      mood: true,
      energy: true,
      sleepHours: true,
      symptomsPhysical: true,
      symptomsMental: true,
      // Read only to tell a journal check-in from a quick-log-only day; never decrypted.
      notes: true,
      gratitudeNotes: true,
      goalsNotes: true,
      symptomsNotes: true,
      tags: true,
      gratitudeEntries: true,
      goalsAchieved: true,
      goalsProgress: true,
      energyMorning: timeOfDayEnergy,
      energyAfternoon: timeOfDayEnergy,
      energyEvening: timeOfDayEnergy,
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => {
    const checkIn = isJournalCheckIn(row);
    const ratings = timeOfDayEnergy
      ? ENERGY_SLOTS.flatMap((slot) => {
          const rating = row[ENERGY_SLOT_FIELDS[slot]];
          return typeof rating === 'number' ? [rating] : [];
        })
      : [];
    return {
      date: toDateOnlyString(row.date),
      mood: row.mood,
      // Same 1-10 scale: a day without a daily rating takes its check-ins by time of day.
      energy:
        row.energy ??
        (ratings.length > 0
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
          : null),
      sleepHours: row.sleepHours,
      symptoms: checkIn
        ? [
            ...decryptArray(row.symptomsPhysical),
            ...decryptArray(row.symptomsMental),
          ]
        : [],
      checkIn,
      energyCheckIn: ratings.length > 0,
    };
  });
}

/** Logged period starts with User.lastPeriodDate merged in, as the Vitals card reads them. */
async function loadPeriodStarts(
  userId: string,
  user: BriefingUser
): Promise<string[]> {
  return normalizePeriodStarts(
    await listPeriodStartDates(userId),
    // Safety net for a start saved by code that predates the history table.
    user.lastPeriodDate ? toDateOnlyString(user.lastPeriodDate) : null
  );
}

async function loadCycleData(
  userId: string,
  user: BriefingUser,
  periodStarts: string[],
  from: string,
  to: string
): Promise<BriefingCycleData> {
  // The thermal shift of the cycle that contains `from` needs its earlier readings.
  const first = findCycleForDate(buildCycleHistory(periodStarts), from);
  const bbtFrom = first && first.start < from ? first.start : from;
  const readings = await prisma.journalEntry.findMany({
    where: { userId, date: dateRange(bbtFrom, to), temperature: { not: null } },
    select: { date: true, temperature: true },
    orderBy: { date: 'asc' },
  });
  return {
    typicalCycleLength: user.cycleLength,
    periodStarts,
    bbtReadings: readings.flatMap((row) =>
      row.temperature === null
        ? []
        : [{ date: toDateOnlyString(row.date), celsius: row.temperature }]
    ),
  };
}

/**
 * Recovery score inputs as the dashboard Vitals card loads them (lib/daily-metrics
 * `loadVitalsCardData`): every value the score uses, sleep hours included, from far
 * enough back that every scored day has a full baseline, and the period starts when
 * cycle tracking is on. Temperature is not part of the score, so it is not read.
 */
async function loadVitalsData(
  userId: string,
  user: BriefingUser,
  today: string,
  periodStarts: string[] | null
): Promise<BriefingVitalsData> {
  const rows = await prisma.journalEntry.findMany({
    where: {
      userId,
      date: dateRange(addDaysToDateOnly(today, -RECOVERY_HISTORY_DAYS), today),
    },
    select: {
      date: true,
      restingHeartRate: true,
      heartRateVariability: true,
      sleepQuality: true,
      sleepHours: true,
    },
    orderBy: { date: 'asc' },
  });
  return {
    rows: rows.map((row) => ({
      ...row,
      date: toDateOnlyString(row.date),
      temperature: null,
    })),
    periodStarts,
    typicalCycleLength: user.cycleLength,
  };
}

export type SignalInputs = Pick<
  BriefingEngineInput,
  'journal' | 'cycle' | 'vitals'
>;

/**
 * The journal, cycle and vitals inputs for the briefing day `date`, from only the sources
 * the user lets the briefing read: vitals also need the vitals opt-in and the cycle source
 * needs cycle tracking (see the notes in data.ts on the recovery score).
 */
export async function loadSignalInputs(
  userId: string,
  user: BriefingUser,
  sources: ReadonlySet<BriefingSource>,
  date: string
): Promise<SignalInputs> {
  // Window plus the baseline history before it.
  const from = addDaysToDateOnly(
    date,
    -(BRIEFING_WINDOW_DAYS - 1 + BASELINE_WINDOW_DAYS)
  );
  const cycleTracked = user.enableCycleTracking && user.lastPeriodDate !== null;
  const useCycle = sources.has('cycle') && cycleTracked;
  const useVitals = sources.has('vitals') && user.trackVitals;
  // Period starts feed the cycle source and, as on the Vitals card, the recovery score's
  // phase baselines (see the module notes in data.ts).
  const periodStarts =
    useCycle || (useVitals && cycleTracked)
      ? await loadPeriodStarts(userId, user)
      : null;

  const [journal, cycle, vitals] = await Promise.all([
    sources.has('journal')
      ? loadJournalDays(userId, from, date, user.enableCircadianInsights)
      : null,
    useCycle && periodStarts
      ? loadCycleData(userId, user, periodStarts, from, date)
      : null,
    useVitals
      ? loadVitalsData(userId, user, date, cycleTracked ? periodStarts : null)
      : null,
  ]);
  return { journal, cycle, vitals };
}
