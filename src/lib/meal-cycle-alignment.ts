import { addDays, format } from 'date-fns';
import type { OrganizationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPhaseForDateKey, type CyclePhase } from '@/lib/cycle-calculator';
import { dateOnlyToUtcDate, isDateOnlyString, toDateOnlyString } from '@/lib/date-only';
import { canAlignMealPlanWithCycle } from '@/lib/org-policy';
import { resolveRecipeBioProfile, type RecipeBioProfile } from '@/lib/phase-nutrition';
import { getLocalDateKey, resolveTimeZone } from '@/lib/time-zone';

/**
 * Server-side cycle data for the meal planner (issue #2, Biological Fueling).
 *
 * Meal plans belong to a household, but cycle data is personal. Everything here reads
 * the cycle settings of the signed-in user only (the `userId` passed in, which callers
 * take from the session) and never another member's. The client receives estimated
 * phases for the viewer's own calendar days, nothing else about the cycle: no last
 * period date, no cycle length.
 *
 * Aligning a generated plan with the cycle is different: the picks land in the space's
 * shared plan. It is opt-in and offered in households only (canAlignMealPlanWithCycle).
 */

/** "Align with cycle phase" was sent for a space that is not a household. */
export const CYCLE_ALIGNMENT_HOUSEHOLD_ONLY_ERROR =
  'Cycle alignment is only available in a household. Turn it off to plan meals here.';

export const mealCycleSettingsSelect = {
  enableCycleTracking: true,
  cycleLength: true,
  lastPeriodDate: true,
  alignMealsWithCycle: true,
  timezone: true,
} as const satisfies Prisma.UserSelect;

export type MealCycleSettings = Prisma.UserGetPayload<{
  select: typeof mealCycleSettingsSelect;
}>;

export async function getMealCycleSettings(
  userId: string
): Promise<MealCycleSettings | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: mealCycleSettingsSelect,
  });
}

/**
 * Phase estimates exist only with tracking on and a usable last period start date. A date
 * outside the years date-only values allow (rows saved before dates were validated) counts
 * as no date: the profile asks for it again instead of the planner failing.
 */
export function hasCycleEstimate(
  settings: MealCycleSettings | null | undefined
): settings is MealCycleSettings & { lastPeriodDate: Date } {
  return Boolean(
    settings?.enableCycleTracking &&
      settings.lastPeriodDate &&
      isDateOnlyString(toDateOnlyString(settings.lastPeriodDate))
  );
}

/**
 * The user's own calendar day (`YYYY-MM-DD`) at `now`: in their profile time zone, or in UTC
 * when that is not a zone the runtime knows. Decides whether their period is already late.
 */
export function cycleTodayKey(settings: Pick<MealCycleSettings, 'timezone'>, now: Date): string {
  return getLocalDateKey(now, resolveTimeZone(settings.timezone));
}

/**
 * Estimated phase per calendar day; days without an estimate are left out. `todayKey` is the
 * user's own day (cycleTodayKey): once it is past their typical cycle length the period is
 * late or not logged, and the days after that length get no phase, so no badge and no
 * alignment (the daily briefing pauses phase-based ideas then too).
 */
export function buildPhaseCalendar(
  settings: MealCycleSettings | null | undefined,
  dateKeys: readonly string[],
  todayKey: string
): Record<string, CyclePhase> {
  const calendar: Record<string, CyclePhase> = {};
  if (!hasCycleEstimate(settings)) return calendar;
  for (const dateKey of dateKeys) {
    const phase = getPhaseForDateKey(
      settings.lastPeriodDate,
      settings.cycleLength,
      dateKey,
      todayKey
    );
    if (phase) calendar[dateKey] = phase;
  }
  return calendar;
}

/**
 * True once `todayKey` (the user's own day, cycleTodayKey) is at or past their typical cycle
 * length since the last period start: the period is late or not logged, so no phase is
 * estimated for the days after that length (buildPhaseCalendar, the daily briefing).
 */
export function isCycleLongerThanUsual(
  settings: MealCycleSettings & { lastPeriodDate: Date },
  todayKey: string
): boolean {
  if (!isDateOnlyString(todayKey)) return false;
  const start = dateOnlyToUtcDate(toDateOnlyString(settings.lastPeriodDate));
  const daysSinceStart = Math.round(
    (dateOnlyToUtcDate(todayKey).getTime() - start.getTime()) / 86_400_000
  );
  return daysSinceStart >= settings.cycleLength;
}

