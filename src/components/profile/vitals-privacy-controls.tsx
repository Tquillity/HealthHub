'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/store';
import {
  deleteAllTemperatureData,
  deleteAllVitalsData,
  updateVitalsPreferences,
} from '@/actions/vitals-actions';
import { TEMPERATURE_UNITS, type TemperatureUnit } from '@/lib/bbt';
import type { VitalsPrivacySummary } from '@/lib/daily-metrics';

type DeleteTarget = 'vitals' | 'temperature';

function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

export function VitalsPrivacyControls({
  summary,
}: {
  summary: VitalsPrivacySummary;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const id = useId();
  const [trackVitals, setTrackVitals] = useState(summary.trackVitals);
  const [unit, setUnit] = useState<TemperatureUnit>(summary.temperatureUnit);
  const [savingPreference, setSavingPreference] = useState(false);
  const [confirming, setConfirming] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const changeTracking = async (next: boolean) => {
    setTrackVitals(next);
    setSavingPreference(true);
    const result = await updateVitalsPreferences({ trackVitals: next });
    setSavingPreference(false);
    if (result.success) {
      showToast(
        next ? 'Vitals tracking is on' : 'Vitals tracking is off',
        'success'
      );
    } else {
      setTrackVitals(!next);
      showToast(result.error, 'error');
    }
  };

  const changeUnit = async (next: TemperatureUnit) => {
    const previous = unit;
    setUnit(next);
    setSavingPreference(true);
    const result = await updateVitalsPreferences({ temperatureUnit: next });
    setSavingPreference(false);
    if (!result.success) {
      setUnit(previous);
      showToast(result.error, 'error');
    }
  };

  const confirmDelete = async (target: DeleteTarget) => {
    setDeleting(true);
    const result =
      target === 'vitals'
        ? await deleteAllVitalsData()
        : await deleteAllTemperatureData();
    setDeleting(false);
    setConfirming(null);
    if (result.success) {
      showToast(
        target === 'vitals'
          ? 'Your vitals data was deleted'
          : 'Your temperature data was deleted',
        'success'
      );
    } else {
      showToast(result.error, 'error');
    }
  };

  const deleteOptions: {
    target: DeleteTarget;
    days: number;
    label: string;
    detail: string;
  }[] = [
    {
      target: 'vitals',
      days: summary.vitalsDays,
      label: 'Delete all vitals data',
      detail:
        'This clears resting heart rate, HRV and sleep quality from every journal day. The rest of your journal stays. This cannot be undone.',
    },
    {
      target: 'temperature',
      days: summary.bbtDays,
      label: 'Delete all temperature data',
      detail:
        'This clears waking temperature and cervical mucus from every journal day. Your period history stays. This cannot be undone.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            id={`${id}-track-vitals`}
            name="track-vitals"
            checked={trackVitals}
            disabled={savingPreference}
            onChange={(e) => void changeTracking(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
          />
          <label
            htmlFor={`${id}-track-vitals`}
            className="text-sm font-medium text-gray-700"
          >
            Track vitals (resting heart rate, HRV and sleep quality)
          </label>
        </div>
        <p className="pl-7 text-xs text-gray-500">
          Gives you a daily recovery score on the dashboard and the cycle chart.
          Turning it off stops new vitals and hides the score; saved vitals stay
          until you delete them below.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-700">
          Temperature unit
        </legend>
        <div className="flex flex-wrap gap-6">
          {TEMPERATURE_UNITS.map((option) => (
            <div key={option} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                id={`${id}-unit-${option}`}
                name="temperature-unit"
                value={option}
                checked={unit === option}
                disabled={savingPreference}
                onChange={() => void changeUnit(option)}
                className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
              />
              <label
                htmlFor={`${id}-unit-${option}`}
                className="text-sm text-gray-700"
              >
                {option === 'C' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-6 border-t border-gray-200 pt-6">
        {deleteOptions.map((option) => (
          <div key={option.target} className="flex flex-col gap-2">
            {confirming === option.target ? (
              <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">
                  {option.detail} It affects {dayCount(option.days)}.
                </p>
                <div className="flex flex-wrap gap-6">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting}
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => void confirmDelete(option.target)}
                  >
                    {deleting ? 'Deleting…' : option.label}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={option.days === 0 || confirming !== null}
                  onClick={() => setConfirming(option.target)}
                  className="text-red-700"
                >
                  {option.label} ({dayCount(option.days)})
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
