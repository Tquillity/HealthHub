'use client';

import { useEffect } from 'react';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';

export const useWallClockSync = () => {
  useEffect(() => {
    const syncTimer = () => {
      void useTimeStore.getState().syncWithWallClock();
    };

    syncTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncTimer();
      }
    };

    window.addEventListener('focus', syncTimer);
    window.addEventListener('pageshow', syncTimer);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', syncTimer);
      window.removeEventListener('pageshow', syncTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
