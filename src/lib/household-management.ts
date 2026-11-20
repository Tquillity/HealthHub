import { randomBytes } from 'node:crypto';
import type { OrganizationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getActiveMembership,
  getMembershipIn,
  NO_HOUSEHOLD_ERROR,
  SPACE_NOT_FOUND_ERROR,
} from '@/lib/active-organization';
import {
  canManage,
  checkLeave,
  checkMemberRemoval,
  checkOwnershipTransfer,
  checkRoleChange,
  invitableRoles,
  parseOrgRole,
  type AssignableRole,
  type OrgRole,
} from '@/lib/org-roles';
import {
  checkInvitation,
  INVITATION_CHECK_MESSAGES,
  invitationExpiry,
  normalizeEmail,
} from '@/lib/invitations';
import { createPersonalHousehold } from '@/lib/household';
import { lockOrganizationMembers, lockUserMemberships } from '@/lib/membership-locks';
import { generateInvitationId, generateRecordId } from '@/lib/record-ids';

/**
 * Household (organization) management: members, roles, invitations, leaving and creating.
 *
 * Every function takes the signed-in user's id (never one from the client) and checks that
 * user's membership and role in the organization it touches. Server Actions in
 * src/actions/household-actions.ts are thin wrappers around these.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = <T>(error: string): Result<T> => ({ ok: false, error });

/**
 * A role or membership changed between our checks and the write (another tab, another owner
 * or admin acting at the same moment). Writes are conditional on what was checked, so nothing
 * was changed; reloading shows the current state.
 */
export const MEMBERSHIP_CHANGED_ERROR =
  'Something changed in this space just now. Reload the page and try again.';

class MembershipChangedError extends Error {}

/** Journal entries a person shared with an organization stop being shared when they leave it. */
async function unshareJournalEntries(
  tx: Pick<typeof prisma, 'journalEntry'>,
  userId: string,
  organizationId: string
) {
  await tx.journalEntry.updateMany({
    where: { userId, sharedOrganizationId: organizationId },
    data: { visibility: 'PRIVATE', sharedOrganizationId: null },
  });
}

async function countOwners(
  tx: Pick<typeof prisma, 'member'>,
  organizationId: string
): Promise<number> {
  const members = await tx.member.findMany({
    where: { organizationId },
    select: { role: true },
  });
  return members.filter((member) => parseOrgRole(member.role) === 'owner').length;
}

export type HouseholdMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: OrgRole;
  joinedAt: Date;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: Date;
};

export type InvitationForYou = {
  id: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: OrgRole;
  inviterName: string | null;
  expiresAt: Date;
};

export type HouseholdData = {
  organization: { id: string; name: string; type: OrganizationType };
  currentUserId: string;
  currentUserRole: OrgRole;
  members: HouseholdMember[];
  /** Pending, unexpired invitations to this organization. Only owners and admins see them. */
  invitations: PendingInvitation[];
  /**
   * Pending invitations addressed to the signed-in user's email, to any organization.
   * Listed only when that email is verified; otherwise the invite link is needed.
   */
  invitationsForYou: InvitationForYou[];
  /** Roles the user may hand out in an invitation. */
  invitableRoles: AssignableRole[];
  ownerCount: number;
  membershipCount: number;
};

