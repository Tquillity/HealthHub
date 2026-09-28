'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPomoState, savePomoState } from '@/actions/pomo-state';
import { useSession } from '@/lib/auth-client';
import { events } from '@/lib/pomo/services/event.service';
import {
  applyPomoStatePayload,
  buildExportSnapshot,
  clearLocalPomoStorageKeys,
  hasLocalPomoData,
} from '@/lib/pomo/services/storage.service';
import { createCloudSaveRunner } from '@/lib/pomo/utils/cloud-save-runner';
import { buildPayloadFromLocalStorage } from '@/lib/pomo/utils/local-pomo-payload';
import { setCloudPersistenceActive } from '@/lib/pomo/utils/storageWrapper';
import { isEmptyPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { useTaskStore } from '@/lib/pomo-store/useTaskStore';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';

export type PomoCloudPersistenceStatus =
  | 'loading'
  | 'local'
  | 'cloud'
  | 'error';

const PERSIST_DEBOUNCE_MS = 2000;

/** Hydration key for signed-out visitors (one local-mode hydrate per page load). */
const GUEST_KEY = '__guest__';

export function usePomoCloudPersistence() {
  const { data: session, isPending } = useSession();
  const userId = session?.user?.id ?? null;
  const [status, setStatus] = useState<PomoCloudPersistenceStatus>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  /** True once server state has been loaded and applied: local state may be pushed. */
  const [cloudActive, setCloudActive] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const cloudActiveRef = useRef(false);
  /** Legacy local keys are cleared after the first successful cloud save (TIMER-1). */
  const clearLocalOnSaveRef = useRef(false);
  const hydratedKeyRef = useRef<string | null>(null);

  const [saveRunner] = useState(() =>
    createCloudSaveRunner({
      isEnabled: () => cloudActiveRef.current,
      save: async () => {
        dirtyRef.current = false;
        const result = await savePomoState(buildExportSnapshot());
        return result.success
          ? { success: true, updatedAt: result.data.updatedAt }
          : { success: false, error: result.error ?? 'Save failed' };
      },
      onSuccess: (updatedAt) => {
        if (clearLocalOnSaveRef.current) {
          clearLocalOnSaveRef.current = false;
          clearLocalPomoStorageKeys();
        }
        setSaveError(null);
        setLastSavedAt(updatedAt);
        setStatus('cloud');
      },
      onError: (error, retryScheduled) => {
        setSaveError(retryScheduled ? `${error} · retrying…` : error);
        setStatus('error');
      },
    })
  );

  const deactivateCloud = useCallback(() => {
    cloudActiveRef.current = false;
    setCloudActive(false);
    setCloudPersistenceActive(false);
    saveRunner.cancel();
  }, [saveRunner]);

  const hydrate = useCallback(async () => {
    if (!userId) {
      deactivateCloud();
      setStatus('local');
      return;
    }

    setStatus('loading');
    const result = await getPomoState();

    if (!result.success) {
      if (result.error === 'Premium required') {
        deactivateCloud();
        setStatus('local');
        return;
      }
      // Server state was never loaded, so local state must not be pushed over it.
      setSaveError(result.error);
      setStatus('error');
      return;
    }

    // Read local (pre-upgrade) data before anything clears it, so a first cloud sync can import it
    const localPayload = hasLocalPomoData()
      ? buildPayloadFromLocalStorage()
      : null;

    cloudActiveRef.current = true;
    setCloudPersistenceActive(true);

    let payload = result.data;
    if (isEmptyPomoPayload(payload) && localPayload) {
      payload = localPayload;
    }

    applyPomoStatePayload(payload);
    // Keep local keys until the cloud copy is saved, so the import survives a failed save.
    clearLocalOnSaveRef.current = true;
    setCloudActive(true);

    await saveRunner.retryNow();
  }, [deactivateCloud, saveRunner, userId]);

  // Hydrate once per user id, not on every new session object (TIMER-9).
  useEffect(() => {
    if (isPending) return;
    const key = userId ?? GUEST_KEY;
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;
    void hydrate();
  }, [hydrate, isPending, userId]);

  const persistNow = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    return saveRunner.saveNow();
  }, [saveRunner]);

  const schedulePersist = useCallback(() => {
    if (!cloudActiveRef.current) return;
    dirtyRef.current = true;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void saveRunner.saveNow();
    }, PERSIST_DEBOUNCE_MS);
  }, [saveRunner]);

  // Save subscriptions stay active in the error state too (TIMER-3): a failed save must not
  // stop later changes from being saved.
  useEffect(() => {
    if (!cloudActive) return;

    const unsubTime = useTimeStore.subscribe(schedulePersist);
    const unsubSettings = useSettingsStore.subscribe(schedulePersist);
    const unsubTasks = useTaskStore.subscribe(schedulePersist);
    const unsubComplete = events.on('timer:complete', () => {
      void persistNow();
    });

    const flushIfDirty = () => {
      if (cloudActiveRef.current && dirtyRef.current) {
        void persistNow();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushIfDirty();
      }
    };
    window.addEventListener('beforeunload', flushIfDirty);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unsubTime();
      unsubSettings();
      unsubTasks();
      unsubComplete();
      window.removeEventListener('beforeunload', flushIfDirty);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [cloudActive, persistNow, schedulePersist]);

  useEffect(() => () => saveRunner.cancel(), [saveRunner]);

  /** Retry pushes the current local state; it only re-loads when the server state never loaded. */
  const retry = useCallback(() => {
    if (cloudActiveRef.current) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void saveRunner.retryNow();
      return;
    }
    void hydrate();
  }, [hydrate, saveRunner]);

  return {
    status,
    saveError,
    lastSavedAt,
    retry,
  };
}
