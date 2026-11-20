'use client';

import { useEffect, useId, useRef, useState, type Ref } from 'react';
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

/**
 * "Delete all energy check-ins?" Its buttons stay focusable while deleting (aria-disabled,
 * not disabled), so keyboard focus is not dropped; the caller ignores clicks meanwhile.
 * The group is named by the warning, so it is read out when focus moves to Cancel.
 */
export function DeleteCheckInsConfirmation({
  loggedDays,
  deleting,
  onCancel,
  onConfirm,
  cancelRef,
}: {
  loggedDays: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelRef?: Ref<HTMLButtonElement>;
}) {
  const warningId = useId();
  return (
    <div
      role="group"
      aria-labelledby={warningId}
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <p id={warningId} className="text-sm text-red-800">
        This clears morning, afternoon and evening energy from every journal
        day. Your daily energy rating and the rest of your journal stay; days
        with nothing else logged are removed. This cannot be undone. It affects{' '}
        {dayCount(loggedDays)}.
      </p>
      <div className="flex flex-wrap gap-6">
        <Button
          ref={cancelRef}
          type="button"
          variant="outline"
          aria-disabled={deleting || undefined}
          onClick={onCancel}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          aria-disabled={deleting || undefined}
          onClick={onConfirm}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete all energy check-ins'}
        </Button>
      </div>
    </div>
  );
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
  // Toasts are not announced, so results are also read out from this status region.
  const [status, setStatus] = useState('');
  const deleteAreaRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Opening or closing the confirmation unmounts the focused button: move focus to the
  // button that takes its place.
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (confirming ? cancelRef : triggerRef).current?.focus();
  }, [confirming]);

  const announce = (message: string, type: 'success' | 'error') => {
    setStatus(message);
    showToast(message, type);
  };

  const changeEnabled = async (next: boolean) => {
    if (saving) return;
    setEnabled(next);
    setSaving(true);
    // Cleared first, so the same result twice in a row is announced again.
    setStatus('');
    let result: Awaited<ReturnType<typeof updateCircadianPreferences>>;
    try {
      result = await updateCircadianPreferences({ enabled: next });
    } catch {
      result = { success: false, error: 'Failed to save your preference' };
    }
    setSaving(false);
    if (result.success) {
      announce(
        next ? 'Circadian insights are on' : 'Circadian insights are off',
        'success'
      );
    } else {
      setEnabled(!next);
      announce(result.error, 'error');
    }
  };

  const openConfirmation = () => {
    if (loggedDays === 0) return;
    moveFocus.current = true;
    setConfirming(true);
  };

  const cancelDelete = () => {
    if (deleting) return;
    moveFocus.current = true;
    setConfirming(false);
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setStatus('');
    let result: Awaited<ReturnType<typeof deleteAllTimeOfDayEnergy>>;
    try {
      result = await deleteAllTimeOfDayEnergy();
    } catch {
      result = {
        success: false,
        error: 'Failed to delete your energy check-ins',
      };
    }
    // Back to the delete button, unless the user has moved on meanwhile.
    moveFocus.current =
      deleteAreaRef.current?.contains(document.activeElement) ?? false;
    setDeleting(false);
    setConfirming(false);
    if (result.success) {
      setLoggedDays(0);
      announce('Your energy check-ins were deleted', 'success');
    } else {
      announce(result.error, 'error');
    }
  };

  const hintId = `${id}-circadian-hint`;
  const zoneId = `${id}-circadian-zone`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {/* The whole 44px row is the label, so a tap anywhere on it toggles the box. */}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            id={`${id}-enable-circadian`}
            name="enable-circadian-insights"
            checked={enabled}
            aria-disabled={saving || undefined}
            aria-describedby={`${hintId} ${zoneId}`}
            onChange={(e) => void changeEnabled(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600 aria-disabled:opacity-50"
          />
          <span>Show circadian insights</span>
        </label>
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

      <div
        ref={deleteAreaRef}
        className="flex flex-col gap-2 border-t border-gray-200 pt-6"
      >
        {confirming ? (
          <DeleteCheckInsConfirmation
            loggedDays={loggedDays}
            deleting={deleting}
            onCancel={cancelDelete}
            onConfirm={() => void confirmDelete()}
            cancelRef={cancelRef}
          />
        ) : (
          <div>
            {/* aria-disabled at 0 days, so focus can come back here after deleting. */}
            <Button
              ref={triggerRef}
              type="button"
              variant="outline"
              aria-disabled={loggedDays === 0 || undefined}
              onClick={openConfirmation}
              className="text-red-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Delete all energy check-ins ({dayCount(loggedDays)})
            </Button>
          </div>
        )}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}
