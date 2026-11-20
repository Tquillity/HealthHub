import {
  resolveReportInclusion,
  type ReportToggles,
} from '@/lib/clinical-report';

/**
 * Plain-language list of what a clinical summary will contain, for the export dialog.
 * Built from `resolveReportInclusion`, the rule the server loads data by
 * (lib/clinical-report-data): cycle figures always, every other section only when its
 * toggle is on, vitals only with the vitals opt-in from the profile, and symptom notes
 * only with both symptoms and notes.
 */

export type { ReportToggles };

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
  const include = resolveReportInclusion(toggles, { vitalsAvailable });
  const included = [
    'Cycle start dates and lengths, with the average, range and variability',
    'Time in each phase and a cycle regularity indicator',
  ];
  const leftOut: string[] = [];
  const add = (on: boolean, whenOn: string, whenOff: string) => {
    if (on) included.push(whenOn);
    else leftOut.push(whenOff);
  };

  add(include.name, 'Your name in the header', 'Your name');
  add(
    include.bbt,
    'Waking temperatures (BBT) with confirmed ovulation days',
    'Waking temperatures (BBT)'
  );
  add(
    include.symptoms,
    'Symptom frequency by phase, symptoms that occur together, and mood and energy',
    'Symptoms, mood and energy'
  );
  add(
    include.vitals,
    'Resting heart rate, HRV and sleep averages by phase',
    'Vitals (heart rate, HRV and sleep)'
  );
  add(
    include.notes,
    'Your journal notes and tags, shortened',
    'Journal notes and tags'
  );
  add(
    include.symptomNotes,
    'Your symptom notes, shortened',
    'Symptom notes (need both Symptoms and Journal notes ticked)'
  );
  return { included, leftOut };
}
