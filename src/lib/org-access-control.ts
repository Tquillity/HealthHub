import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

/**
 * Better-Auth organization plugin roles: the plugin's defaults (owner, admin, member) with
 * their exact permissions, plus a read-only `viewer` with the same plugin permissions as a
 * member. Registering the role lets the plugin accept `viewer` in invitations and role
 * updates; what a viewer may do with HealthHub data is enforced in `@/lib/org-roles`.
 */
export const orgAccessControl = createAccessControl(defaultStatements);

export const orgRoles = {
  owner: orgAccessControl.newRole(ownerAc.statements),
  admin: orgAccessControl.newRole(adminAc.statements),
  member: orgAccessControl.newRole(memberAc.statements),
  viewer: orgAccessControl.newRole({ ac: ['read'] }),
};

/** Options for Better-Auth's organization plugin (used by `@/lib/auth`). */
export const organizationPluginOptions = { ac: orgAccessControl, roles: orgRoles };

/**
 * Every HTTP endpoint of the organization plugin is kept off the public router. HealthHub
 * reads and changes organizations only through its own pages and Server Actions
 * (src/actions/household-actions.ts), which add rules the plugin does not know: the viewer
 * role, owner protection, organization types and unsharing journal entries when someone
 * leaves. The browser auth client has no organization plugin, so nothing calls these paths.
 *
 * - Write endpoints would let a client go around those rules.
 * - Read endpoints would show every member the pending invitations (with invitee emails)
 *   that the app shows only to owners and admins, and several of them rely on
 *   `session.activeOrganizationId`, which HealthHub does not use (the active space is a cookie).
 *
 * Server-side `auth.api.*` calls (such as `createInvitation`) still work. Team and dynamic
 * role endpoints are listed too, so turning those features on later cannot expose them.
 */
export const DISABLED_ORGANIZATION_PATHS = [
  // Organizations
  '/organization/create',
  '/organization/update',
  '/organization/delete',
  '/organization/set-active',
  '/organization/list',
  '/organization/get-full-organization',
  '/organization/check-slug',
  '/organization/has-permission',
  // Invitations
  '/organization/invite-member',
  '/organization/cancel-invitation',
  '/organization/accept-invitation',
  '/organization/reject-invitation',
  '/organization/get-invitation',
  '/organization/list-invitations',
  '/organization/list-user-invitations',
  // Members
  '/organization/add-member',
  '/organization/remove-member',
  '/organization/update-member-role',
  '/organization/leave',
  '/organization/list-members',
  '/organization/get-active-member',
  '/organization/get-active-member-role',
  // Teams (off in our config)
  '/organization/create-team',
  '/organization/update-team',
  '/organization/remove-team',
  '/organization/list-teams',
  '/organization/set-active-team',
  '/organization/list-user-teams',
  '/organization/list-team-members',
  '/organization/add-team-member',
  '/organization/remove-team-member',
  // Dynamic roles (off in our config)
  '/organization/create-role',
  '/organization/delete-role',
  '/organization/list-roles',
  '/organization/get-role',
  '/organization/update-role',
];
