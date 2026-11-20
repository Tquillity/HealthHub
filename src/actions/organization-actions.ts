'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSessionUserId } from '@/lib/session';
import { getMembershipIn, setActiveOrganizationCookie } from '@/lib/active-organization';

const OrganizationIdSchema = z.string().trim().min(1).max(128);

/**
 * Switch the active organization (sidebar switcher and `?org=<id>` links). The id comes from
 * the client, so it only takes effect when the signed-in user is a member.
 */
export async function switchActiveOrganization(
  organizationId: string
): Promise<{ success: boolean; error?: string; data?: { name: string } }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = OrganizationIdSchema.safeParse(organizationId);
    if (!parsed.success) {
      return { success: false, error: "You don't have access to that space." };
    }

    const membership = await getMembershipIn(authResult.userId, parsed.data);
    if (!membership) {
      return { success: false, error: "You don't have access to that space." };
    }
    await setActiveOrganizationCookie(membership.organizationId);
    // Every signed-in page reads the active organization.
    revalidatePath('/', 'layout');
    return { success: true, data: { name: membership.organization.name } };
  } catch (error) {
    console.error('[HealthHub action] switchActiveOrganization failed:', error);
    return { success: false, error: 'Failed to switch space' };
  }
}