/** Everything the household page needs for the active organization. */
export async function getHouseholdData(userId: string): Promise<Result<HouseholdData>> {
  const membership = await getActiveMembership(userId);
  if (!membership) return fail(NO_HOUSEHOLD_ERROR);
  const { organizationId } = membership;
  const now = new Date();

  const [user, memberRows, invitationRows, membershipCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    }),
    prisma.member.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    canManage(membership.role)
      ? prisma.invitation.findMany({
          where: { organizationId, status: 'pending', expiresAt: { gt: now } },
          select: { id: true, email: true, role: true, expiresAt: true },
          orderBy: { expiresAt: 'asc' },
        })
      : Promise.resolve([]),
    prisma.member.count({ where: { userId } }),
  ]);
  if (!user) return fail('Unauthorized');

  // Sign-up does not verify email addresses, so anyone can register with an invitee's
  // address before they do. Listing by email would hand that account the invitation (and
  // its id) without the link. Unverified accounts must open the unguessable link instead.
  const forYouRows = user.emailVerified
    ? await prisma.invitation.findMany({
        where: {
          email: { equals: normalizeEmail(user.email), mode: 'insensitive' },
          status: 'pending',
          expiresAt: { gt: now },
          organization: { members: { none: { userId } } },
        },
        select: {
          id: true,
          role: true,
          expiresAt: true,
          inviterId: true,
          organization: { select: { name: true, type: true } },
        },
        orderBy: { expiresAt: 'asc' },
      })
    : [];
  const inviterIds = [...new Set(forYouRows.map((row) => row.inviterId))];
  const inviters = inviterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, name: true },
      })
    : [];
  const inviterNames = new Map(inviters.map((inviter) => [inviter.id, inviter.name]));

  const members: HouseholdMember[] = memberRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    image: row.user.image,
    role: parseOrgRole(row.role) ?? 'viewer',
    joinedAt: row.createdAt,
  }));

  return {
    ok: true,
    data: {
      organization: membership.organization,
      currentUserId: userId,
      currentUserRole: membership.role,
      members,
      invitations: invitationRows.map((row) => ({
        id: row.id,
        email: row.email,
        role: parseOrgRole(row.role) ?? 'member',
        expiresAt: row.expiresAt,
      })),
      invitationsForYou: forYouRows.map((row) => ({
        id: row.id,
        organizationName: row.organization.name,
        organizationType: row.organization.type,
        role: parseOrgRole(row.role) ?? 'member',
        inviterName: inviterNames.get(row.inviterId) ?? null,
        expiresAt: row.expiresAt,
      })),
      invitableRoles: invitableRoles(membership.role),
      ownerCount: members.filter((member) => member.role === 'owner').length,
      membershipCount,
    },
  };
}

export type CreatedInvitation = {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: Date;
};

/**
 * Optional hook that creates the invitation through Better-Auth (`auth.api.createInvitation`).
 * Returns the created invitation's id, or null/throws to fall back to a direct insert.
 */
export type AuthInvitationCreator = (input: {
  email: string;
  organizationId: string;
  role: AssignableRole;
}) => Promise<string | null>;

/**
 * Invite someone by email to `input.organizationId`: the space the household page was
 * rendered for, not the active-space cookie (another tab may have switched it since).
 * Owners and admins of that space only.
 */
export async function inviteMember(
  userId: string,
  input: { organizationId: string; email: string; role: AssignableRole },
  createWithAuth?: AuthInvitationCreator
): Promise<Result<CreatedInvitation>> {
  const membership = await getMembershipIn(userId, input.organizationId);
  if (!membership) return fail(SPACE_NOT_FOUND_ERROR);
  if (!canManage(membership.role)) {
    return fail('Only owners and admins can invite people.');
  }
  if (!invitableRoles(membership.role).includes(input.role)) {
    return fail('Only the owner can invite someone as an admin.');
  }
  const { organizationId } = membership;
  const email = normalizeEmail(input.email);
  const now = new Date();

  const [existingMember, pending] = await Promise.all([
    prisma.member.findFirst({
      where: {
        organizationId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
      select: { id: true },
    }),
    prisma.invitation.findFirst({
      where: {
        organizationId,
        email: { equals: email, mode: 'insensitive' },
        status: 'pending',
        expiresAt: { gt: now },
      },
      select: { id: true },
    }),
  ]);
  if (existingMember) return fail('This person is already a member.');
  if (pending) {
    return fail('This person already has a pending invitation. Copy its link from the list below.');
  }

  if (createWithAuth) {
    try {
      const id = await createWithAuth({ email, organizationId, role: input.role });
      if (id) {
        const created = await prisma.invitation.findUnique({
          where: { id },
          select: { id: true, email: true, expiresAt: true },
        });
        if (created) {
          return {
            ok: true,
            data: { id: created.id, email: created.email, role: input.role, expiresAt: created.expiresAt },
          };
        }
      }
    } catch {
      // Better-Auth refused or its schema does not match ours yet: insert directly below.
    }
  }

  const invitation = await prisma.invitation.create({
    data: {
      id: generateInvitationId(),
      organizationId,
      email,
      role: input.role,
      status: 'pending',
      expiresAt: invitationExpiry(now),
      inviterId: userId,
    },
    select: { id: true, email: true, expiresAt: true },
  });
  return {
    ok: true,
    data: { id: invitation.id, email: invitation.email, role: input.role, expiresAt: invitation.expiresAt },
  };
}

/** Cancel a pending invitation. Owners and admins of its organization only. */
export async function cancelInvitation(
  userId: string,
  invitationId: string
): Promise<Result<{ organizationId: string }>> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!invitation) return fail('Invitation not found');
  const membership = await getMembershipIn(userId, invitation.organizationId);
  // Same answer for "not yours" and "missing", so ids cannot be probed.
  if (!membership) return fail('Invitation not found');
  if (!canManage(membership.role)) {
    return fail('Only owners and admins can cancel invitations.');
  }
  if (invitation.status !== 'pending') {
    return fail('This invitation is no longer pending.');
  }
  // Deleting (rather than marking cancelled) also drops the invitee's email address.
  await prisma.invitation.delete({ where: { id: invitation.id } });
  return { ok: true, data: { organizationId: invitation.organizationId } };
}

