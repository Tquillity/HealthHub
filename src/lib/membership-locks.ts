import type { Prisma } from '@prisma/client';

/**
 * Transaction-scoped PostgreSQL advisory locks that serialize membership changes, so checks
 * such as "is this the user's only space?" or "is this the last owner?" stay true until the
 * transaction that relies on them commits. Postgres releases them at commit or rollback.
 *
 * Take the user lock before the organization lock, so two transactions never wait on each
 * other in a cycle. The two-key form keeps user and organization keys in separate spaces.
 */

type Tx = Pick<Prisma.TransactionClient, '$executeRaw'>;

/** Serializes changes to one user's set of memberships. */
export async function lockUserMemberships(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301, hashtext(${userId}))`;
}

/** Serializes leaving one organization. Take it after the user lock. */
export async function lockOrganizationMembers(tx: Tx, organizationId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7302, hashtext(${organizationId}))`;
}
