import { z } from 'zod';

/**
 * LEAN Kitchen vocabulary shared by the recipe actions, the seed manifest and the UI.
 *
 * The idea borrows "eliminate waste" from Lean production (Womack & Jones, *Lean
 * Thinking*, 1996): spend scarce hands-on time where it pays off, batch the rest.
 * Hands-on vs hands-off time is the same split recipe sites publish as "active" and
 * "total" time; cooks use it to plan around ovens, rising and soaking.
 *
 * - Infrastructure: batch-made staples that stock the freezer or pantry (bread, crispbread).
 * - Process: building blocks reused across meals (sauces, dressings, spice mixes, marinades).
 * - Daily: everyday meals.
 * - Treat: desserts and sweets.
 *
 * Both lists are stored as plain strings (Recipe.leanRole / Recipe.batchEfficiency) so
 * older rows stay valid; every write is validated here and stored in canonical casing.
 */
export const LEAN_ROLES = ['Infrastructure', 'Process', 'Daily', 'Treat'] as const;
export type LeanRole = (typeof LEAN_ROLES)[number];

export const BATCH_EFFICIENCIES = ['High', 'Medium', 'Low'] as const;
export type BatchEfficiency = (typeof BATCH_EFFICIENCIES)[number];

export const LEAN_ROLE_DESCRIPTIONS: Record<LeanRole, string> = {
  Infrastructure: 'Batch-made staples that stock your freezer or pantry',
  Process: 'Building blocks like sauces, dressings and spice mixes',
  Daily: 'Everyday meals',
  Treat: 'Something sweet to enjoy now and then',
};

export const BATCH_EFFICIENCY_DESCRIPTIONS: Record<BatchEfficiency, string> = {
  High: 'One session stocks you up for many meals or keeps for weeks',
  Medium: 'Makes several portions that keep for a few days',
  Low: 'Best made fresh for one meal',
};

/** "Quick prep" filter: at most this many hands-on minutes (product choice, issue #9). */
export const QUICK_PREP_MAX_ACTIVE_MINUTES = 15;

/** Hands-on work longer than a day is almost certainly a typo. */
export const MAX_ACTIVE_MINUTES = 24 * 60;
/** Hands-off time can span days (overnight soaks, multi-day ferments); cap at a week. */
export const MAX_PASSIVE_MINUTES = 7 * 24 * 60;
export const MAX_YIELD_AMOUNT = 10_000;
export const MAX_YIELD_UNIT_LENGTH = 40;

export const YIELD_PAIR_MESSAGE =
  'Add both a batch yield amount and a unit, or leave both empty';

function toCanonical<T extends string>(
  values: readonly T[],
  value: unknown
): T | null {
  if (typeof value !== 'string') return null;
  const needle = value.trim().toLowerCase();
  if (!needle) return null;
  return values.find((candidate) => candidate.toLowerCase() === needle) ?? null;
}

/** Canonical role for any casing ("infrastructure" → "Infrastructure"); null when unknown. */
export function normalizeLeanRole(value: unknown): LeanRole | null {
  return toCanonical(LEAN_ROLES, value);
}

/** Canonical efficiency for any casing ("high" → "High"); null when unknown. */
export function normalizeBatchEfficiency(value: unknown): BatchEfficiency | null {
  return toCanonical(BATCH_EFFICIENCIES, value);
}

/**
 * Blank strings become null (cleared field); known values are canonicalised; anything
 * else is passed through unchanged so the enum rejects it with a clear error.
 */
function canonicalOrRaw<T extends string>(values: readonly T[]) {
  return (value: unknown) => {
    if (typeof value !== 'string') return value;
    if (value.trim() === '') return null;
    return toCanonical(values, value) ?? value;
  };
}

export const leanRoleSchema = z.preprocess(
  canonicalOrRaw(LEAN_ROLES),
  z
    .enum(LEAN_ROLES, {
      error: 'LEAN role must be Infrastructure, Process, Daily or Treat',
    })
    .nullable()
);

export const batchEfficiencySchema = z.preprocess(
  canonicalOrRaw(BATCH_EFFICIENCIES),
  z
    .enum(BATCH_EFFICIENCIES, {
      error: 'Batch efficiency must be High, Medium or Low',
    })
    .nullable()
);

export const activeTimeSchema = z
  .number()
  .int('Active time must be whole minutes')
  .min(0, 'Active time cannot be negative')
  .max(MAX_ACTIVE_MINUTES, 'Active time must be at most 24 hours')
  .nullable();

export const passiveTimeSchema = z
  .number()
  .int('Passive time must be whole minutes')
  .min(0, 'Passive time cannot be negative')
  .max(MAX_PASSIVE_MINUTES, 'Passive time must be at most 7 days')
  .nullable();

export const yieldAmountSchema = z
  .number()
  .positive('Batch yield must be more than 0')
  .max(MAX_YIELD_AMOUNT, `Batch yield must be at most ${MAX_YIELD_AMOUNT}`)
  .nullable();

export const yieldUnitSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  },
  z
    .string()
    .max(
      MAX_YIELD_UNIT_LENGTH,
      `Batch yield unit must be at most ${MAX_YIELD_UNIT_LENGTH} characters`
    )
    .nullable()
);

/** A batch yield needs both parts: "36" alone or "frallor" alone means nothing. */
export function isYieldPairIncomplete(
  amount: number | null | undefined,
  unit: string | null | undefined
): boolean {
  return (amount == null) !== (unit == null);
}

export interface RecipeTimeFields {
  prepTime?: number | null;
  cookTime?: number | null;
  activeTime?: number | null;
  passiveTime?: number | null;
}

export interface RecipeTimeSummary {
  /** Hands-on minutes, when recorded. */
  activeMinutes: number | null;
  /** Hands-off minutes, when recorded. */
  passiveMinutes: number | null;
  /** True when at least one LEAN time is recorded. */
  hasLeanTimes: boolean;
  /** Best estimate of start-to-finish minutes. */
  totalMinutes: number;
}

/**
 * Active + passive is authoritative once both are recorded (it includes rising,
 * soaking and cooling that prep + cook usually leave out). With only one or neither
 * recorded, fall back to prep + cook, never reporting less than the known LEAN time.
 */
export function getRecipeTimeSummary(recipe: RecipeTimeFields): RecipeTimeSummary {
  const activeMinutes = recipe.activeTime ?? null;
  const passiveMinutes = recipe.passiveTime ?? null;
  const leanTotal = (activeMinutes ?? 0) + (passiveMinutes ?? 0);
  const classicTotal = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  return {
    activeMinutes,
    passiveMinutes,
    hasLeanTimes: activeMinutes !== null || passiveMinutes !== null,
    totalMinutes:
      activeMinutes !== null && passiveMinutes !== null
        ? leanTotal
        : Math.max(leanTotal, classicTotal),
  };
}

/** True when the recipe has a recorded hands-on time within the quick-prep limit. */
export function isQuickPrep(recipe: { activeTime?: number | null }): boolean {
  return (
    recipe.activeTime != null &&
    recipe.activeTime <= QUICK_PREP_MAX_ACTIVE_MINUTES
  );
}

/** "45 min", "2 h", "2 h 40 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "36 frallor", "2.5 dl"; null unless both parts are present. */
export function formatYield(
  amount: number | null | undefined,
  unit: string | null | undefined
): string | null {
  const trimmedUnit = unit?.trim();
  if (amount == null || !Number.isFinite(amount) || !trimmedUnit) return null;
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded} ${trimmedUnit}`;
}
