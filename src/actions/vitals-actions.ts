'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSessionUserId } from '@/lib/session';
import { safeErrorLabel } from '@/lib/safe-error';
import {
  BbtReadingInputSchema,
  DayInputSchema,
  VitalsInputSchema,
  VitalsPreferencesSchema,
  type BbtReadingInput,
  type VitalsInput,
  type VitalsPreferencesInput,
} from '@/lib/validation/vitals-schemas';
import {
  clearBbtData,
  clearVitalsData,
  getDailyMetrics,
  saveBbtReading,
  saveVitals,
  updateVitalsPreferences as savePreferences,
  VitalsNotEnabledError,
  type DailyMetrics,
  type VitalsPreferences,
} from '@/lib/daily-metrics';

/**
 * Quick-log actions for BBT, cervical mucus and vitals. Thin wrappers: validate, resolve
 * the signed-in user, call lib/daily-metrics. They upsert only their own journal fields
 * (never `logJournalEntry`, which replaces list fields that are left out).
 *
 * Errors are logged by class and code only (`safeErrorLabel`): these are health data.
 */

type ActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

function validationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

function revalidateMetricPages() {
  revalidatePath('/cycle');
  revalidatePath('/dashboard');
  revalidatePath('/journal');
  revalidatePath('/profile');
}

/** Saves (or clears with `null`) one day's BBT and/or cervical mucus. */
export async function logBbtReading(
  input: BbtReadingInput
): Promise<ActionResult<DailyMetrics>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = BbtReadingInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await saveBbtReading(auth.userId, parsed.data);
    revalidateMetricPages();
    return { success: true, data };
  } catch (error) {
    console.error(
      '[vitals] Failed to save temperature reading:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to save your temperature' };
  }
}

/** Saves (or clears with `null`) one day's resting heart rate, HRV and sleep quality. */
export async function logVitals(
  input: VitalsInput
): Promise<ActionResult<DailyMetrics>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = VitalsInputSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await saveVitals(auth.userId, parsed.data);
    revalidateMetricPages();
    return { success: true, data };
  } catch (error) {
    if (error instanceof VitalsNotEnabledError) {
      return { success: false, error: error.message };
    }
    console.error('[vitals] Failed to save vitals:', safeErrorLabel(error));
    return { success: false, error: 'Failed to save your vitals' };
  }
}

/** One day's quick-log values, for when the user picks another day in a quick-log form. */
export async function getDailyLog(
  date: string
): Promise<ActionResult<DailyMetrics>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = DayInputSchema.safeParse({ date });
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    return {
      success: true,
      data: await getDailyMetrics(auth.userId, parsed.data.date),
    };
  } catch (error) {
    console.error('[vitals] Failed to load daily log:', safeErrorLabel(error));
    return { success: false, error: 'Failed to load that day' };
  }
}

/** Vitals opt-in and preferred temperature unit. */
export async function updateVitalsPreferences(
  input: VitalsPreferencesInput
): Promise<ActionResult<VitalsPreferences>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = VitalsPreferencesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: validationError(parsed.error) };
    }
    const data = await savePreferences(auth.userId, parsed.data);
    revalidateMetricPages();
    return { success: true, data };
  } catch (error) {
    console.error(
      '[vitals] Failed to update preferences:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to save your preference' };
  }
}

/** Clears resting heart rate, HRV and sleep quality on all of the user's journal days. */
export async function deleteAllVitalsData(): Promise<
  ActionResult<{ clearedDays: number }>
> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const clearedDays = await clearVitalsData(auth.userId);
    revalidateMetricPages();
    return { success: true, data: { clearedDays } };
  } catch (error) {
    console.error(
      '[vitals] Failed to delete vitals data:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to delete your vitals data' };
  }
}

/** Clears BBT and cervical mucus on all of the user's journal days. */
export async function deleteAllTemperatureData(): Promise<
  ActionResult<{ clearedDays: number }>
> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const clearedDays = await clearBbtData(auth.userId);
    revalidateMetricPages();
    return { success: true, data: { clearedDays } };
  } catch (error) {
    console.error(
      '[vitals] Failed to delete temperature data:',
      safeErrorLabel(error)
    );
    return { success: false, error: 'Failed to delete your temperature data' };
  }
}
