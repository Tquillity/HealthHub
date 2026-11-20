'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSessionUserId } from '@/lib/session';
import { DateOnlyStringSchema } from '@/lib/date-only';
import { setJournalEntrySharing, type JournalSharing } from '@/lib/journal-sharing';

const ShareJournalEntrySchema = z.object({
  date: DateOnlyStringSchema,
  /** null makes the entry private again. */
  organizationId: z.string().trim().min(1).max(128).nullable(),
});

/** Share one journal day with a household or collective, or make it private again. */
export async function shareJournalEntry(
  input: z.input<typeof ShareJournalEntrySchema>
): Promise<{ success: boolean; error?: string; data?: JournalSharing }> {
  try {
    const authResult = await requireSessionUserId();
    if (!authResult.ok) return { success: false, error: authResult.error };
    const parsed = ShareJournalEntrySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' };
    }

    const result = await setJournalEntrySharing(
      authResult.userId,
      parsed.data.date,
      parsed.data.organizationId
    );
    if (!result.ok) return { success: false, error: result.error };
    revalidatePath('/journal');
    revalidatePath('/profile/household');
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[HealthHub action] shareJournalEntry failed:', error);
    return { success: false, error: 'Failed to update sharing' };
  }
}
