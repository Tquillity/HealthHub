'use client';

import { useEffect } from 'react';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { formatTime } from '@/lib/pomo/utils/timeUtils';

export const useDocumentTitle = () => {
  const { timeLeft, isRunning } = useTimeStore();

  useEffect(() => {
    const previousTitle = document.title;
    const timeString = formatTime(timeLeft);

    if (isRunning) {
      document.title = `${timeString} | HealthHub Focus Timer`;
    } else {
      document.title = 'Free Pomodoro Timer for Focus and Study | HealthHub';
    }

    return () => {
      document.title = previousTitle;
    };
  }, [timeLeft, isRunning]);
};

