import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/** How many routines the dashboard's "Recent Routines" card lists. */
export const RECENT_ROUTINES_LIMIT = 6;

/**
 * The household the dashboard shows for this user, or null before one is provisioned
 * (the protected layout backfills it). Memoised per request with React `cache`, so the
 * dashboard sections that stream in separately share a single lookup.
 */
export const getDashboardHouseholdId = cache(
  async (userId: string): Promise<string | null> => {
    const membership = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    return membership?.organizationId ?? null;
  }
);

/** Shared catalog items plus the household's own. Never another household's. */
function householdOrSystem(organizationId: string) {
  return {
    OR: [{ isSystem: true }, { organizationId }],
  } satisfies Prisma.RoutineWhereInput & Prisma.RecipeWhereInput;
}

export type DashboardStats = { routinesCount: number; recipesCount: number };

/** Routine and recipe totals for the dashboard, or null when the user has no household yet. */
export async function getDashboardStats(userId: string): Promise<DashboardStats | null> {
  const organizationId = await getDashboardHouseholdId(userId);
  if (!organizationId) return null;

  const where = householdOrSystem(organizationId);
  const [routinesCount, recipesCount] = await Promise.all([
    prisma.routine.count({ where }),
    prisma.recipe.count({ where }),
  ]);
  return { routinesCount, recipesCount };
}

/** Newest routines visible to the user's household; empty when there is no household yet. */
export async function getRecentDashboardRoutines(userId: string) {
  const organizationId = await getDashboardHouseholdId(userId);
  if (!organizationId) return [];

  return prisma.routine.findMany({
    where: householdOrSystem(organizationId),
    orderBy: { createdAt: 'desc' },
    take: RECENT_ROUTINES_LIMIT,
  });
}

export type RecentDashboardRoutine = Awaited<
  ReturnType<typeof getRecentDashboardRoutines>
>[number];
