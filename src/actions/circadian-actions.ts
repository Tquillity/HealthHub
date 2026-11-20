'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSessionUserId } from '@/lib/session';
import { safeErrorLabel } from '@/lib/safe-error';
import {
  CircadianPreferencesSchema,
  LogEnergyNowSchema,
  type CircadianPreferencesInput,
  type LogEnergyNowInput,
} from '@/lib/validation/circadian-schemas';
import {
  CircadianNotEnabledError,
  clearTimeOfDayEnergy,
  EnergyCheckInClosedError,
  saveEnergyNow,
  updateCircadianPreferences as savePreferences,
  type EnergyCheckIn,
} from '@/lib/circadian-data';

/**
 * Circadian insights actions. Thin wrappers: validate, resolve the signed-in user, call
 * lib/circadian-data. Energy check-ins write only their own journal fields (never
 * `logJournalEntry`, which replaces list fields that are left out).
 *
 * Errors are logged by class and code only (`safeErrorLabel`): these are health data.
 */

type ActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

function validationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

function revalidateCircadianPages() {
  revalidatePath('/dashboard');
  revalidatePath('/journal');
  revalidatePath('/profile');
  revalidatePath('/routines');
}

/** "How is your energy right now?": saved in the current time-of-day slot. */
export async function logEnergyNow(
  input: LogEnergyNowInput
): Promise<ActionResult<EnergyCheckIn>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = LogEnergyNowSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await saveEnergyNow(auth.userId, parsed.data.energy);
    revalidateCircadianPages();
    return { success: true, data };
  } catch (error) {
    if (
      error instanceof CircadianNotEnabledError ||
      error instanceof EnergyCheckInClosedError
    ) {
      return { success: false, error: error.message };
    }
    console.error(
      '[circadian] Failed to save an energy check-in:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to save your energy' };
  }
}

/** Turns circadian insights on or off. */
export async function updateCircadianPreferences(
  input: CircadianPreferencesInput
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = CircadianPreferencesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await savePreferences(auth.userId, parsed.data);
    revalidateCircadianPages();
    return { success: true, data };
  } catch (error) {
    console.error(
      '[circadian] Failed to update preferences:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to save your preference' };
  }
}

/** Clears morning, afternoon and evening energy on all of the user's journal days. */
export async function deleteAllTimeOfDayEnergy(): Promise<
  ActionResult<{ clearedDays: number }>
> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const clearedDays = await clearTimeOfDayEnergy(auth.userId);
    revalidateCircadianPages();
    return { success: true, data: { clearedDays } };
  } catch (error) {
    console.error(
      '[circadian] Failed to delete energy check-ins:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to delete your energy check-ins' };
  }
}
