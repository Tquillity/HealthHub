import type { Prisma } from '@prisma/client';
import type { LotteryFilters } from '@/lib/validation/routine-schemas';

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
