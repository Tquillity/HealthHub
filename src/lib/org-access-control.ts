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

/**
 * The plugin's HTTP endpoints that change organizations, members or invitations. HealthHub
 * does these through its Server Actions (src/actions/household-actions.ts), which add rules
 * the plugin does not know: the viewer role, owner protection, organization types and
 * unsharing journal entries when someone leaves. Keeping these paths off the public router
 * stops a client from going around those rules. Server-side `auth.api.*` calls still work.
 */
export const DISABLED_ORGANIZATION_PATHS = [
  '/organization/create',
  '/organization/update',
  '/organization/delete',
  '/organization/set-active',
  '/organization/invite-member',
  '/organization/cancel-invitation',
  '/organization/accept-invitation',
  '/organization/reject-invitation',
  '/organization/remove-member',
  '/organization/update-member-role',
  '/organization/leave',
];
