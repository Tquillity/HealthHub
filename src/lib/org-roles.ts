/**
 * Roles inside an organization (household, collective, community, company).
 *
 * Stored in `member.role` by the Better-Auth organization plugin. From most to least access:
 * - owner: everything, including roles and ownership. Every organization keeps an owner.
 * - admin: invites people, sets member/viewer roles, edits shared plans and lists.
 * - member: edits shared meal plans, groceries, routines and templates.
 * - viewer: read-only. Sees what the organization shares but cannot change it.
 *
 * Pure functions only, so the rules are unit-tested (org-roles.test.ts) and shared by the
 * server actions and the UI. The server actions are the gate; the UI only hides what would fail.
 */

export const ORG_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Roles that can be given through an invitation or a role change. Ownership is transferred, never assigned. */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Manages everything, including roles and ownership.',
  admin: 'Invites people and manages members and viewers.',
  member: 'Plans meals, edits groceries, routines and templates.',
  viewer: 'Can look at shared plans and lists, but not change them.',
};

const RANK: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1, viewer: 0 };

function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}

/**
 * Better-Auth can store several roles as a comma-separated list. Use the strongest known one;
 * unknown values give no role, which callers treat as read-only.
 */
export function parseOrgRole(role: string | null | undefined): OrgRole | null {
  if (!role) return null;
  const known = role
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(isOrgRole);
  if (known.length === 0) return null;
  return known.reduce((best, current) => (RANK[current] > RANK[best] ? current : best));
}

export function roleRank(role: OrgRole): number {
  return RANK[role];
}

/** Can change shared organization data (meal plans, groceries, routines, templates, recipes). */
export function canWrite(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

/** Can invite people and manage members. */
export function canManage(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/** Roles the actor may hand out in an invitation. Only an owner can make someone an admin. */
export function invitableRoles(actorRole: OrgRole | null | undefined): AssignableRole[] {
  if (actorRole === 'owner') return ['admin', 'member', 'viewer'];
  if (actorRole === 'admin') return ['member', 'viewer'];
  return [];
}

export type RuleCheck = { ok: true } | { ok: false; error: string };

const allowed: RuleCheck = { ok: true };
const denied = (error: string): RuleCheck => ({ ok: false, error });

/**
 * Role changes:
 * - Only owners and admins change roles, and nobody changes their own role.
 * - Nobody changes an owner's role (ownership moves with transferOwnership instead).
 * - Only an owner can promote to admin or change another admin.
 * - Admins may set member or viewer on members and viewers.
 */
export function checkRoleChange(input: {
  actorRole: OrgRole | null;
  actorIsTarget: boolean;
  targetRole: OrgRole | null;
  newRole: AssignableRole;
}): RuleCheck {
  const { actorRole, actorIsTarget, targetRole, newRole } = input;
  if (!canManage(actorRole)) {
    return denied('Only owners and admins can change roles.');
  }
  if (actorIsTarget) {
    return denied("You can't change your own role.");
  }
  if (targetRole === 'owner') {
    return denied("The owner's role can't be changed. The owner can transfer ownership instead.");
  }
  if (actorRole !== 'owner' && (newRole === 'admin' || targetRole === 'admin')) {
    return denied('Only the owner can make someone an admin or change an admin.');
  }
  return allowed;
}

/** Removing someone: owners only, never yourself (leave instead), never an owner. */
export function checkMemberRemoval(input: {
  actorRole: OrgRole | null;
  actorIsTarget: boolean;
  targetRole: OrgRole | null;
}): RuleCheck {
  if (input.actorRole !== 'owner') {
    return denied('Only owners can remove members.');
  }
  if (input.actorIsTarget) {
    return denied('You cannot remove yourself. Use "Leave" instead.');
  }
  if (input.targetRole === 'owner') {
    return denied('An owner cannot be removed.');
  }
  return allowed;
}

/** Ownership transfer: an owner hands it to another member, who must not already be the actor. */
export function checkOwnershipTransfer(input: {
  actorRole: OrgRole | null;
  actorIsTarget: boolean;
}): RuleCheck {
  if (input.actorRole !== 'owner') {
    return denied('Only the owner can transfer ownership.');
  }
  if (input.actorIsTarget) {
    return denied('You already own this space.');
  }
  return allowed;
}

/**
 * Leaving: nobody leaves their only organization (every feature needs one), and the last owner
 * must transfer ownership first so the organization is never left without an owner.
 */
export function checkLeave(input: {
  role: OrgRole | null;
  ownerCount: number;
  membershipCount: number;
}): RuleCheck {
  if (input.membershipCount <= 1) {
    return denied("You can't leave your only space. Create or join another one first.");
  }
  if (input.role === 'owner' && input.ownerCount <= 1) {
    return denied('Transfer ownership to someone else before you leave.');
  }
  return allowed;
}

/**
 * Order for picking a new owner when the owner's account is deleted: the highest role first
 * (admin, then member, then viewer), then whoever joined first.
 */
export function compareSuccessionCandidates(
  a: { role: string; createdAt: Date; id: string },
  b: { role: string; createdAt: Date; id: string }
): number {
  const rankA = RANK[parseOrgRole(a.role) ?? 'viewer'];
  const rankB = RANK[parseOrgRole(b.role) ?? 'viewer'];
  if (rankA !== rankB) return rankB - rankA;
  const byDate = a.createdAt.getTime() - b.createdAt.getTime();
  if (byDate !== 0) return byDate;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
