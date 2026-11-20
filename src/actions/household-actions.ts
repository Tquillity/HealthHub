'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireSessionUserId } from '@/lib/session';
import {
  clearActiveOrganizationCookie,
  getActiveMembership,
  setActiveOrganizationCookie,
} from '@/lib/active-organization';
import {
  acceptInvitation as acceptInvitationForUser,
  cancelInvitation,
  createOrganization as createOrganizationForUser,
  declineInvitation as declineInvitationForUser,
  getHouseholdData as getHouseholdDataForUser,
  inviteMember as inviteMemberForUser,
  leaveOrganization as leaveOrganizationForUser,
  removeMember as removeMemberForUser,
  transferOwnership as transferOwnershipForUser,
  updateMemberRole as updateMemberRoleForUser,
  type AuthInvitationCreator,
} from '@/lib/household-management';
import { InvitationIdSchema, invitePath } from '@/lib/invitations';
import { ASSIGNABLE_ROLES } from '@/lib/org-roles';
import { ORGANIZATION_TYPES } from '@/lib/org-policy';

/**
 * Household (organization) management. Thin wrappers: validate input with Zod, take the user
 * from the session, and let src/lib/household-management.ts check membership and roles.
 */

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T };

const IdSchema = z.string().trim().min(1).max(128);

const InviteMemberSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email('Please enter a valid email address')),
  role: z.enum(ASSIGNABLE_ROLES).default('member'),
});

const UpdateRoleSchema = z.object({
  memberId: IdSchema,
  role: z.enum(ASSIGNABLE_ROLES),
});

const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Please enter a name').max(80, 'Keep the name under 80 characters'),
  type: z.enum(ORGANIZATION_TYPES),
});

function validationError(error: z.ZodError): string {
  return error.issues[0]?.message || 'Validation failed';
}

/** Household pages and the org switcher in the layout read membership data. */
function revalidateHousehold() {
  revalidatePath('/profile/household');
  revalidatePath('/', 'layout');
}

export async function getHouseholdData() {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const result = await getHouseholdDataForUser(authResult.userId);
    if (!result.ok) return { success: false, error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[HealthHub action] household getHouseholdData failed:', error);
    return { success: false, error: 'Failed to load household' };
  }
}

/** Better-Auth's organization plugin first; it refuses while its schema columns are missing. */
async function createInvitationWithAuth(
  requestHeaders: Headers
): Promise<AuthInvitationCreator> {
  return async ({ email, organizationId, role }) => {
    const api = auth.api as unknown as {
      createInvitation?: (args: {
        headers: Headers;
        body: { email: string; organizationId: string; role: string };
      }) => Promise<{ id?: unknown } | null>;
    };
    if (!api.createInvitation) return null;
    const invitation = await api.createInvitation({
      headers: requestHeaders,
      body: { email, organizationId, role },
    });
    return invitation && typeof invitation.id === 'string' ? invitation.id : null;
  };
}

export async function inviteMember(
  input: z.input<typeof InviteMemberSchema>
): Promise<ActionResult<{ id: string; email: string; invitePath: string }>> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = InviteMemberSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };

    const result = await inviteMemberForUser(
      authResult.userId,
      parsed.data,
      await createInvitationWithAuth(await headers())
    );
    if (!result.ok) return { success: false, error: result.error };

    revalidatePath('/profile/household');
    return {
      success: true,
      data: {
        id: result.data.id,
        email: result.data.email,
        invitePath: invitePath(result.data.id),
      },
    };
  } catch (error) {
    console.error('[HealthHub action] household inviteMember failed:', error);
    return { success: false, error: 'Failed to create the invitation' };
  }
}

/** Cancel a pending invitation (owners and admins). */
export async function deleteInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = InvitationIdSchema.safeParse(invitationId);
    if (!parsed.success) return { success: false, error: 'Invitation not found' };

    const result = await cancelInvitation(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    revalidatePath('/profile/household');
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household deleteInvitation failed:', error);
    return { success: false, error: 'Failed to cancel the invitation' };
  }
}

/** Accept an invitation addressed to the signed-in user; that organization becomes active. */
export async function acceptInvitation(
  invitationId: string
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = InvitationIdSchema.safeParse(invitationId);
    if (!parsed.success) return { success: false, error: 'Invitation not found' };

    const result = await acceptInvitationForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    await setActiveOrganizationCookie(result.data.organizationId);
    revalidateHousehold();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[HealthHub action] household acceptInvitation failed:', error);
    return { success: false, error: 'Failed to accept the invitation' };
  }
}

export async function declineInvitation(invitationId: string): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = InvitationIdSchema.safeParse(invitationId);
    if (!parsed.success) return { success: false, error: 'Invitation not found' };

    const result = await declineInvitationForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    revalidatePath('/profile/household');
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household declineInvitation failed:', error);
    return { success: false, error: 'Failed to decline the invitation' };
  }
}

export async function updateMemberRole(
  input: z.input<typeof UpdateRoleSchema>
): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = UpdateRoleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };

    const result = await updateMemberRoleForUser(
      authResult.userId,
      parsed.data.memberId,
      parsed.data.role
    );
    if (!result.ok) return { success: false, error: result.error };
    revalidateHousehold();
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household updateMemberRole failed:', error);
    return { success: false, error: 'Failed to change the role' };
  }
}

export async function transferOwnership(memberId: string): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = IdSchema.safeParse(memberId);
    if (!parsed.success) return { success: false, error: 'Member not found' };

    const result = await transferOwnershipForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    revalidateHousehold();
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household transferOwnership failed:', error);
    return { success: false, error: 'Failed to transfer ownership' };
  }
}

/** Remove a member from their organization (owners only). */
export async function removeMember(memberId: string): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = IdSchema.safeParse(memberId);
    if (!parsed.success) return { success: false, error: 'Member not found' };

    const result = await removeMemberForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    revalidateHousehold();
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household removeMember failed:', error);
    return { success: false, error: 'Failed to remove member' };
  }
}

/** Leave an organization; the app switches to the user's oldest remaining one. */
export async function leaveOrganization(organizationId: string): Promise<ActionResult> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = IdSchema.safeParse(organizationId);
    if (!parsed.success) return { success: false, error: 'You are not a member of this space.' };

    const active = await getActiveMembership(authResult.userId);
    const result = await leaveOrganizationForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    if (!active || active.organizationId === parsed.data) {
      await clearActiveOrganizationCookie();
    }
    revalidateHousehold();
    return { success: true };
  } catch (error) {
    console.error('[HealthHub action] household leaveOrganization failed:', error);
    return { success: false, error: 'Failed to leave' };
  }
}

/** Create a household, collective, community or workplace; it becomes the active one. */
export async function createOrganization(
  input: z.input<typeof CreateOrganizationSchema>
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = CreateOrganizationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: validationError(parsed.error) };

    const result = await createOrganizationForUser(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    await setActiveOrganizationCookie(result.data.organizationId);
    revalidateHousehold();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[HealthHub action] household createOrganization failed:', error);
    return { success: false, error: 'Failed to create the space' };
  }
}
