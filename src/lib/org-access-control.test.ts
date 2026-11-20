import { describe, expect, it } from 'vitest';
import { defaultRoles } from 'better-auth/plugins/organization/access';
import { DISABLED_ORGANIZATION_PATHS, orgRoles } from './org-access-control';

describe('Better-Auth organization roles', () => {
  it('keeps the plugin defaults for owner, admin and member', () => {
    expect(orgRoles.owner.statements).toEqual(defaultRoles.owner.statements);
    expect(orgRoles.admin.statements).toEqual(defaultRoles.admin.statements);
    expect(orgRoles.member.statements).toEqual(defaultRoles.member.statements);
  });

  it('gives viewers no plugin permissions beyond reading roles', () => {
    expect(orgRoles.viewer.authorize({ invitation: ['create'] }).success).toBe(false);
    expect(orgRoles.viewer.authorize({ member: ['update'] }).success).toBe(false);
    expect(orgRoles.viewer.authorize({ organization: ['update'] }).success).toBe(false);
    expect(orgRoles.viewer.authorize({ ac: ['read'] }).success).toBe(true);
    expect(orgRoles.owner.authorize({ invitation: ['create'] }).success).toBe(true);
  });

  it('keeps the mutating organization endpoints off the HTTP router', () => {
    expect(DISABLED_ORGANIZATION_PATHS).toEqual(
      expect.arrayContaining([
        '/organization/accept-invitation',
        '/organization/update-member-role',
        '/organization/remove-member',
        '/organization/leave',
      ])
    );
  });
});
