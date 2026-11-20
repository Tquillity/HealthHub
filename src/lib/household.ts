import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { lockUserMemberships } from '@/lib/membership-locks';
import { generateRecordId } from '@/lib/record-ids';

type PersonalHouseholdUser = { id: string; name?: string | null };

/**
 * Creates a new, empty household owned by the user. Call it inside a transaction that holds
 * lockUserMemberships for this user.
 *
 * The first one gets the id `household-<userId>`. If that organization already exists, the
 * user left it or was removed from it, and it may belong to someone else now: it is never
 * joined again. The user gets a brand-new household with fresh ids instead.
 */
export async function createPersonalHousehold(
  tx: Prisma.TransactionClient,
  user: PersonalHouseholdUser
): Promise<string> {
  const displayName = user.name?.trim();
  const name = displayName ? `${displayName}'s Household` : 'My Household';
  const firstId = `household-${user.id}`;

  const created = await tx.organization.createMany({
    data: { id: firstId, name, slug: firstId },
    skipDuplicates: true,
  });
  let organizationId = firstId;
  if (created.count === 0) {
    organizationId = generateRecordId('org');
    await tx.organization.create({ data: { id: organizationId, name, slug: organizationId } });
  }
  await tx.member.create({
    data: { id: generateRecordId('mem'), organizationId, userId: user.id, role: 'owner' },
  });
  return organizationId;
}

/**
 * Makes sure a user belongs to at least one household (Better-Auth organization).
 *
 * Every household-scoped feature (meal planner, groceries, routines, household invites)
 * resolves the caller's organization through `member`, so a user without a membership
 * hits "No household found" everywhere. Nothing else creates one for new sign-ups, and a
 * user can reach zero memberships later (removed from their last space).
 *
 * Idempotent and race-safe: the per-user lock makes concurrent calls (sign-up hook + first
 * page render, or several tabs) wait for each other, and each one checks again under the
 * lock, so at most one household is created.
 */
export async function ensurePersonalHousehold(user: PersonalHouseholdUser): Promise<void> {
  const existing = await prisma.member.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return;

  await prisma.$transaction(async (tx) => {
    await lockUserMemberships(tx, user.id);
    const joined = await tx.member.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (joined) return;
    await createPersonalHousehold(tx, user);
  });
}
