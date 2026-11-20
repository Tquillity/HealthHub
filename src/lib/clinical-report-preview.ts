import type { ClinicalReportOptions } from '@/lib/validation/clinical-report-schemas';

/**
 * Plain-language list of what a clinical summary will contain, for the export dialog.
 * Mirrors what the server includes (lib/clinical-report-data): cycle figures always,
 * every other section only when its toggle is on, and vitals only with the vitals
 * opt-in from the profile.
 */

export type ReportToggles = Omit<ClinicalReportOptions, 'months' | 'today'>;

export interface ReportPreview {
  included: string[];
  leftOut: string[];
}

/** Never part of the report, whatever the toggles say. */
export const NEVER_INCLUDED =
  'Gratitude entries, meals and the rest of your HealthHub data are never included.';

export function describeReportContents(
  toggles: ReportToggles,
  { vitalsAvailable }: { vitalsAvailable: boolean }
): ReportPreview {
  const included = [
    'Cycle start dates and lengths, with the average, range and variability',
    'Time in each phase and a cycle regularity indicator',
  ];
  const leftOut: string[] = [];
  const add = (on: boolean, whenOn: string, whenOff: string) => {
    if (on) included.push(whenOn);
    else leftOut.push(whenOff);
  };

  add(toggles.includeName, 'Your name in the header', 'Your name');
  add(
    toggles.includeBbt,
    'Waking temperatures (BBT) with confirmed ovulation days',
    'Waking temperatures (BBT)'
  );
  add(
    toggles.includeSymptoms,
    'Symptom frequency by phase, symptoms that occur together, and mood and energy',
    'Symptoms, mood and energy'
  );
  add(
    toggles.includeVitals && vitalsAvailable,
    'Resting heart rate, HRV and sleep averages by phase',
    'Vitals (heart rate, HRV and sleep)'
  );
  add(
    toggles.includeNotes,
    'Your journal notes and tags, shortened',
    'Journal notes and tags'
  );
  return { included, leftOut };
}
