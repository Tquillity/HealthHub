'use client';

/**
 * "Download Clinical Summary" button and its export settings dialog.
 *
 * The server action returns only the sections the user ticks (enforced server-side).
 * The PDF module, and with it @react-pdf/renderer, is imported only when the user
 * presses Download; the PDF is built in the browser and handed straight to the
 * download. Nothing is stored: not the report, not the settings.
 */

import { useId, useRef, useState } from 'react';
import { Check, FileDown, Loader2, Minus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { generateClinicalReport } from '@/actions/clinical-report-actions';
import {
  REPORT_MONTH_OPTIONS,
  reportRange,
  type ReportMonths,
} from '@/lib/clinical-report';
import { formatDateRange } from '@/lib/clinical-report-format';
import {
  describeReportContents,
  NEVER_INCLUDED,
  type ReportToggles,
} from '@/lib/clinical-report-preview';
import { localDateKey } from '@/lib/quick-log-input';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/** Private by default: name and notes stay out until the user adds them. */
const DEFAULT_TOGGLES: ReportToggles = {
  includeName: false,
  includeBbt: true,
  includeSymptoms: true,
  includeVitals: false,
  includeNotes: false,
};
const DEFAULT_MONTHS: ReportMonths = 6;

/** Keep the object URL long enough for every browser to start the download. */
const REVOKE_URL_AFTER_MS = 10_000;

const TOGGLES: { key: keyof ReportToggles; label: string; hint: string }[] = [
  {
    key: 'includeBbt',
    label: 'Basal body temperature (BBT)',
    hint: 'Daily waking temperatures, ovulation confirmed by a temperature rise, and averages by phase.',
  },
  {
    key: 'includeSymptoms',
    label: 'Symptoms, mood and energy',
    hint: 'How often each symptom shows up in each phase, and which ones tend to appear together.',
  },
  {
    key: 'includeVitals',
    label: 'Vitals',
    hint: 'Average resting heart rate, HRV and sleep in each phase.',
  },
  {
    key: 'includeNotes',
    label: 'Journal notes and tags',
    hint: 'Your own words, shortened, with symptom notes if Symptoms is ticked too. Add them only if you are happy for someone else to read them.',
  },
  {
    key: 'includeName',
    label: 'Your name',
    hint: 'Off by default, so the PDF does not identify you if it is passed on.',
  },
];

const VITALS_OFF_HINT =
  'Turn on vitals tracking in your profile to include these.';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_AFTER_MS);
}

