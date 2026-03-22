'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';

export const useFocusMode = () => {
  const isFocusMode = useSettingsStore(state => state.isFocusMode);

  useEffect(() => {
    const handleFocusChange = async () => {
      try {
        if (!isFocusMode && document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        return;
      }
    };

    handleFocusChange();
  }, [isFocusMode]);
};