export type InvitationPreview = {
  id: string;
  organizationName: string;
  organizationType: OrganizationType;
  role: OrgRole;
  inviterName: string | null;
  expiresAt: Date;
};

/**
 * What the /invite/<id> page may show. Details only go to the person the invitation was
 * sent to; everyone else gets the reason it cannot be accepted.
 */
export async function getInvitationForUser(
  userId: string,
  invitationId: string
): Promise<Result<InvitationPreview & { alreadyMember: boolean }>> {
  const [user, invitation] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        inviterId: true,
        organizationId: true,
        organization: { select: { name: true, type: true } },
      },
    }),
  ]);
  if (!user) return fail('Unauthorized');
  const check = checkInvitation(invitation, user);
  if (check !== 'ok' || !invitation) {
    return fail(INVITATION_CHECK_MESSAGES[check === 'ok' ? 'not_found' : check]);
  }
  const [inviter, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: invitation.inviterId }, select: { name: true } }),
    prisma.member.findFirst({
      where: { userId, organizationId: invitation.organizationId },
      select: { id: true },
    }),
  ]);
  return {
    ok: true,
    data: {
      id: invitation.id,
      organizationName: invitation.organization.name,
      organizationType: invitation.organization.type,
      role: parseOrgRole(invitation.role) ?? 'member',
      inviterName: inviter?.name ?? null,
      expiresAt: invitation.expiresAt,
      alreadyMember: Boolean(existing),
    },
  };
}

/**
 * Accept an invitation: only the recipient (same email, any case), only while it is pending
 * and unexpired. Creates the membership with the invited role and marks the invitation
 * accepted, in one transaction. Accepting twice is harmless.
 */
export async function acceptInvitation(
  userId: string,
  invitationId: string
): Promise<Result<{ organizationId: string }>> {
  const [user, invitation] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, organizationId: true },
    }),
  ]);
  if (!user) return fail('Unauthorized');
  const check = checkInvitation(invitation, user);
  if (check !== 'ok' || !invitation) {
    return fail(INVITATION_CHECK_MESSAGES[check === 'ok' ? 'not_found' : check]);
  }

  const role = parseOrgRole(invitation.role) ?? 'member';
  const accepted = await prisma.$transaction(async (tx) => {
    // Guard against a double click or a second tab: only one request flips pending -> accepted.
    const updated = await tx.invitation.updateMany({
      where: { id: invitation.id, status: 'pending' },
      data: { status: 'accepted' },
    });
    if (updated.count === 0) return false;
    // Someone who is already a member keeps their membership and role. The unique
    // (organizationId, userId) index makes a second accept running at the same time wait and
    // then skip, instead of adding a second row.
    const joined = await tx.member.createMany({
      data: {
        id: generateRecordId('mem'),
        organizationId: invitation.organizationId,
        userId,
        role,
      },
      skipDuplicates: true,
    });
    if (joined.count > 0) {
      // A new membership starts with nothing shared. A share that raced an earlier removal or
      // leave would otherwise reappear in the group's feed without being shared again.
      await unshareJournalEntries(tx, userId, invitation.organizationId);
    }
    return true;
  });
  if (!accepted) return fail(INVITATION_CHECK_MESSAGES.not_pending);
  return { ok: true, data: { organizationId: invitation.organizationId } };
}

