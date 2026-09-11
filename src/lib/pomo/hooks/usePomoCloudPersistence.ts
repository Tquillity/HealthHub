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
import { buildPayloadFromLocalStorage } from '@/lib/pomo/utils/local-pomo-payload';
import { setCloudPersistenceActive } from '@/lib/pomo/utils/storageWrapper';
import { isEmptyPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { useTaskStore } from '@/lib/pomo-store/useTaskStore';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';

export type PomoCloudPersistenceStatus = 'loading' | 'local' | 'cloud' | 'error';

const PERSIST_DEBOUNCE_MS = 2000;

export function usePomoCloudPersistence() {
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState<PomoCloudPersistenceStatus>('loading');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const cloudActiveRef = useRef(false);

  const persistNow = useCallback(async () => {
    if (!cloudActiveRef.current) return;

    const payload = buildExportSnapshot();
    const result = await savePomoState(payload);
    if (!result.success) {
      setSaveError(result.error ?? 'Save failed');
      setStatus('error');
      return;
    }

    setSaveError(null);
    setStatus('cloud');
    setLastSavedAt(result.data.updatedAt);
  }, []);

  const schedulePersist = useCallback(() => {
    if (!cloudActiveRef.current) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void persistNow();
    }, PERSIST_DEBOUNCE_MS);
  }, [persistNow]);

  const hydrate = useCallback(async () => {
    if (!session?.user) {
      cloudActiveRef.current = false;
      setCloudPersistenceActive(false);
      setStatus('local');
      return;
    }

    setStatus('loading');
    const result = await getPomoState();

    if (!result.success) {
      if (result.error === 'Premium required') {
        cloudActiveRef.current = false;
        setCloudPersistenceActive(false);
        setStatus('local');
        return;
      }
      setSaveError(result.error);
      setStatus('error');
      return;
    }

    cloudActiveRef.current = true;
    setCloudPersistenceActive(true);
    clearLocalPomoStorageKeys();

    let payload = result.data;
    if (isEmptyPomoPayload(payload) && hasLocalPomoData()) {
      const localPayload = buildPayloadFromLocalStorage();
      if (localPayload) {
        payload = localPayload;
      }
    }

    applyPomoStatePayload(payload);
    clearLocalPomoStorageKeys();

    const saveResult = await savePomoState(payload);
    if (!saveResult.success) {
      setSaveError(saveResult.error ?? 'Save failed');
      setStatus('error');
      return;
    }

    setSaveError(null);
    setLastSavedAt(saveResult.data.updatedAt);
    setStatus('cloud');
  }, [session?.user]);

  useEffect(() => {
    if (isPending) return;
    void hydrate();
  }, [hydrate, isPending]);

  useEffect(() => {
    if (status !== 'cloud') return;

    const unsubTime = useTimeStore.subscribe(schedulePersist);
    const unsubSettings = useSettingsStore.subscribe(schedulePersist);
    const unsubTasks = useTaskStore.subscribe(schedulePersist);
    const unsubComplete = events.on('timer:complete', () => {
      void persistNow();
    });

    const onBeforeUnload = () => {
      if (cloudActiveRef.current) {
        void persistNow();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      unsubTime();
      unsubSettings();
      unsubTasks();
      unsubComplete();
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [persistNow, schedulePersist, status]);

  return {
    status,
    saveError,
    lastSavedAt,
    retry: hydrate,
  };
}
