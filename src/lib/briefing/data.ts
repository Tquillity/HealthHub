import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { resolveActiveMembership } from '@/lib/active-organization';
import { decrypt, decryptArray, encrypt } from '@/lib/encryption';
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
import { RECOVERY_HISTORY_DAYS } from '@/lib/cycle-insights';
import { listPeriodStartDates } from '@/lib/period-starts';
import type { FocusPreference } from '@/types/cycle';
import type {
  BriefingPreferencesInput,
  DismissSuggestionInput,
  RateSuggestionInput,
} from '@/lib/validation/briefing-schemas';
import { buildDailyBriefing } from './engine';
import { FEEDBACK_LOOKBACK_DAYS } from './rank';
import {
  acceptBriefingDate,
  dateKeyInTimeZone,
  FALLBACK_TIME_ZONE,
  isBriefingDue,
  isValidTimeZone,
  nextBriefingDate,
} from './schedule';
import { BASELINE_WINDOW_DAYS, BRIEFING_WINDOW_DAYS } from './signals';
import {
  BRIEFING_CARD_KEY,
  BRIEFING_FEEDBACK_ACTIONS,
  BRIEFING_SOURCES,
  isSuggestionKey,
  parseBriefingPreferences,
  type BriefingCycleData,
  type BriefingFeedbackAction,
  type BriefingFeedbackEntry,
  type BriefingJournalDay,
  type BriefingMealData,
  type BriefingPreferences,
  type BriefingVitalsData,
  type DailyBriefing,
} from './types';

/**
 * Daily briefing data layer: loads exactly the data the user lets the briefing read,
 * runs the pure engine, and stores feedback and preferences.
 *
 * - Only the session user's own rows are read. Meal plans come from the space the user has
 *   open (checked against their memberships), never from a household they are not in.
 * - A source the user switched off is never queried; vitals also need the vitals opt-in
 *   and the cycle source needs cycle tracking. One exception, by design: the recovery
 *   score (vitals source) is the dashboard Vitals card's score, so it is computed from the
 *   card's inputs, which include the journal's sleep hours and, with cycle tracking on,
 *   the logged period starts for its phase baselines, even when the journal or cycle
 *   source is off. Otherwise the briefing would show a second, different "recovery today"
 *   on the same page. Only the score is used from them, and the wording names no phase
 *   unless the cycle source is on.
 * - Symptoms are decrypted in memory only to count them; nothing is stored or logged.
 * - Feedback suggestion keys are validated against the known keys, then encrypted: a key
 *   with a date says things like "more symptoms than usual that day".
 */

/** The day sent by the client is not the user's current briefing day (±1 day). */
export class BriefingDateError extends Error {
  constructor() {
    super("This briefing is out of date. Refresh the page to see today's.");
  }
}

type Db = Prisma.TransactionClient;

const FocusSchema = z.enum(['hormonal', 'workout', 'both']);

function parseFocus(value: string | null): FocusPreference {
  const parsed = FocusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'both';
}

function dateRange(from: string, to: string) {
  return { gte: dateOnlyToUtcDate(from), lte: dateOnlyToUtcDate(to) };
}

const briefingUserSelect = {
  timezone: true,
  focusPreference: true,
  enableCycleTracking: true,
  cycleLength: true,
  lastPeriodDate: true,
  trackVitals: true,
  briefingFrequency: true,
  briefingSources: true,
  briefingDetail: true,
} as const;

type BriefingUser = Prisma.UserGetPayload<{
  select: typeof briefingUserSelect;
}>;

export type BriefingState =
  | { status: 'off' | 'not_due' | 'dismissed'; date: string }
  | { status: 'ready'; date: string; briefing: DailyBriefing };

