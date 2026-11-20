import { addDays, format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getPhaseForDateKey, type CyclePhase } from '@/lib/cycle-calculator';
import { isDateOnlyString, toDateOnlyString } from '@/lib/date-only';
import { resolveRecipeBioProfile, type RecipeBioProfile } from '@/lib/phase-nutrition';

/**
 * Server-side cycle data for the meal planner (issue #2, Biological Fueling).
 *
 * Meal plans belong to a household, but cycle data is personal. Everything here reads
 * the cycle settings of the signed-in user only (the `userId` passed in, which callers
 * take from the session) and never another member's. The client receives estimated
 * phases for the viewer's own calendar days, nothing else about the cycle: no last
 * period date, no cycle length.
 */

export const mealCycleSettingsSelect = {
  enableCycleTracking: true,
  cycleLength: true,
  lastPeriodDate: true,
  alignMealsWithCycle: true,
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

/** Estimated phase per calendar day; days without an estimate are left out. */
export function buildPhaseCalendar(
  settings: MealCycleSettings | null | undefined,
  dateKeys: readonly string[]
): Record<string, CyclePhase> {
  const calendar: Record<string, CyclePhase> = {};
  if (!hasCycleEstimate(settings)) return calendar;
  for (const dateKey of dateKeys) {
    const phase = getPhaseForDateKey(
      settings.lastPeriodDate,
      settings.cycleLength,
      dateKey
    );
    if (phase) calendar[dateKey] = phase;
  }
  return calendar;
}

/** What the Meal Plan Generator needs to show its "Align with cycle phase" toggle. */
export interface GeneratorCycleOptions {
  /** Toggle can be used (tracking on and a last period date). */
  canAlign: boolean;
  /** The user's saved choice (User.alignMealsWithCycle). */
  alignByDefault: boolean;
}

/** Null hides all cycle UI: the user does not track their cycle. */
export function toGeneratorCycleOptions(
  settings: MealCycleSettings | null | undefined
): GeneratorCycleOptions | null {
  if (!settings?.enableCycleTracking) return null;
  return {
    canAlign: hasCycleEstimate(settings),
    alignByDefault: settings.alignMealsWithCycle,
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
 * `recipeIds` are the recipes planned on the board the viewer is looking at.
 */
export async function getMealPlannerCycleData(
  userId: string,
  window: { startDate: Date; days: number; recipeIds: readonly string[] }
): Promise<MealPlannerCycleData> {
  const settings = await getMealCycleSettings(userId);
  const generator = toGeneratorCycleOptions(settings);
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
        boardDateKeys(window.startDate, window.days)
      ),
      profiles,
    },
  };
}
