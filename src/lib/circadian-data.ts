import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildRecipeVisibilityFilter } from '@/actions/recipe-shared';
import {
  addDaysToDateOnly,
  dateOnlyToUtcDate,
  toDateOnlyString,
} from '@/lib/date-only';
import { isValidTimeZone } from '@/lib/briefing/schedule';
import { safeErrorLabel } from '@/lib/safe-error';
import {
  buildCircadianInsights,
  ENERGY_HISTORY_DAYS,
  ENERGY_SLOT_FIELDS,
  LIGHT_DINNER_MAX_KCAL,
  localTimeIn,
  lotteryHintFromInsights,
  lotteryTargetFromInsights,
  PROTEIN_RICH_BREAKFAST_MIN_GRAMS,
  slotForWindow,
  windowForHour,
  type CircadianInsights,
  type CircadianLotteryHint,
  type EnergySlot,
  type EnergySlotField,
  type LotteryCircadianTarget,
  type MealFocus,
  type TimeOfDayEnergyRow,
} from '@/lib/circadian-recommendations';
import type {
  CircadianPreferencesInput,
  TimeOfDayEnergyFields,
} from '@/lib/validation/circadian-schemas';

/**
 * Circadian insights data layer: the opt-in, energy check-ins by time of day, and the
 * loaders for the dashboard card, the journal analytics and the routine lottery.
 *
 * - Nothing is read or written unless the user turned circadian insights on
 *   (User.enableCircadianInsights); every function checks it on the server.
 * - Check-ins are plain 1-10 numbers on the user's own JournalEntry, like `energy`.
 *   Writes touch ONLY the time-of-day fields; they never go through `logJournalEntry`,
 *   which replaces list fields that are left out.
 * - The time of day comes from the server clock in the user's profile timezone
 *   (User.timezone), never from the client.
 * - Only the session user's rows are read; meal ideas use the same recipe visibility
 *   as the recipe pages (system and household recipes, no secret or private ones).
 */

/** Check-ins were sent while the user's opt-in is off. */
export class CircadianNotEnabledError extends Error {
  constructor() {
    super(
      'Turn on circadian insights in your profile to log energy by time of day.'
    );
  }
}

/** A quick check-in was sent at night, when there is no time-of-day slot. */
export class EnergyCheckInClosedError extends Error {
  constructor() {
    super(
      'Energy check-ins are open from 06:00 to 22:00 your time. You can still add them in your journal.'
    );
  }
}

const circadianUserSelect = {
  enableCircadianInsights: true,
  timezone: true,
} as const;

type CircadianUser = Prisma.UserGetPayload<{
  select: typeof circadianUserSelect;
}>;

async function readCircadianUser(userId: string): Promise<CircadianUser> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: circadianUserSelect,
  });
}

/** Any time-of-day check-in on the entry. */
const timeOfDayLogged = {
  OR: [
    { energyMorning: { not: null } },
    { energyAfternoon: { not: null } },
    { energyEvening: { not: null } },
  ],
} satisfies Prisma.JournalEntryWhereInput;