/** What the Meal Plan Generator needs to show its "Align with cycle phase" toggle. */
export interface GeneratorCycleOptions {
  /** Toggle can be used (tracking on, a last period date, and the cycle not past its usual length). */
  canAlign: boolean;
  /** The user's saved choice (User.alignMealsWithCycle). */
  alignByDefault: boolean;
  /**
   * The cycle is past its usual length (period late or not logged), so there are no phases
   * to align with: the toggle is off and says why, instead of planning without phases.
   */
  cycleLongerThanUsual: boolean;
}

/**
 * Null hides the toggle: the user does not track their cycle, or the plan belongs to a
 * space where a plan aligned with one person's cycle is not allowed (not a household).
 */
export function toGeneratorCycleOptions(
  settings: MealCycleSettings | null | undefined,
  organizationType: OrganizationType,
  todayKey: string
): GeneratorCycleOptions | null {
  if (!settings?.enableCycleTracking) return null;
  if (!canAlignMealPlanWithCycle(organizationType)) return null;
  const longerThanUsual =
    hasCycleEstimate(settings) && isCycleLongerThanUsual(settings, todayKey);
  return {
    canAlign: hasCycleEstimate(settings) && !longerThanUsual,
    alignByDefault: settings.alignMealsWithCycle,
    cycleLongerThanUsual: longerThanUsual,
  };
}

/** Data for Biological Match badges on the Meal Board. */
export interface MealBoardBiology {
  /** The viewer's estimated phase by `YYYY-MM-DD` day. */
  phaseByDate: Record<string, CyclePhase>;
  /** Phase profile of each planned recipe (explicit tags or inferred). */
  profiles: Record<string, RecipeBioProfile>;
}

export interface MealPlannerCycleData {
  generator: GeneratorCycleOptions | null;
  /** Rendered for the viewer only, so badges show in every kind of space. */
  board: MealBoardBiology | null;
}

/**
 * The board shows `days` calendar days from `startDate`. The browser decides which
 * column an item lands in (its local calendar day), so the phase calendar covers two
 * extra days on each side to absorb any offset between server and browser time zones.
 */
const CALENDAR_PADDING_DAYS = 2;

export function boardDateKeys(startDate: Date, days: number): string[] {
  const keys: string[] = [];
  for (let offset = -CALENDAR_PADDING_DAYS; offset < days + CALENDAR_PADDING_DAYS; offset += 1) {
    keys.push(format(addDays(startDate, offset), 'yyyy-MM-dd'));
  }
  return keys;
}

/**
 * Cycle data for the meal planner page of `userId` (the signed-in viewer).
 * `recipeIds` are the recipes planned on the board the viewer is looking at, and
 * `organizationType` is the type of the space that board belongs to.
 */
export async function getMealPlannerCycleData(
  userId: string,
  window: { startDate: Date; days: number; recipeIds: readonly string[] },
  organizationType: OrganizationType,
  now: Date = new Date()
): Promise<MealPlannerCycleData> {
  const settings = await getMealCycleSettings(userId);
  const generator = settings
    ? toGeneratorCycleOptions(settings, organizationType, cycleTodayKey(settings, now))
    : null;
  if (!hasCycleEstimate(settings)) return { generator, board: null };

  const recipeIds = [...new Set(window.recipeIds)];
  const recipes = recipeIds.length
    ? await prisma.recipe.findMany({
        where: { id: { in: recipeIds } },
        select: {
          id: true,
          phaseTags: true,
          nutrientHighlights: true,
          leanRole: true,
          ingredients: { select: { name: true, unit: true } },
        },
      })
    : [];

  const profiles: Record<string, RecipeBioProfile> = {};
  for (const recipe of recipes) {
    profiles[recipe.id] = resolveRecipeBioProfile(recipe);
  }

  return {
    generator,
    board: {
      phaseByDate: buildPhaseCalendar(
        settings,
        boardDateKeys(window.startDate, window.days),
        cycleTodayKey(settings, now)
      ),
      profiles,
    },
  };
}