/** Decline an invitation addressed to the signed-in user. */
export async function declineInvitation(
  userId: string,
  invitationId: string
): Promise<Result<null>> {
  const [user, invitation] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    prisma.invitation.findUnique({
      where: { id: invitationId },
      select: { id: true, email: true, status: true, expiresAt: true },
    }),
  ]);
  if (!user) return fail('Unauthorized');
  const check = checkInvitation(invitation, user);
  if (check !== 'ok' || !invitation) {
    return fail(INVITATION_CHECK_MESSAGES[check === 'ok' ? 'not_found' : check]);
  }
  await prisma.invitation.updateMany({
    where: { id: invitation.id, status: 'pending' },
    data: { status: 'rejected' },
  });
  return { ok: true, data: null };
}

async function loadTargetMember(memberId: string) {
  return prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, organizationId: true, role: true },
  });
}

/** Change a member's role (see checkRoleChange for who may do what). */
export async function updateMemberRole(
  userId: string,
  memberId: string,
  newRole: AssignableRole
): Promise<Result<{ organizationId: string }>> {
  const target = await loadTargetMember(memberId);
  if (!target) return fail('Member not found');
  const actor = await getMembershipIn(userId, target.organizationId);
  if (!actor) return fail('Member not found');
  const check = checkRoleChange({
    actorRole: actor.role,
    actorIsTarget: target.userId === userId,
    targetRole: parseOrgRole(target.role),
    newRole,
  });
  if (!check.ok) return fail(check.error);
  // Only while the target still has the role checked above. Postgres re-checks the condition
  // after waiting for a concurrent transfer, so a member who just became owner keeps it.
  const updated = await prisma.member.updateMany({
    where: { id: target.id, role: target.role },
    data: { role: newRole },
  });
  if (updated.count === 0) return fail(MEMBERSHIP_CHANGED_ERROR);
  return { ok: true, data: { organizationId: target.organizationId } };
}

/** The owner makes another member the owner and becomes an admin. Atomic, so there is always an owner. */
export async function transferOwnership(
  userId: string,
  memberId: string
): Promise<Result<{ organizationId: string }>> {
  const target = await loadTargetMember(memberId);
  if (!target) return fail('Member not found');
  const actor = await prisma.member.findFirst({
    where: { userId, organizationId: target.organizationId },
    select: { id: true, role: true },
  });
  if (!actor) return fail('Member not found');
  const check = checkOwnershipTransfer({
    actorRole: parseOrgRole(actor.role),
    actorIsTarget: target.userId === userId,
  });
  if (!check.ok) return fail(check.error);
  try {
    await prisma.$transaction(async (tx) => {
      // Both writes apply only to the roles checked above. If either changed in the meantime
      // (a second transfer, a role change, a removal), the transaction rolls back.
      const demoted = await tx.member.updateMany({
        where: { id: actor.id, role: actor.role },
        data: { role: 'admin' },
      });
      if (demoted.count === 0) throw new MembershipChangedError();
      const promoted = await tx.member.updateMany({
        where: { id: target.id, role: target.role },
        data: { role: 'owner' },
      });
      if (promoted.count === 0) throw new MembershipChangedError();
    });
  } catch (error) {
    if (error instanceof MembershipChangedError) return fail(MEMBERSHIP_CHANGED_ERROR);
    throw error;
  }
  return { ok: true, data: { organizationId: target.organizationId } };
}