export function ClinicalReportExport({
  vitalsAvailable,
}: {
  /** The profile's vitals opt-in; without it the server leaves vitals out. */
  vitalsAvailable: boolean;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState<ReportMonths>(DEFAULT_MONTHS);
  const [toggles, setToggles] = useState<ReportToggles>(DEFAULT_TOGGLES);
  const [today, setToday] = useState(() => localDateKey());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Closing the dialog cancels a download that is still being prepared.
  const request = useRef(0);
  const id = useId();

  const effectiveToggles: ReportToggles = {
    ...toggles,
    includeVitals: toggles.includeVitals && vitalsAvailable,
  };
  const preview = describeReportContents(effectiveToggles, { vitalsAvailable });
  const range = reportRange(today, months);

  const openDialog = () => {
    // The viewer's own calendar day: the server's "today" is UTC.
    setToday(localDateKey());
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    request.current += 1;
    setGenerating(false);
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (generating) return;
    const current = ++request.current;
    setGenerating(true);
    setError(null);
    try {
      const [result, pdfModule] = await Promise.all([
        generateClinicalReport({
          months,
          ...effectiveToggles,
          today: localDateKey(),
        }),
        import('./clinical-report-pdf-render'),
      ]);
      if (current !== request.current) return;
      if (!result.success) {
        setError(result.error);
        return;
      }
      const blob = await pdfModule.renderClinicalReportPdf(result.data);
      if (current !== request.current) return;
      downloadBlob(
        blob,
        `healthhub-clinical-summary-${result.data.meta.rangeEnd}.pdf`
      );
      setOpen(false);
      showToast('Your clinical summary is downloading.', 'success');
    } catch {
      // No details: the error could carry report contents.
      if (current === request.current) {
        setError('We could not create the PDF. Please try again.');
      }
    } finally {
      if (current === request.current) setGenerating(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={openDialog}
        aria-haspopup="dialog"
        className="min-h-[44px] min-w-[44px] gap-2 border-2 border-gray-300 bg-white"
      >
        <FileDown className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only font-medium sm:not-sr-only">
          Download Clinical Summary
        </span>
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto p-5 sm:p-6">
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close"
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <DialogHeader>
            <DialogTitle className="pr-10">Download Clinical Summary</DialogTitle>
            <DialogDescription>
              A PDF overview of your cycle to share with a doctor or other
              clinician. It is created on your device and not saved by HealthHub.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            aria-busy={generating}
            className="flex flex-col gap-6"
          >
            <fieldset className="flex flex-col gap-2" disabled={generating}>
              <legend className="mb-2 text-sm font-semibold text-gray-900">
                Time range
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {REPORT_MONTH_OPTIONS.map((option) => {
                  const inputId = `${id}-months-${option}`;
                  return (
                    <div key={option}>
                      <input
                        type="radio"
                        id={inputId}
                        name={`${id}-months`}
                        value={option}
                        checked={months === option}
                        onChange={() => setMonths(option)}
                        className="peer sr-only"
                      />
                      <label
                        htmlFor={inputId}
                        className="flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border-2 border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 peer-checked:border-primary-500 peer-checked:bg-primary-50 peer-checked:text-primary-700 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2"
                      >
                        {option} months
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                {formatDateRange(range.start, range.end)}
              </p>
            </fieldset>

            <fieldset className="flex flex-col gap-1" disabled={generating}>
              <legend className="mb-2 text-sm font-semibold text-gray-900">
                What to include
              </legend>
              {TOGGLES.map((toggle) => {
                const unavailable =
                  toggle.key === 'includeVitals' && !vitalsAvailable;
                const inputId = `${id}-${toggle.key}`;
                const hintId = `${inputId}-hint`;
                return (
                  <div key={toggle.key} className="flex flex-col">
                    <label
                      htmlFor={inputId}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-md px-2',
                        unavailable
                          ? 'cursor-not-allowed text-gray-400'
                          : 'cursor-pointer text-gray-900 hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        id={inputId}
                        checked={effectiveToggles[toggle.key]}
                        disabled={unavailable}
                        aria-describedby={hintId}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setToggles((previous) => ({
                            ...previous,
                            [toggle.key]: checked,
                          }));
                        }}
                        className="h-5 w-5 shrink-0 accent-primary-600"
                      />
                      <span className="text-sm font-medium">{toggle.label}</span>
                    </label>
                    <p id={hintId} className="pb-1 pl-10 pr-2 text-xs text-gray-500">
                      {unavailable ? VITALS_OFF_HINT : toggle.hint}
                    </p>
                  </div>
                );
              })}
            </fieldset>

            <section
              aria-labelledby={`${id}-preview`}
              className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex flex-col gap-2">
                <h3
                  id={`${id}-preview`}
                  className="text-sm font-semibold text-gray-900"
                >
                  Your PDF will include
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {preview.included.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {preview.leftOut.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Left out</h3>
                  <ul className="flex flex-col gap-1.5">
                    {preview.leftOut.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-gray-500"
                      >
                        <Minus
                          className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-gray-500">{NEVER_INCLUDED}</p>
            </section>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <p role="status" className="sr-only">
              {generating ? 'Preparing your PDF…' : ''}
            </p>

            <DialogFooter className="mt-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={generating} className="gap-2">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Preparing PDF…
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Download PDF
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
