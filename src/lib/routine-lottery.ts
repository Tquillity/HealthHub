import type { Prisma } from '@prisma/client';
import type { LotteryFilters } from '@/lib/validation/routine-schemas';
import type { LotteryCircadianTarget } from '@/lib/circadian-recommendations';

/** Builds the routine `where` from validated filters only (HEALTH-16). */
export function buildLotteryWhere(
  filters: LotteryFilters,
  organizationId: string
): Prisma.RoutineWhereInput {
  const where: Prisma.RoutineWhereInput = {
    OR: [{ organizationId }, { isSystem: true }],
  };
  if (filters.energy) where.energyLevel = filters.energy;
  if (filters.maxTime) where.estimatedTime = { lte: filters.maxTime };
  if (filters.context) where.context = filters.context;
  if (filters.duration) where.duration = filters.duration;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  return where;
}

/** Unbiased Fisher-Yates shuffle; returns a new array. */
export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Picks up to `count` distinct items uniformly at random. */
export function drawRandom<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

// ---------------------------------------------------------------------------
// Circadian weighting (only when the user turned circadian insights on)
// ---------------------------------------------------------------------------

/** Routine `energyLevel` on the 0 (low) to 2 (high) intensity scale. */
const ENERGY_LEVEL_INTENSITY: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Weight of a routine that matches the target intensity exactly (a full miss is 1). */
export const BEST_FIT_WEIGHT = 4;

/** Routines tagged for this part of the day count more; the opposite part less. */
export const CONTEXT_MATCH_FACTOR = 1.5;
export const CONTEXT_MISMATCH_FACTOR = 0.5;

/**
 * How strongly to favour a routine right now. Every routine keeps a weight of at least
 * 0.5, so weighting changes the odds but never filters anything out:
 * - intensity: from `BEST_FIT_WEIGHT` when the routine's energy level matches the
 *   target (lib/circadian-recommendations) down to 1 at the opposite end of the scale;
 * - context: "morning" routines count more in the morning and "evening" routines in
 *   the evening and at night, and less the other way round.
 */
export function circadianRoutineWeight(
  routine: { energyLevel: string; context: string | null },
  target: LotteryCircadianTarget
): number {
  // Unknown legacy values count as medium (the column default).
  const intensity = ENERGY_LEVEL_INTENSITY[routine.energyLevel] ?? 1;
  const distance = Math.min(2, Math.abs(intensity - target.intensity));
  const intensityWeight = 1 + (BEST_FIT_WEIGHT - 1) * (1 - distance / 2);

  let contextFactor = 1;
  const late = target.window === 'evening' || target.window === 'night';
  if (routine.context === 'morning') {
    if (target.window === 'morning') contextFactor = CONTEXT_MATCH_FACTOR;
    else if (late) contextFactor = CONTEXT_MISMATCH_FACTOR;
  } else if (routine.context === 'evening') {
    if (late) contextFactor = CONTEXT_MATCH_FACTOR;
    else if (target.window === 'morning')
      contextFactor = CONTEXT_MISMATCH_FACTOR;
  }
  return intensityWeight * contextFactor;
}

/**
 * Picks up to `count` distinct items, each draw in proportion to its weight among the
 * items still left (weighted sampling without replacement). Items with a weight that is
 * not a positive number are only drawn when nothing else is left.
 */
export function drawWeighted<T>(
  items: readonly T[],
  count: number,
  weightOf: (item: T) => number,
  random: () => number = Math.random
): T[] {
  const pool = items.map((item) => {
    const weight = weightOf(item);
    return { item, weight: Number.isFinite(weight) && weight > 0 ? weight : 0 };
  });
  const picked: T[] = [];
  const wanted = Math.min(Math.max(0, count), pool.length);
  while (picked.length < wanted) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let index: number;
    if (total <= 0) {
      index = Math.floor(random() * pool.length);
    } else {
      let threshold = random() * total;
      index = pool.findIndex((entry) => {
        threshold -= entry.weight;
        return threshold < 0 && entry.weight > 0;
      });
      // Floating-point leftovers: fall back to the last item with weight.
      if (index === -1) index = pool.findLastIndex((entry) => entry.weight > 0);
    }
    picked.push(pool[index].item);
    pool.splice(index, 1);
  }
  return picked;
}

/**
 * The lottery draw: uniform (unbiased) when `target` is null, which is always the case
 * unless the user turned circadian insights on; weighted for the time of day otherwise.
 */
export function drawLotteryRoutines<
  T extends { energyLevel: string; context: string | null },
>(
  candidates: readonly T[],
  count: number,
  target: LotteryCircadianTarget | null,
  random: () => number = Math.random
): T[] {
  if (!target) return drawRandom(candidates, count, random);
  return drawWeighted(
    candidates,
    count,
    (routine) => circadianRoutineWeight(routine, target),
    random
  );
}