/**
 * Remove someone from an organization. Owners only; owners themselves cannot be removed.
 * Someone removed from their only space gets a new household of their own.
 */
export async function removeMember(
  userId: string,
  memberId: string
): Promise<Result<{ organizationId: string; removedUserId: string }>> {
  const target = await loadTargetMember(memberId);
  if (!target) return fail('Member not found');
  const actor = await getMembershipIn(userId, target.organizationId);
  if (!actor) return fail('Member does not belong to your household');
  const check = checkMemberRemoval({
    actorRole: actor.role,
    actorIsTarget: target.userId === userId,
    targetRole: parseOrgRole(target.role),
  });
  if (!check.ok) return fail(check.error);
  const removed = await prisma.$transaction(async (tx) => {
    // Waits for the target leaving another space at the same time, so the count below holds.
    await lockUserMemberships(tx, target.userId);
    // Only while the target still has the role checked above: someone who just became owner
    // through a concurrent transfer is not removed.
    const deleted = await tx.member.deleteMany({ where: { id: target.id, role: target.role } });
    if (deleted.count === 0) return false;
    await unshareJournalEntries(tx, target.userId, target.organizationId);
    // Nobody is left without a space: someone removed from their last one gets a new, empty
    // household of their own, never their old personal household (it may be someone else's now).
    const remaining = await tx.member.count({ where: { userId: target.userId } });
    if (remaining === 0) {
      const removedUser = await tx.user.findUnique({
        where: { id: target.userId },
        select: { id: true, name: true },
      });
      if (removedUser) await createPersonalHousehold(tx, removedUser);
    }
    return true;
  });
  if (!removed) return fail(MEMBERSHIP_CHANGED_ERROR);
  return {
    ok: true,
    data: { organizationId: target.organizationId, removedUserId: target.userId },
  };
}

/** Leave an organization. The last owner transfers ownership first; nobody leaves their only one. */
export async function leaveOrganization(
  userId: string,
  organizationId: string
): Promise<Result<{ organizationId: string }>> {
  const membership = await getMembershipIn(userId, organizationId);
  if (!membership) return fail('You are not a member of this space.');
  return prisma.$transaction(async (tx): Promise<Result<{ organizationId: string }>> => {
    // The checks run under the user's and the organization's lock, in the transaction that
    // deletes. Two leaves at once (two tabs, or two owners) then see each other's result, so
    // nobody is left without a space and no organization is left without an owner.
    await lockUserMemberships(tx, userId);
    await lockOrganizationMembers(tx, organizationId);
    const own = await tx.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { id: true, role: true },
    });
    if (!own) return fail('You are not a member of this space.');
    const ownerCount = await countOwners(tx, organizationId);
    const membershipCount = await tx.member.count({ where: { userId } });
    const check = checkLeave({
      role: parseOrgRole(own.role) ?? 'viewer',
      ownerCount,
      membershipCount,
    });
    if (!check.ok) return fail(check.error);
    // Only while the role is the one checked: someone just made owner must transfer first.
    const deleted = await tx.member.deleteMany({ where: { id: own.id, role: own.role } });
    if (deleted.count === 0) return fail(MEMBERSHIP_CHANGED_ERROR);
    await unshareJournalEntries(tx, userId, organizationId);
    return { ok: true, data: { organizationId } };
  });
}

function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'space';
}

/** Create an organization of the given type; the creator becomes its owner. */
export async function createOrganization(
  userId: string,
  input: { name: string; type: OrganizationType }
): Promise<Result<{ organizationId: string }>> {
  const organizationId = generateRecordId('org');
  const slug = `${slugify(input.name)}-${randomBytes(4).toString('hex')}`;
  await prisma.$transaction([
    prisma.organization.create({
      data: { id: organizationId, name: input.name, slug, type: input.type },
    }),
    prisma.member.create({
      data: { id: generateRecordId('mem'), organizationId, userId, role: 'owner' },
    }),
  ]);
  return { ok: true, data: { organizationId } };
}
