import { prisma } from '@/lib/db';

/**
 * Loads all of a user's ingredient preferences in one query, keyed by pattern.
 * Server-only helper (not a Server Action): callers must pass a userId taken
 * from the session, never from client input.
 */
export async function loadUserIngredientPreferenceMap(
  userId: string
): Promise<Map<string, string>> {
  const preferences = await prisma.userIngredientPreference.findMany({
    where: { userId },
    select: { pattern: true, preferred: true },
  });
  return new Map(preferences.map((pref) => [pref.pattern, pref.preferred]));
}
