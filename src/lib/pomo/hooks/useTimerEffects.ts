'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { playAlarm, sendNotification } from '@/lib/pomo/services/sound.service';
import { events } from '@/lib/pomo/services/event.service';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { getScheduledBreakMode } from '@/lib/pomo/utils/timerSchedule';

export const useTimerEffects = () => {
  useEffect(() => {
    const unsubscribe = events.on('timer:complete', (completedMode) => {
      const { soundEnabled, notificationsEnabled } = useSettingsStore.getState();

      if (soundEnabled) {
        playAlarm();
      }

      if (notificationsEnabled) {
        if (completedMode === 'pomodoro') {
          const pomodorosCompleted = useTimeStore.getState().pomodorosCompleted;
          const nextBreakMode = getScheduledBreakMode(pomodorosCompleted);

          sendNotification(
            'Break Time!',
            `Great job! Take a ${nextBreakMode === 'long' ? 'long' : 'short'} break.`
          );
        } else {
          sendNotification('Back to Work!', "Break is over. Let's focus.");
        }
      }

    });

    return unsubscribe;
  }, []);
};