/** The user's calendar day for `now`, in their profile timezone (UTC when unknown). */
export function userToday(timezone: string, now: Date): string {
  return dateKeyInTimeZone(now, timezone);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

type StoredFeedback = BriefingFeedbackEntry & { id: string };

function isFeedbackAction(value: string): value is BriefingFeedbackAction {
  return (BRIEFING_FEEDBACK_ACTIONS as readonly string[]).includes(value);
}

/** Feedback rows from `from` to `to`, keys decrypted; unknown keys or actions are skipped. */
async function readFeedback(
  db: Db,
  userId: string,
  from: string,
  to: string
): Promise<StoredFeedback[]> {
  const rows = await db.briefingFeedback.findMany({
    where: { userId, date: dateRange(from, to) },
    select: { id: true, date: true, suggestionKey: true, action: true },
    orderBy: { createdAt: 'asc' },
  });
  return rows.flatMap((row) => {
    const key = decrypt(row.suggestionKey);
    if (
      !key ||
      !(key === BRIEFING_CARD_KEY || isSuggestionKey(key)) ||
      !isFeedbackAction(row.action)
    ) {
      return [];
    }
    return [
      { id: row.id, date: toDateOnlyString(row.date), key, action: row.action },
    ];
  });
}

/**
 * Throws `BriefingDateError` unless `date` is within a day of the user's today. The client
 * sends the day of the briefing it shows (from loadBriefingState); the margin lets a card
 * left open over midnight still be hidden or rated for the day it shows.
 */
async function assertBriefingDay(
  db: Db,
  userId: string,
  date: string,
  now: Date
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!acceptBriefingDate(date, userToday(user.timezone, now))) {
    throw new BriefingDateError();
  }
}

/** Adds one feedback row unless the same (day, key, action) is already stored. */
async function addFeedbackOnce(
  db: Db,
  userId: string,
  date: string,
  key: string,
  action: BriefingFeedbackAction
): Promise<void> {
  const existing = await readFeedback(db, userId, date, date);
  if (existing.some((f) => f.key === key && f.action === action)) return;
  await db.briefingFeedback.create({
    data: {
      userId,
      date: dateOnlyToUtcDate(date),
      suggestionKey: encrypt(key) ?? '',
      action,
    },
  });
}

async function removeFeedback(
  db: Db,
  userId: string,
  date: string,
  matches: (entry: StoredFeedback) => boolean
): Promise<void> {
  const ids = (await readFeedback(db, userId, date, date))
    .filter(matches)
    .map((f) => f.id);
  if (ids.length > 0) {
    await db.briefingFeedback.deleteMany({
      where: { userId, id: { in: ids } },
    });
  }
}

/** Hides one suggestion for the day; later briefings rank it a little lower. */
export async function dismissSuggestion(
  userId: string,
  input: DismissSuggestionInput,
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBriefingDay(tx, userId, input.date, now);
    await addFeedbackOnce(tx, userId, input.date, input.key, 'dismissed');
  });
}

/** Sets (or with `null` clears) the day's rating of one suggestion. */
export async function rateSuggestion(
  userId: string,
  input: RateSuggestionInput,
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBriefingDay(tx, userId, input.date, now);
    await removeFeedback(
      tx,
      userId,
      input.date,
      (f) => f.key === input.key && f.action !== 'dismissed'
    );
    if (input.rating) {
      await tx.briefingFeedback.create({
        data: {
          userId,
          date: dateOnlyToUtcDate(input.date),
          suggestionKey: encrypt(input.key) ?? '',
          action: input.rating,
        },
      });
    }
  });
}

/** Hides the whole briefing card for the day. */
export async function dismissBriefing(
  userId: string,
  date: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBriefingDay(tx, userId, date, now);
    await addFeedbackOnce(tx, userId, date, BRIEFING_CARD_KEY, 'dismissed');
  });
}

