import { cache } from 'react';
import { cookies } from 'next/headers';
import type { OrganizationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ensurePersonalHousehold } from '@/lib/household';
import { canWrite, parseOrgRole, type OrgRole } from '@/lib/org-roles';
import { OrganizationIdSchema } from '@/lib/validation/organization-schemas';

/**
 * The active organization: which household (or collective, community, workplace) the app is
 * showing. Meal planner, groceries, routines, recipes, templates, dashboard and the household
 * page all follow it.
 *
 * The choice lives in an httpOnly cookie. It is only a preference: every read checks that the
 * signed-in user is still a member, and falls back to their oldest membership otherwise.
 * Better-Auth's own `session.activeOrganizationId` is not used (the column is not in this
 * schema yet), and a cookie also survives signing in again on the same device.
 *
 * Pages read the cookie when they render. Writes do not: they take the organization id the
 * page was rendered for and check it with getWritableMembershipIn, so a switch in another tab
 * never sends a write to a space the user is not looking at.
 */

export const ACTIVE_ORG_COOKIE = 'hh_active_org';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const NO_HOUSEHOLD_ERROR = 'No household found';
export const VIEW_ONLY_ERROR =
  'You have view-only access to this space. Ask an owner or admin if you need to make changes.';
/** The space a page was showing is gone, or the user is no longer a member of it. */
export const SPACE_NOT_FOUND_ERROR = 'Space not found. Reload the page and try again.';

export type ActiveMembership = {
  memberId: string;
  organizationId: string;
  /** Unknown stored roles count as viewer: least privilege. */
  role: OrgRole;
  organization: { id: string; name: string; type: OrganizationType };
};

const membershipSelect = {
  id: true,
  organizationId: true,
  role: true,
  organization: { select: { id: true, name: true, type: true } },
} as const;

function toActiveMembership(row: {
  id: string;
  organizationId: string;
  role: string;
  organization: { id: string; name: string; type: OrganizationType };
}): ActiveMembership {
  return {
    memberId: row.id,
    organizationId: row.organizationId,
    role: parseOrgRole(row.role) ?? 'viewer',
    organization: row.organization,
  };
}

/**
 * The membership for `requestedOrganizationId` if the user belongs to it, otherwise the
 * user's oldest membership. Null when the user belongs to no organization.
 */
export async function resolveActiveMembership(
  userId: string,
  requestedOrganizationId?: string | null
): Promise<ActiveMembership | null> {
  if (requestedOrganizationId) {
    const requested = await prisma.member.findFirst({
      where: { userId, organizationId: requestedOrganizationId },
      select: membershipSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (requested) return toActiveMembership(requested);
  }
  const oldest = await prisma.member.findFirst({
    where: { userId },
    select: membershipSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return oldest ? toActiveMembership(oldest) : null;
}

/** The user's membership in one specific organization, or null. */
export async function getMembershipIn(
  userId: string,
  organizationId: string
): Promise<ActiveMembership | null> {
  const row = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: membershipSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return row ? toActiveMembership(row) : null;
}

/**
 * The signed-in user's active membership for this request. Creates the personal household
 * when the user has none (accounts from before sign-up provisioned one).
 * Pass the session user id; never an id from the client.
 */
export const getActiveMembership = cache(
  async (userId: string): Promise<ActiveMembership | null> => {
    const requested = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
    const membership = await resolveActiveMembership(userId, requested);
    if (membership) return membership;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!user) return null;
    await ensurePersonalHousehold(user);
    return resolveActiveMembership(userId, null);
  }
);

export type WritableMembershipResult =
  | { ok: true; membership: ActiveMembership }
  | { ok: false; error: string };

/**
 * Active membership for household-scoped mutations: viewers are read-only.
 *
 * @deprecated The cookie can change in another tab after a page was rendered, so a write
 * would land in a space the user is not looking at. Use getWritableMembershipIn with the
 * organization id the page was rendered for.
 */
export async function getWritableMembership(
  userId: string
): Promise<WritableMembershipResult> {
  const membership = await getActiveMembership(userId);
  if (!membership) return { ok: false, error: NO_HOUSEHOLD_ERROR };
  if (!canWrite(membership.role)) return { ok: false, error: VIEW_ONLY_ERROR };
  return { ok: true, membership };
}

/**
 * Membership for a write in one specific space: the one the page was rendered for, sent back
 * by the client. The active-space cookie is not read, because it may have changed in another
 * tab since the page was rendered. Not a member (or a malformed id): SPACE_NOT_FOUND_ERROR.
 * Viewers are read-only: VIEW_ONLY_ERROR. Pass the session user id, never one from the client.
 */
export async function getWritableMembershipIn(
  userId: string,
  organizationId: unknown
): Promise<WritableMembershipResult> {
  const parsed = OrganizationIdSchema.safeParse(organizationId);
  if (!parsed.success) return { ok: false, error: SPACE_NOT_FOUND_ERROR };
  const membership = await getMembershipIn(userId, parsed.data);
  if (!membership) return { ok: false, error: SPACE_NOT_FOUND_ERROR };
  if (!canWrite(membership.role)) return { ok: false, error: VIEW_ONLY_ERROR };
  return { ok: true, membership };
}

export type OrganizationSummary = {
  id: string;
  name: string;
  type: OrganizationType;
  role: OrgRole;
};

/** Every organization the user belongs to, oldest membership first. */
export async function listUserOrganizations(
  userId: string
): Promise<OrganizationSummary[]> {
  const rows = await prisma.member.findMany({
    where: { userId },
    select: membershipSelect,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const seen = new Set<string>();
  const result: OrganizationSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.organizationId)) continue;
    seen.add(row.organizationId);
    const membership = toActiveMembership(row);
    result.push({ ...membership.organization, role: membership.role });
  }
  return result;
}

/** Remember the active organization. Server Actions only (cookies are read-only while rendering). */
export async function setActiveOrganizationCookie(organizationId: string): Promise<void> {
  (await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  });
}

export async function clearActiveOrganizationCookie(): Promise<void> {
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
}
