import { describe, expect, it } from 'vitest';
import {
  canManage,
  canWrite,
  checkLeave,
  checkMemberRemoval,
  checkOwnershipTransfer,
  checkRoleChange,
  compareSuccessionCandidates,
  invitableRoles,
  parseOrgRole,
  type AssignableRole,
  type OrgRole,
} from './org-roles';

describe('parseOrgRole', () => {
  it('reads known roles case-insensitively', () => {
    expect(parseOrgRole('owner')).toBe('owner');
    expect(parseOrgRole(' Viewer ')).toBe('viewer');
  });

  it('uses the strongest of several Better-Auth roles', () => {
    expect(parseOrgRole('member,admin')).toBe('admin');
    expect(parseOrgRole('viewer, owner')).toBe('owner');
  });

  it('gives no role for unknown or empty values', () => {
    expect(parseOrgRole('superadmin')).toBeNull();
    expect(parseOrgRole('')).toBeNull();
    expect(parseOrgRole(null)).toBeNull();
  });
});

describe('permission helpers', () => {
  it('lets owners, admins and members write; viewers are read-only', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('member')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
    expect(canWrite(null)).toBe(false);
  });

  it('lets only owners and admins manage', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('admin')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canManage('viewer')).toBe(false);
  });

  it('lets only owners invite admins', () => {
    expect(invitableRoles('owner')).toEqual(['admin', 'member', 'viewer']);
    expect(invitableRoles('admin')).toEqual(['member', 'viewer']);
    expect(invitableRoles('member')).toEqual([]);
    expect(invitableRoles('viewer')).toEqual([]);
  });
});

describe('checkRoleChange', () => {
  const change = (
    actorRole: OrgRole,
    targetRole: OrgRole,
    newRole: AssignableRole,
    actorIsTarget = false
  ) => checkRoleChange({ actorRole, targetRole, newRole, actorIsTarget }).ok;

  it('only an owner can promote to admin', () => {
    expect(change('owner', 'member', 'admin')).toBe(true);
    expect(change('admin', 'member', 'admin')).toBe(false);
  });

  it('nobody changes the owner', () => {
    expect(change('owner', 'owner', 'member')).toBe(false);
    expect(change('admin', 'owner', 'viewer')).toBe(false);
  });

  it('admins may set member or viewer, but not touch other admins', () => {
    expect(change('admin', 'member', 'viewer')).toBe(true);
    expect(change('admin', 'viewer', 'member')).toBe(true);
    expect(change('admin', 'admin', 'member')).toBe(false);
    expect(change('owner', 'admin', 'member')).toBe(true);
  });

  it('members and viewers cannot change roles, and nobody changes their own', () => {
    expect(change('member', 'viewer', 'member')).toBe(false);
    expect(change('viewer', 'member', 'viewer')).toBe(false);
    expect(change('admin', 'admin', 'viewer', true)).toBe(false);
  });
});

describe('removal, transfer and leaving', () => {
  it('only owners remove, never themselves or another owner', () => {
    expect(checkMemberRemoval({ actorRole: 'owner', actorIsTarget: false, targetRole: 'admin' }).ok).toBe(true);
    expect(checkMemberRemoval({ actorRole: 'admin', actorIsTarget: false, targetRole: 'member' }).ok).toBe(false);
    expect(checkMemberRemoval({ actorRole: 'owner', actorIsTarget: true, targetRole: 'owner' }).ok).toBe(false);
    expect(checkMemberRemoval({ actorRole: 'owner', actorIsTarget: false, targetRole: 'owner' }).ok).toBe(false);
  });

  it('only the owner transfers ownership, to someone else', () => {
    expect(checkOwnershipTransfer({ actorRole: 'owner', actorIsTarget: false }).ok).toBe(true);
    expect(checkOwnershipTransfer({ actorRole: 'admin', actorIsTarget: false }).ok).toBe(false);
    expect(checkOwnershipTransfer({ actorRole: 'owner', actorIsTarget: true }).ok).toBe(false);
  });

  it('never leaves an organization without an owner or a user without one', () => {
    expect(checkLeave({ role: 'member', ownerCount: 1, membershipCount: 2 }).ok).toBe(true);
    expect(checkLeave({ role: 'viewer', ownerCount: 1, membershipCount: 1 }).ok).toBe(false);
    expect(checkLeave({ role: 'owner', ownerCount: 1, membershipCount: 3 })).toEqual({
      ok: false,
      error: 'Transfer ownership to someone else before you leave.',
    });
    expect(checkLeave({ role: 'owner', ownerCount: 2, membershipCount: 3 }).ok).toBe(true);
  });
});

describe('compareSuccessionCandidates', () => {
  it('prefers the highest role, then the longest-standing member', () => {
    const candidates = [
      { id: 'v', role: 'viewer', createdAt: new Date('2025-01-01') },
      { id: 'm2', role: 'member', createdAt: new Date('2025-03-01') },
      { id: 'a', role: 'admin', createdAt: new Date('2025-06-01') },
      { id: 'm1', role: 'member', createdAt: new Date('2025-02-01') },
    ];
    expect([...candidates].sort(compareSuccessionCandidates).map((c) => c.id)).toEqual([
      'a',
      'm1',
      'm2',
      'v',
    ]);
  });
});
