'use client';

import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { playClick } from '@/lib/pomo/services/sound.service';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { cn } from '@/lib/utils';

export const TimerControls = () => {
  const isRunning = useTimeStore(state => state.isRunning);
  const startTimer = useTimeStore(state => state.startTimer);
  const pauseTimer = useTimeStore(state => state.pauseTimer);
  const resetTimer = useTimeStore(state => state.resetTimer);
  const { unlockAudio, isAudioUnlocked } = useSettingsStore();

  const handleStart = () => {
    if (!isAudioUnlocked) {
      unlockAudio();
    }
    playClick();
    startTimer();
  };

  const handlePause = () => {
    playClick();
    pauseTimer();
  };

  const handleReset = () => {
    playClick();
    resetTimer();
  };

  return (
    <div className="flex w-full max-w-sm items-center justify-center gap-2 sm:max-w-md sm:gap-4 mb-[10px] sm:mb-[13px] md:mb-[20px] z-10">
      <button
          onClick={isRunning ? handlePause : handleStart}
          className={cn(
            "w-full max-w-60 px-4 sm:px-6 md:px-8 py-3 sm:py-4 text-base sm:text-xl md:text-2xl font-bold rounded-lg shadow-xl cursor-pointer transition-transform active:scale-95 uppercase",
            "bg-white text-(--theme-primary) hover:bg-gray-100"
          )}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          title={isRunning ? 'Pause timer' : 'Start timer'}
      >
          {isRunning ? 'Pause' : 'Start'}
      </button>

      <button
          onClick={handleReset}
          className="w-14 sm:w-auto px-3 sm:px-4 py-3 sm:py-4 text-lg sm:text-xl md:text-2xl font-bold rounded-lg shadow-xl cursor-pointer transition-transform active:scale-95 bg-white/20 text-white hover:bg-white/30"
          aria-label="Reset"
          title="Reset Timer"
      >
          ↺
      </button>
    </div>
  );
};
