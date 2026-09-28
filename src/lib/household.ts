import { prisma } from '@/lib/db';

/**
 * Makes sure a user belongs to at least one household (Better-Auth organization).
 *
 * Every household-scoped feature (meal planner, groceries, routines, household invites)
 * resolves the caller's organization through `member`, so a user without a membership
 * hits "No household found" everywhere. Nothing else creates one for new sign-ups.
 *
 * Idempotent and race-safe: ids are derived from the user id and inserted with
 * `skipDuplicates`, so concurrent calls (sign-up hook + first page render) create
 * at most one personal household.
 */
export async function ensurePersonalHousehold(user: {
  id: string;
  name?: string | null;
}): Promise<void> {
  const existing = await prisma.member.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return;

  const organizationId = `household-${user.id}`;
  const displayName = user.name?.trim();

  await prisma.$transaction([
    prisma.organization.createMany({
      data: {
        id: organizationId,
        name: displayName ? `${displayName}'s Household` : 'My Household',
        slug: organizationId,
      },
      skipDuplicates: true,
    }),
    prisma.member.createMany({
      data: {
        id: `member-${user.id}`,
        organizationId,
        userId: user.id,
        role: 'owner',
      },
      skipDuplicates: true,
    }),
  ]);
}
