'use client';

import { useEffect, useRef } from 'react';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';

export const useKeyboardShortcuts = () => {
  const { startTimer, pauseTimer, resetTimer, isRunning } = useTimeStore();
  const { toggleSound, toggleFocusMode } = useSettingsStore();
  
  const actionsRef = useRef({ startTimer, pauseTimer, resetTimer, toggleSound, toggleFocusMode });
  const isRunningRef = useRef(isRunning);
  
  useEffect(() => {
    actionsRef.current = { startTimer, pauseTimer, resetTimer, toggleSound, toggleFocusMode };
    isRunningRef.current = isRunning;
  }, [startTimer, pauseTimer, resetTimer, toggleSound, toggleFocusMode, isRunning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName?.toLowerCase();

      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        tag === 'button' ||
        tag === 'a' ||
        active?.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (isRunningRef.current) actionsRef.current.pauseTimer();
          else actionsRef.current.startTimer();
          break;
        case 'r':
          actionsRef.current.resetTimer();
          break;
        case 'm':
          actionsRef.current.toggleSound();
          break;
        case 'f':
          actionsRef.current.toggleFocusMode();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};