/** Undoes `dismissBriefing` for the day. */
export async function restoreBriefing(
  userId: string,
  date: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertBriefingDay(tx, userId, date, now);
    await removeFeedback(
      tx,
      userId,
      date,
      (f) => f.key === BRIEFING_CARD_KEY && f.action === 'dismissed'
    );
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type BriefingSettings = {
  preferences: BriefingPreferences;
  /** Profile timezone used for the briefing day (UTC when the profile value is unknown). */
  timezone: string;
  /** Next day a briefing is due, from today (null when off). */
  nextBriefing: string | null;
  trackVitals: boolean;
  cycleTracking: boolean;
};

const settingsSelect = {
  timezone: true,
  trackVitals: true,
  enableCycleTracking: true,
  briefingFrequency: true,
  briefingSources: true,
  briefingDetail: true,
} as const;

function toSettings(
  user: Prisma.UserGetPayload<{ select: typeof settingsSelect }>,
  now: Date
): BriefingSettings {
  const preferences = parseBriefingPreferences(user);
  const timezone = isValidTimeZone(user.timezone)
    ? user.timezone
    : FALLBACK_TIME_ZONE;
  return {
    preferences,
    timezone,
    nextBriefing: nextBriefingDate(
      preferences.frequency,
      userToday(timezone, now)
    ),
    trackVitals: user.trackVitals,
    cycleTracking: user.enableCycleTracking,
  };
}

export async function getBriefingSettings(
  userId: string,
  now: Date = new Date()
): Promise<BriefingSettings> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: settingsSelect,
  });
  return toSettings(user, now);
}

export async function saveBriefingPreferences(
  userId: string,
  input: BriefingPreferencesInput,
  now: Date = new Date()
): Promise<BriefingSettings> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.frequency !== undefined && {
        briefingFrequency: input.frequency,
      }),
      ...(input.sources !== undefined && {
        // Canonical order, no duplicates.
        briefingSources: BRIEFING_SOURCES.filter((source) =>
          input.sources?.includes(source)
        ),
      }),
      ...(input.detail !== undefined && { briefingDetail: input.detail }),
    },
    select: settingsSelect,
  });
  return toSettings(user, now);
}

// ---------------------------------------------------------------------------
// Loading the briefing
// ---------------------------------------------------------------------------

