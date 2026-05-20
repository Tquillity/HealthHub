import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function getServerSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

/**
 * Current user id for optional-auth reads (public recipes, cache keys).
 * Returns null when unauthenticated or on failure — never throws.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await getServerSession();
    return session?.user.id ?? null;
  } catch (error) {
    console.error('[HealthHub session] Failed to resolve user id:', error);
    return null;
  }
}

export type RequireSessionResult =
  | { ok: true; userId: string }
  | { ok: false; error: 'Unauthorized' };

/**
 * Signed-in user id for mutations. Returns a discriminated result for action handlers.
 */
export async function requireSessionUserId(): Promise<RequireSessionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, error: 'Unauthorized' };
  }
  return { ok: true, userId };
}