/** Check-ins from the `ENERGY_HISTORY_DAYS` days ending on `today`, oldest first. */
export async function loadTimeOfDayEnergyRows(
  userId: string,
  today: string
): Promise<TimeOfDayEnergyRow[]> {
  const rows = await prisma.journalEntry.findMany({
    where: {
      userId,
      date: {
        gte: dateOnlyToUtcDate(
          addDaysToDateOnly(today, -(ENERGY_HISTORY_DAYS - 1))
        ),
        lte: dateOnlyToUtcDate(today),
      },
      ...timeOfDayLogged,
    },
    select: {
      date: true,
      energyMorning: true,
      energyAfternoon: true,
      energyEvening: true,
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({ ...row, date: toDateOnlyString(row.date) }));
}

/** Insights for `now`, or null when the user has not turned circadian insights on. */
export async function loadCircadianInsights(
  userId: string,
  now: Date = new Date()
): Promise<CircadianInsights | null> {
  const user = await readCircadianUser(userId);
  if (!user.enableCircadianInsights) return null;
  const today = localTimeIn(now, user.timezone).dateKey;
  const rows = await loadTimeOfDayEnergyRows(userId, today);
  return buildCircadianInsights({ now, timeZone: user.timezone, rows });
}

/** Routine lottery weighting for now, or null (unbiased draw) when the opt-in is off. */
export async function loadLotteryCircadianTarget(
  userId: string,
  now: Date = new Date()
): Promise<LotteryCircadianTarget | null> {
  const insights = await loadCircadianInsights(userId, now);
  return insights ? lotteryTargetFromInsights(insights) : null;
}

/**
 * The routines page hint for the lottery dialog, or null when the opt-in is off. Never
 * throws: the page works without it.
 */
export async function loadCircadianLotteryHint(
  userId: string,
  now: Date = new Date()
): Promise<CircadianLotteryHint | null> {
  try {
    const insights = await loadCircadianInsights(userId, now);
    return insights ? lotteryHintFromInsights(insights) : null;
  } catch (error) {
    console.error(
      '[circadian] Failed to load the lottery hint:',
      safeErrorLabel(error)
    );
    return null;
  }
}

export type EnergyCheckIn = {
  /** The user's calendar day, `YYYY-MM-DD`. */
  date: string;
  slot: EnergySlot;
  energy: number;
};

/**
 * "How is your energy right now?": saves `energy` in the current time-of-day slot of the
 * user's day in their profile timezone. Writes only that one field.
 */
export async function saveEnergyNow(
  userId: string,
  energy: number,
  now: Date = new Date()
): Promise<EnergyCheckIn> {
  const user = await readCircadianUser(userId);
  if (!user.enableCircadianInsights) throw new CircadianNotEnabledError();
  const local = localTimeIn(now, user.timezone);
  const slot = slotForWindow(windowForHour(local.hour));
  if (!slot) throw new EnergyCheckInClosedError();

  const field = ENERGY_SLOT_FIELDS[slot];
  const date = dateOnlyToUtcDate(local.dateKey);
  await prisma.journalEntry.upsert({
    where: { userId_date: { userId, date } },
    update: { [field]: energy },
    create: { userId, date, [field]: energy },
    select: { id: true },
  });
  return { date: local.dateKey, slot, energy };
}

/**
 * The time-of-day fields a full journal save may write: the ones that were sent, and
 * none at all while the opt-in is off (nothing is tracked unless the user turned it on).
 */
export async function allowedTimeOfDayEnergy(
  userId: string,
  input: TimeOfDayEnergyFields
): Promise<Partial<Record<EnergySlotField, number | null>>> {
  const sent: Partial<Record<EnergySlotField, number | null>> = {};
  for (const field of Object.values(ENERGY_SLOT_FIELDS)) {
    if (input[field] !== undefined) sent[field] = input[field];
  }
  if (Object.keys(sent).length === 0) return {};
  const user = await readCircadianUser(userId);
  return user.enableCircadianInsights ? sent : {};
}

/** "Delete my energy check-ins": clears the time-of-day fields on every journal day. */
export async function clearTimeOfDayEnergy(userId: string): Promise<number> {
  const { count } = await prisma.journalEntry.updateMany({
    where: { userId, ...timeOfDayLogged },
    data: { energyMorning: null, energyAfternoon: null, energyEvening: null },
  });
  return count;
}

export type CircadianSettings = {
  enabled: boolean;
  /** The profile timezone as stored. */
  timeZone: string;
  timeZoneValid: boolean;
  /** Journal days with any time-of-day check-in. */
  loggedDays: number;
};

export async function getCircadianSettings(
  userId: string
): Promise<CircadianSettings> {
  const [user, loggedDays] = await Promise.all([
    readCircadianUser(userId),
    prisma.journalEntry.count({ where: { userId, ...timeOfDayLogged } }),
  ]);
  return {
    enabled: user.enableCircadianInsights,
    timeZone: user.timezone,
    timeZoneValid: isValidTimeZone(user.timezone),
    loggedDays,
  };
}

export async function updateCircadianPreferences(
  userId: string,
  input: CircadianPreferencesInput
): Promise<{ enabled: boolean }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { enableCircadianInsights: input.enabled },
    select: { enableCircadianInsights: true },
  });
  return { enabled: user.enableCircadianInsights };
}

// ---------------------------------------------------------------------------
// Meal nudge
// ---------------------------------------------------------------------------

export type CircadianMealIdea = {
  id: string;
  name: string;
  /** Grams per serving. */
  protein: number | null;
  /** kcal per serving. */
  calories: number | null;
};

/** At most this many recipe ideas are shown with the meal nudge. */
export const MEAL_IDEA_LIMIT = 2;

function mealIdeaWhere(focus: MealFocus): Prisma.RecipeWhereInput {
  return focus === 'protein-breakfast'
    ? {
        category: { equals: 'breakfast', mode: 'insensitive' },
        protein: { gte: PROTEIN_RICH_BREAKFAST_MIN_GRAMS },
      }
    : {
        category: { equals: 'dinner', mode: 'insensitive' },
        calories: { gt: 0, lte: LIGHT_DINNER_MAX_KCAL },
      };
}

/**
 * Recipes the user can see that fit the meal nudge: breakfasts with enough protein per
 * serving, or dinners within the lighter calorie range (protein-richest first).
 */
export async function loadMealIdeas(
  userId: string,
  focus: MealFocus
): Promise<CircadianMealIdea[]> {
  const visibility = await buildRecipeVisibilityFilter(userId);
  return prisma.recipe.findMany({
    where: { AND: [visibility, mealIdeaWhere(focus)] },
    select: { id: true, name: true, protein: true, calories: true },
    orderBy:
      focus === 'protein-breakfast'
        ? [{ protein: 'desc' }, { name: 'asc' }]
        : [
            { protein: { sort: 'desc', nulls: 'last' } },
            { calories: 'asc' },
            { name: 'asc' },
          ],
    take: MEAL_IDEA_LIMIT,
  });
}

export type CircadianCardData = {
  insights: CircadianInsights;
  mealIdeas: CircadianMealIdea[];
};

/** Data for the dashboard card, or null when the user has not opted in. */
export async function loadCircadianCardData(
  userId: string,
  now: Date = new Date()
): Promise<CircadianCardData | null> {
  const insights = await loadCircadianInsights(userId, now);
  if (!insights) return null;
  const mealIdeas = insights.mealFocus
    ? await loadMealIdeas(userId, insights.mealFocus)
    : [];
  return { insights, mealIdeas };
}