async function loadJournalDays(
  userId: string,
  from: string,
  to: string
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
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => {
    const checkIn = isJournalCheckIn(row);
    return {
      date: toDateOnlyString(row.date),
      mood: row.mood,
      energy: row.energy,
      sleepHours: row.sleepHours,
      symptoms: checkIn
        ? [
            ...decryptArray(row.symptomsPhysical),
            ...decryptArray(row.symptomsMental),
          ]
        : [],
      checkIn,
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

/** Days of meal plan items the engine looks at: 10 back (adherence) to 2 ahead. */
const MEAL_DAYS_BACK = BRIEFING_WINDOW_DAYS + 7;
const MEAL_DAYS_AHEAD = 2;
/** A household counts as "marking meals cooked" if it did so in this many days. */
const COOKED_TRACKING_DAYS = 60;

async function loadMealData(
  userId: string,
  timezone: string,
  today: string,
  householdId: string | null | undefined
): Promise<BriefingMealData | null> {
  // The space the user has open (the dashboard's), checked against their memberships;
  // falls back to their oldest membership. Never a household they are not in.
  const membership = await resolveActiveMembership(userId, householdId);
  if (!membership) return null;
  const household = { organizationId: membership.organizationId };
  // Planner items are saved at the planner's local midnight, so a day of padding on
  // both sides covers every timezone; each item is then placed on the user's day.
  const from = addDaysToDateOnly(today, -MEAL_DAYS_BACK - 1);
  const to = addDaysToDateOnly(today, MEAL_DAYS_AHEAD + 2);
  const [items, cookedRecently] = await Promise.all([
    prisma.mealPlanItem.findMany({
      where: {
        mealPlan: household,
        date: { gte: dateOnlyToUtcDate(from), lt: dateOnlyToUtcDate(to) },
      },
      select: { date: true, isCooked: true },
    }),
    prisma.mealPlanItem.count({
      where: {
        mealPlan: household,
        isCooked: true,
        date: {
          gte: dateOnlyToUtcDate(
            addDaysToDateOnly(today, -COOKED_TRACKING_DAYS)
          ),
          lt: dateOnlyToUtcDate(to),
        },
      },
    }),
  ]);

  const first = addDaysToDateOnly(today, -MEAL_DAYS_BACK);
  const last = addDaysToDateOnly(today, MEAL_DAYS_AHEAD);
  const byDate = new Map<string, { planned: number; cooked: number }>();
  for (const item of items) {
    const date = dateKeyInTimeZone(item.date, timezone);
    if (date < first || date > last) continue;
    const day = byDate.get(date) ?? { planned: 0, cooked: 0 };
    day.planned += 1;
    if (item.isCooked) day.cooked += 1;
    byDate.set(date, day);
  }
  return {
    days: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({ date, ...day })),
    cookedTracking: cookedRecently > 0,
  };
}

/**
 * The dashboard briefing for the user's day: "off" (frequency never), "not_due" (weekly,
 * not Monday), "dismissed" (hidden for the day) or "ready" with the briefing.
 *
 * The day is always the user's calendar day in their profile timezone (UTC when the
 * profile value is not a known IANA zone, see schedule.ts), never the device's: the
 * server render and the card's Refresh both come here, so the day a hide, dismissal or
 * rating is stored under is the day every later load looks up.
 */
export async function loadBriefingState(
  userId: string,
  options: {
    now?: Date;
    /** The space whose meal plan to read (the one the dashboard shows); checked here. */
    householdId?: string | null;
  } = {}
): Promise<BriefingState> {
  const now = options.now ?? new Date();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: briefingUserSelect,
  });
  const preferences = parseBriefingPreferences(user);
  const date = userToday(user.timezone, now);

  if (preferences.frequency === 'never') return { status: 'off', date };
  if (!isBriefingDue(preferences.frequency, date)) {
    return { status: 'not_due', date };
  }

  const feedback = await readFeedback(
    prisma,
    userId,
    addDaysToDateOnly(date, -FEEDBACK_LOOKBACK_DAYS),
    date
  );
  if (
    feedback.some(
      (f) =>
        f.date === date &&
        f.key === BRIEFING_CARD_KEY &&
        f.action === 'dismissed'
    )
  ) {
    return { status: 'dismissed', date };
  }

  const sources = new Set(preferences.sources);
  // Window plus the baseline history before it.
  const from = addDaysToDateOnly(
    date,
    -(BRIEFING_WINDOW_DAYS - 1 + BASELINE_WINDOW_DAYS)
  );
  const cycleTracked =
    user.enableCycleTracking && user.lastPeriodDate !== null;
  const useCycle = sources.has('cycle') && cycleTracked;
  const useVitals = sources.has('vitals') && user.trackVitals;
  // Period starts feed the cycle source and, as on the Vitals card, the recovery score's
  // phase baselines (see the module notes).
  const periodStarts =
    useCycle || (useVitals && cycleTracked)
      ? await loadPeriodStarts(userId, user)
      : null;

  const [journal, cycle, meals, vitals] = await Promise.all([
    sources.has('journal') ? loadJournalDays(userId, from, date) : null,
    useCycle && periodStarts
      ? loadCycleData(userId, user, periodStarts, from, date)
      : null,
    sources.has('meals')
      ? loadMealData(userId, user.timezone, date, options.householdId)
      : null,
    useVitals
      ? loadVitalsData(userId, user, date, cycleTracked ? periodStarts : null)
      : null,
  ]);

  return {
    status: 'ready',
    date,
    briefing: buildDailyBriefing({
      today: date,
      focus: parseFocus(user.focusPreference),
      detail: preferences.detail,
      journal,
      cycle,
      meals,
      vitals,
      feedback: feedback.map(({ date: day, key, action }) => ({
        date: day,
        key,
        action,
      })),
    }),
  };
}
