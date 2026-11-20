'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSessionUserId } from '@/lib/session';
import { safeErrorLabel } from '@/lib/safe-error';
import { getDashboardHouseholdId } from '@/lib/dashboard-data';
import {
  BriefingDateError,
  dismissBriefing,
  dismissSuggestion,
  loadBriefingState,
  rateSuggestion,
  restoreBriefing,
  saveBriefingPreferences,
  type BriefingSettings,
  type BriefingState,
} from '@/lib/briefing/data';
import {
  BriefingDayInputSchema,
  BriefingPreferencesInputSchema,
  DismissSuggestionInputSchema,
  RateSuggestionInputSchema,
  type BriefingPreferencesInput,
  type DismissSuggestionInput,
  type RateSuggestionInput,
} from '@/lib/validation/briefing-schemas';

/**
 * Daily briefing actions. Thin wrappers: resolve the signed-in user (never a user id
 * from the client), validate, call lib/briefing/data. The briefing is about health
 * data, so failures are logged by error class only (`safeErrorLabel`).
 *
 * Feedback actions do not revalidate the dashboard: the card updates itself, and
 * today's feedback never reorders today's briefing.
 */

type ActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

function validationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

function failure(
  error: unknown,
  fallback: string
): { success: false; error: string } {
  if (error instanceof BriefingDateError) {
    return { success: false, error: error.message };
  }
  console.error(`[briefing] ${fallback}:`, safeErrorLabel(error));
  return { success: false, error: fallback };
}

/**
 * Today's briefing for the signed-in user: "off", "not_due", "dismissed", or "ready" with
 * the briefing. The day is the user's day in their profile timezone, as in the dashboard
 * render (never the device's), so a refresh shows the same day the page did.
 */
export async function generateDailyBriefing(): Promise<
  ActionResult<BriefingState>
> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    return {
      success: true,
      data: await loadBriefingState(auth.userId, {
        householdId: await getDashboardHouseholdId(auth.userId),
      }),
    };
  } catch (error) {
    return failure(error, 'Failed to prepare your briefing');
  }
}

/** Hides the briefing card for the day. */
export async function dismissDailyBriefing(
  date: string
): Promise<ActionResult<null>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = BriefingDayInputSchema.safeParse({ date });
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    await dismissBriefing(auth.userId, parsed.data.date);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, 'Failed to hide your briefing');
  }
}

/** Shows the briefing card again for the day (undo). */
export async function restoreDailyBriefing(
  date: string
): Promise<ActionResult<null>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = BriefingDayInputSchema.safeParse({ date });
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    await restoreBriefing(auth.userId, parsed.data.date);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, 'Failed to bring back your briefing');
  }
}

/** Hides one suggestion for the day. */
export async function dismissBriefingSuggestion(
  input: DismissSuggestionInput
): Promise<ActionResult<null>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = DismissSuggestionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    await dismissSuggestion(auth.userId, parsed.data);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, 'Failed to dismiss the suggestion');
  }
}

/** Marks a suggestion helpful or not helpful (`rating: null` clears it). */
export async function rateBriefingSuggestion(
  input: RateSuggestionInput
): Promise<ActionResult<null>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = RateSuggestionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    await rateSuggestion(auth.userId, parsed.data);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, 'Failed to save your feedback');
  }
}

/** Briefing frequency, data sources and detail level. */
export async function updateBriefingPreferences(
  input: BriefingPreferencesInput
): Promise<ActionResult<BriefingSettings>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = BriefingPreferencesInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await saveBriefingPreferences(auth.userId, parsed.data);
    revalidatePath('/dashboard');
    revalidatePath('/profile');
    return { success: true, data };
  } catch (error) {
    return failure(error, 'Failed to save your briefing settings');
  }
}
