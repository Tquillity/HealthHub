'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSessionUserId } from '@/lib/session';
import { getActiveMembership } from '@/lib/active-organization';
import { UpdateCycleSharingSchema } from '@/lib/cycle-status-sharing';
import {
  getSupportStatusBoard,
  updateCycleSharingSettings,
  type CycleSharingSettings,
  type SupportStatusBoard,
} from '@/lib/support-status';

/**
 * Support Status for the active organization (the space picked in the sidebar): the other
 * members who chose to share their cycle status, projected on the server. Null when the user
 * has no organization.
 */
export async function getHouseholdSupportStatuses(): Promise<{
  success: boolean;
  error?: string;
  data?: SupportStatusBoard | null;
}> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };

    const membership = await getActiveMembership(authResult.userId);
    if (!membership) return { success: true, data: null };

    const board = await getSupportStatusBoard(authResult.userId, membership.organizationId);
    return { success: true, data: board };
  } catch (error) {
    // Never log status values.
    console.error(
      '[HealthHub action] getHouseholdSupportStatuses failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return { success: false, error: 'Failed to load support status' };
  }
}

/** Turn cycle status sharing on or off, change the level or the support message. */
export async function updateCycleSharing(
  input: z.input<typeof UpdateCycleSharingSchema>
): Promise<{ success: boolean; error?: string; data?: CycleSharingSettings }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };

    const parsed = UpdateCycleSharingSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' };
    }

    const settings = await updateCycleSharingSettings(authResult.userId, parsed.data);
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, data: settings };
  } catch (error) {
    // Never log the support message.
    console.error(
      '[HealthHub action] updateCycleSharing failed:',
      error instanceof Error ? error.name : 'Unknown error'
    );
    return { success: false, error: 'Failed to update sharing settings' };
  }
}
