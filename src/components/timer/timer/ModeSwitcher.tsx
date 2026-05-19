'use client';

import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { playClick } from '@/lib/pomo/services/sound.service';
import type { TimerMode } from '@/lib/pomo/types';
import { cn } from '@/lib/utils';
import { getDuration } from '@/lib/pomo/utils/timerDefaults';

interface ModeSwitcherProps {
  onDirtySwitch: (params: { targetMode: TimerMode; currentMode: TimerMode; wasRunning: boolean }) => void;
}

export const ModeSwitcher = ({ onDirtySwitch }: ModeSwitcherProps) => {
  const mode = useTimeStore(state => state.mode);
  const setMode = useTimeStore(state => state.setMode);
  const timeLeft = useTimeStore(state => state.timeLeft);
  const isRunning = useTimeStore(state => state.isRunning);
  const pauseTimer = useTimeStore(state => state.pauseTimer);

  const handleModeChange = (m: TimerMode) => {
    if (m === mode) return;

    const fullDuration = getDuration(mode);
    const hasElapsed = timeLeft < fullDuration;
    const isDirtySwitch = hasElapsed || isRunning;

    playClick();

    if (!isDirtySwitch) {
      setMode(m);
      return;
    }

    pauseTimer();
    onDirtySwitch({ targetMode: m, currentMode: mode, wasRunning: isRunning });
  };

  return (
    <div className="relative z-40 flex w-full max-w-sm gap-1 sm:gap-2 mb-[14px] sm:mb-[22px] md:mb-[29px] bg-black/20 p-1 rounded-full pointer-events-auto">
      {(['pomodoro', 'short', 'long'] as TimerMode[]).map((m) => (
        <button
          key={m}
          onClick={() => handleModeChange(m)}
          aria-pressed={mode === m}
          title={m === 'pomodoro' ? 'Focus session' : m === 'short' ? 'Short break' : 'Long break'}
          className={cn(
            "flex-1 px-2 sm:px-3 md:px-4 py-2 rounded-full capitalize text-[11px] sm:text-sm font-bold transition-all cursor-pointer",
            mode === m ? "bg-black/20 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-black/10"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
};

