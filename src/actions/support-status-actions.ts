'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSessionUserId } from '@/lib/session';
import { getActiveMembership } from '@/lib/active-organization';
import { safeErrorLabel } from '@/lib/safe-error';
import {
  SetCycleStatusShareSchema,
  UpdateSupportMessageSchema,
} from '@/lib/cycle-status-sharing';
import {
  getSupportStatusBoard,
  setCycleStatusShare,
  updateSupportMessage,
  type CycleShareUpdate,
  type SupportStatusBoard,
} from '@/lib/support-status';

/**
 * Support Status for the active organization (the space picked in the sidebar): the other
 * members who chose to share their cycle status with the user, projected on the server. Null
 * when the user has no organization.
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
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to load support status' };
  }
}

/**
 * Start, change or stop sharing cycle status with one household: the one the Profile page
 * listed, sent back by the client and checked on the server.
 */
export async function setCycleStatusSharing(
  input: z.input<typeof SetCycleStatusShareSchema>
): Promise<{ success: boolean; error?: string; data?: CycleShareUpdate }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };

    const parsed = SetCycleStatusShareSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: 'Invalid request' };

    const result = await setCycleStatusShare(authResult.userId, parsed.data);
    if (!result.ok) return { success: false, error: result.error };
    revalidatePath('/profile');
    revalidatePath('/profile/household');
    revalidatePath('/dashboard');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[HealthHub action] setCycleStatusSharing failed:', safeErrorLabel(error));
    return { success: false, error: 'Failed to update sharing' };
  }
}

/** Save or remove the personal message shown with Full status. */
export async function saveSupportMessage(
  input: z.input<typeof UpdateSupportMessageSchema>
): Promise<{ success: boolean; error?: string; data?: { supportMessage: string | null } }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };

    const parsed = UpdateSupportMessageSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' };
    }

    const supportMessage = await updateSupportMessage(
      authResult.userId,
      parsed.data.supportMessage
    );
    revalidatePath('/profile');
    revalidatePath('/dashboard');
    return { success: true, data: { supportMessage } };
  } catch (error) {
    // Never log the support message.
    console.error('[HealthHub action] saveSupportMessage failed:', safeErrorLabel(error));
    return { success: false, error: 'Failed to save your message' };
  }
}
