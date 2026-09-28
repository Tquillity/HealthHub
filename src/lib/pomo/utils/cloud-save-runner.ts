/**
 * Serialized cloud save with a bounded backoff retry (TIMER-3).
 *
 * - Saves never overlap: a save requested while one is in flight runs once afterwards.
 * - A failed save is retried after each delay in `retryDelaysMs`, then it stops (no loops).
 *   The retry budget resets after a success or a manual retry.
 */

export type CloudSaveOutcome =
  | { success: true; updatedAt: string }
  | { success: false; error: string };

export const CLOUD_SAVE_RETRY_DELAYS_MS: readonly number[] = [
  2000, 5000, 15000,
];

type TimerHandle = ReturnType<typeof setTimeout>;

export interface CloudSaveRunnerOptions {
  save: () => Promise<CloudSaveOutcome>;
  /** Checked before every attempt (e.g. cloud persistence still active for this user). */
  isEnabled: () => boolean;
  onSuccess: (updatedAt: string) => void;
  onError: (error: string, retryScheduled: boolean) => void;
  retryDelaysMs?: readonly number[];
}

export interface CloudSaveRunner {
  /** Save now (automatic saves). Keeps the current retry budget. */
  saveNow: () => Promise<void>;
  /** Manual retry: resets the retry budget, then saves now. */
  retryNow: () => Promise<void>;
  /** Cancel a scheduled retry (e.g. on unmount or user change). */
  cancel: () => void;
}

export function createCloudSaveRunner(
  options: CloudSaveRunnerOptions
): CloudSaveRunner {
  const retryDelaysMs = options.retryDelaysMs ?? CLOUD_SAVE_RETRY_DELAYS_MS;
  let failedAttempts = 0;
  let retryTimer: TimerHandle | null = null;
  let inFlight: Promise<void> | null = null;
  let queued = false;

  const cancel = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const attempt = async (): Promise<void> => {
    let outcome: CloudSaveOutcome;
    try {
      outcome = await options.save();
    } catch {
      outcome = { success: false, error: 'Save failed' };
    }

    if (!options.isEnabled()) return;

    if (outcome.success) {
      failedAttempts = 0;
      options.onSuccess(outcome.updatedAt);
      return;
    }

    const delay = retryDelaysMs[failedAttempts];
    const retryScheduled = delay !== undefined;
    if (retryScheduled) {
      failedAttempts += 1;
      cancel();
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void run();
      }, delay);
    }
    options.onError(outcome.error, retryScheduled);
  };

  const run = async (): Promise<void> => {
    if (!options.isEnabled()) return;

    if (inFlight) {
      queued = true;
      return inFlight;
    }

    // This save supersedes any pending retry.
    cancel();
    inFlight = (async () => {
      try {
        await attempt();
      } finally {
        inFlight = null;
      }
      if (queued) {
        queued = false;
        await run();
      }
    })();
    return inFlight;
  };

  return {
    saveNow: run,
    retryNow: () => {
      failedAttempts = 0;
      return run();
    },
    cancel,
  };
}
