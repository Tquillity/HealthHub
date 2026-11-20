'use server';

import { requireSessionUserId } from '@/lib/session';
import { safeErrorLabel } from '@/lib/safe-error';
import {
  ClinicalReportUnavailableError,
  loadClinicalReport,
} from '@/lib/clinical-report-data';
import type { ClinicalReport } from '@/lib/clinical-report';
import {
  ClinicalReportOptionsSchema,
  type ClinicalReportOptions,
} from '@/lib/validation/clinical-report-schemas';

type ActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

/**
 * Server Action: the signed-in user's clinical summary, with only the sections they
 * chose. Decrypts server-side and returns the figures; the PDF is drawn in the browser.
 * The report is never stored, cached or logged (errors are logged by class only).
 */
export async function generateClinicalReport(
  input: ClinicalReportOptions
): Promise<ActionResult<ClinicalReport>> {
  try {
    const auth = await requireSessionUserId();
    if (!auth.ok) return { success: false, error: auth.error };
    const parsed = ClinicalReportOptionsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Invalid report options',
      };
    }
    const data = await loadClinicalReport(auth.userId, parsed.data);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ClinicalReportUnavailableError) {
      return { success: false, error: error.message };
    }
    console.error(
      '[clinical-report] Failed to generate report:',
      safeErrorLabel(error)
    );
    return {
      success: false,
      error: 'We could not prepare your clinical summary. Please try again.',
    };
  }
}
