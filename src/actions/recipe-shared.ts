/**
 * Shared recipe types and server-side helpers used by `recipe-queries` and
 * `recipe-mutations` only.
 *
 * Keep this module small: types, visibility filter, image preprocess, admin check.
 * Do not add new mutations or HTTP-facing exports here — use the query/mutation
 * files or `recipe-actions.ts` barrel. If this grows past ~120 LOC, split types
 * into `recipe-types.ts` in a follow-up PR.
 */
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export type RecipeWithDetails = Prisma.RecipeGetPayload<{
  include: { ingredients: true; instructions: { orderBy: { stepNumber: 'asc' } } };
}>;

export function preprocessRecipeInput<
  T extends { imageUrl?: string | null; imageUrls?: string[] | null },
>(data: T): T {
  const processed = { ...data } as T & { imageUrl?: string; imageUrls?: string[] };
  if (
    !processed.imageUrl ||
    (typeof processed.imageUrl === 'string' && processed.imageUrl.trim() === '')
  ) {
    delete processed.imageUrl;
  }
  if (Array.isArray(processed.imageUrls)) {
    processed.imageUrls = processed.imageUrls.filter(
      (url): url is string => typeof url === 'string' && url.trim() !== ''
    );
    if (processed.imageUrls.length === 0) {
      delete processed.imageUrls;
    }
  }
  return processed as T;
}

export async function isMainAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'superadmin';
  } catch (error) {
    console.error('Error checking superadmin status:', error);
    return false;
  }
}

export async function buildRecipeVisibilityFilter(
  userId: string | null
): Promise<Prisma.RecipeWhereInput> {
  if (!userId) {
    return {
      isSystem: true,
      isSecret: false,
      isPrivate: false,
    };
  }

  const membership = await prisma.member.findFirst({
    where: { userId },
    select: { organizationId: true },
  });
  const orgId = membership?.organizationId || null;
  const mainAdmin = await isMainAdmin(userId);

  return {
    AND: [
      {
        OR: [
          { isSystem: true },
          ...(orgId ? [{ organizationId: orgId }] : []),
          ...(mainAdmin ? [{ isSecret: true }] : []),
        ],
      },
      ...(mainAdmin ? [] : [{ isSecret: false }]),
      { isPrivate: false },
    ],
  };
}
