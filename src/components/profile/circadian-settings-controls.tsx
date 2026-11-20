'use client';

import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/lib/store';
import {
  deleteAllTimeOfDayEnergy,
  updateCircadianPreferences,
} from '@/actions/circadian-actions';
import type { CircadianSettings } from '@/lib/circadian-data';

function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

function timeZoneText(settings: CircadianSettings): string {
  if (!settings.timeZoneValid) {
    return `Your profile time zone "${settings.timeZone}" isn't recognised, so UTC is used. Set it under Personal Information, for example Europe/Stockholm.`;
  }
  if (settings.timeZone === 'UTC') {
    return 'Times follow your profile time zone, currently UTC. If you live somewhere else, set it under Personal Information (for example Europe/Stockholm) so morning and evening match your day.';
  }
  return `Times follow your profile time zone: ${settings.timeZone}.`;
}

export function CircadianSettingsControls({
  settings,
}: {
  settings: CircadianSettings;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const id = useId();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [saving, setSaving] = useState(false);
  const [loggedDays, setLoggedDays] = useState(settings.loggedDays);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changeEnabled = async (next: boolean) => {
    setEnabled(next);
    setSaving(true);
    const result = await updateCircadianPreferences({ enabled: next });
    setSaving(false);
    if (result.success) {
      showToast(
        next ? 'Circadian insights are on' : 'Circadian insights are off',
        'success'
      );
    } else {
      setEnabled(!next);
      showToast(result.error, 'error');
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const result = await deleteAllTimeOfDayEnergy();
    setDeleting(false);
    setConfirming(false);
    if (result.success) {
      setLoggedDays(0);
      showToast('Your energy check-ins were deleted', 'success');
    } else {
      showToast(result.error, 'error');
    }
  };

  const hintId = `${id}-circadian-hint`;
  const zoneId = `${id}-circadian-zone`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            id={`${id}-enable-circadian`}
            name="enable-circadian-insights"
            checked={enabled}
            disabled={saving}
            aria-describedby={`${hintId} ${zoneId}`}
            onChange={(e) => void changeEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
          />
          <label
            htmlFor={`${id}-enable-circadian`}
            className="text-sm font-medium text-gray-700"
          >
            Show circadian insights
          </label>
        </div>
        <p id={hintId} className="pl-7 text-xs text-gray-500">
          Adds a time-of-day card with a quick energy check-in to your
          dashboard, morning, afternoon and evening energy to your journal, and
          leans the routine lottery towards routines that suit the time of day.
          Turning it off hides all of this and stops new check-ins; saved
          check-ins stay until you delete them below.
        </p>
        <p id={zoneId} className="pl-7 text-xs text-gray-500">
          {timeZoneText(settings)}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-200 pt-6">
        {confirming ? (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              This clears morning, afternoon and evening energy from every
              journal day. Your daily energy rating and the rest of your journal
              stay; days with nothing else logged are removed. This cannot be
              undone. It affects {dayCount(loggedDays)}.
            </p>
            <div className="flex flex-wrap gap-6">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={() => void confirmDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete all energy check-ins'}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={loggedDays === 0}
              onClick={() => setConfirming(true)}
              className="text-red-700"
            >
              Delete all energy check-ins ({dayCount(loggedDays)})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
