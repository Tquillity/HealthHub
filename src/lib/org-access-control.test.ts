import { describe, expect, it } from 'vitest';
import { organization } from 'better-auth/plugins';
import { defaultRoles } from 'better-auth/plugins/organization/access';
import {
  DISABLED_ORGANIZATION_PATHS,
  organizationPluginOptions,
  orgRoles,
} from './org-access-control';

function endpointPaths(plugin: { endpoints: object }): string[] {
  return Object.values(plugin.endpoints as Record<string, { path?: unknown }>)
    .map((endpoint) => endpoint.path)
    .filter((path): path is string => typeof path === 'string');
}

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

  it('keeps every organization endpoint we register off the HTTP router', () => {
    const registered = endpointPaths(organization(organizationPluginOptions));
    // Reads too: list-invitations and get-full-organization would show invitee emails to
    // every member, and list-user-invitations would list invitations by an unverified email.
    expect(registered).toEqual(
      expect.arrayContaining([
        '/organization/accept-invitation',
        '/organization/list-invitations',
        '/organization/list-user-invitations',
        '/organization/get-full-organization',
        '/organization/list-members',
      ])
    );
    expect(registered.filter((path) => !DISABLED_ORGANIZATION_PATHS.includes(path))).toEqual([]);
  });

  it('also covers the team and dynamic role endpoints, should those be turned on', () => {
    const everything = endpointPaths(
      organization({
        ...organizationPluginOptions,
        teams: { enabled: true },
        dynamicAccessControl: { enabled: true },
      })
    );
    expect(everything.filter((path) => !DISABLED_ORGANIZATION_PATHS.includes(path))).toEqual([]);
  });
});
