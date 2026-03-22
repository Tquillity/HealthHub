'use client';

import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { formatTime } from '@/lib/pomo/utils/timeUtils';

export const TimerDisplay = () => {
  const timeLeft = useTimeStore(state => state.timeLeft);
  const isRunning = useTimeStore(state => state.isRunning);

  return (
    <div className="text-center">
      <h1 className="sr-only">HealthHub Focus Timer</h1>
      <div
        className="timer-readout text-[clamp(4rem,18vw,8rem)] leading-none font-bold text-white mb-[13px] sm:mb-[20px] md:mb-[26px] font-mono drop-shadow-lg tabular-nums tracking-tight"
        role="timer"
        aria-live={isRunning ? "off" : "polite"}
        aria-atomic="true"
      >
        {formatTime(timeLeft)}
      </div>
    </div>
  );
};