import type { BriefingSettings } from '@/lib/briefing/data';
import type { BriefingPreferences } from '@/lib/briefing/types';

export type PreferenceSaveResult =
  | { success: true; data: BriefingSettings }
  | { success: false; error: string };

/** Shown when the request itself fails (for example offline). */
export const SAVE_FAILED = 'Failed to save your briefing settings';

export type PreferenceSaver = {
  /** Queues a change; it is sent now, or merged into the next request if one is running. */
  save: (patch: Partial<BriefingPreferences>) => void;
};

/**
 * Saves briefing preference changes one request at a time, without blocking the
 * controls. A change made while a save is running (for example arrow keys moving
 * through a radio group, which select as they move) is merged into the next request,
 * so the latest choice always wins and no control has to be disabled while saving.
 *
 * - `onSaving(true|false)` brackets a run of requests.
 * - `onSaved(settings, more)` follows each successful request; `more` is true when a
 *   newer change is already queued, so the caller should not show these settings yet.
 * - `onFailed(error)` ends the run; queued changes are dropped with it.
 */
export function createPreferenceSaver(handlers: {
  send: (patch: Partial<BriefingPreferences>) => Promise<PreferenceSaveResult>;
  onSaving: (saving: boolean) => void;
  onSaved: (settings: BriefingSettings, more: boolean) => void;
  onFailed: (error: string) => void;
}): PreferenceSaver {
  let queued: Partial<BriefingPreferences> | null = null;
  let running = false;

  const run = async () => {
    running = true;
    handlers.onSaving(true);
    while (queued) {
      const patch = queued;
      queued = null;
      let result: PreferenceSaveResult;
      try {
        result = await handlers.send(patch);
      } catch {
        result = { success: false, error: SAVE_FAILED };
      }
      if (!result.success) {
        queued = null;
        running = false;
        handlers.onSaving(false);
        handlers.onFailed(result.error);
        return;
      }
      handlers.onSaved(result.data, queued !== null);
    }
    running = false;
    handlers.onSaving(false);
  };

  return {
    save(patch) {
      queued = { ...queued, ...patch };
      if (!running) void run();
    },
  };
}
