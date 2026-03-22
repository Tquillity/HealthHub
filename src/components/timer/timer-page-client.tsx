'use client';

import { Suspense, lazy, useEffect, useState } from 'react';
import { TaskBoard } from '@/components/timer/TaskBoard';
import { TimerFooter } from '@/components/timer/layout/TimerFooter';
import { SEOContent } from '@/components/timer/layout/SEOContent';
import { ErrorBoundary } from '@/components/timer/common/ErrorBoundary';
import { VisualBell } from '@/components/timer/common/VisualBell';
import { SwitchModeModal } from '@/components/timer/modals/SwitchModeModal';
import { PomodoroGuideModal } from '@/components/timer/modals/PomodoroGuideModal';
import { ZenPlayer } from '@/components/timer/sound/ZenPlayer';
import { DailyGoalCard } from '@/components/timer/stats/DailyGoalCard';
import { ModeSwitcher } from '@/components/timer/timer/ModeSwitcher';
import { ScheduleMeter } from '@/components/timer/timer/ScheduleMeter';
import { TimerControls } from '@/components/timer/timer/TimerControls';
import { TimerDisplay } from '@/components/timer/timer/TimerDisplay';
import { useDocumentTitle } from '@/lib/pomo/hooks/useDocumentTitle';
import { useFocusMode } from '@/lib/pomo/hooks/useFocusMode';
import { useKeyboardShortcuts } from '@/lib/pomo/hooks/useKeyboardShortcuts';
import { useTheme } from '@/lib/pomo/hooks/useTheme';
import { useTimerEffects } from '@/lib/pomo/hooks/useTimerEffects';
import { useWallClockSync } from '@/lib/pomo/hooks/useWallClockSync';
import type { TimerMode } from '@/lib/pomo/types';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { setStorageQuotaErrorHandler } from '@/lib/pomo/utils/storageWrapper';
import styles from './timer-shell.module.css';

const SettingsModal = lazy(() =>
  import('@/components/timer/settings/SettingsModal').then((module) => ({
    default: module.SettingsModal,
  }))
);
const StatsModal = lazy(() =>
  import('@/components/timer/stats/StatsModal').then((module) => ({
    default: module.StatsModal,
  }))
);
const ColorPsychologyModal = lazy(() =>
  import('@/components/timer/modals/ColorPsychologyModal').then((module) => ({
    default: module.ColorPsychologyModal,
  }))
);

export function TimerPageClient() {
  useTheme();
  useTimerEffects();
  useDocumentTitle();
  useKeyboardShortcuts();
  useFocusMode();
  useWallClockSync();

  const [isMounted, setIsMounted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isColorPsychOpen, setIsColorPsychOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [switchModalState, setSwitchModalState] = useState<{
    isOpen: boolean;
    currentMode: TimerMode;
    targetMode: TimerMode;
    wasRunning: boolean;
  }>({
    isOpen: false,
    currentMode: 'pomodoro',
    targetMode: 'pomodoro',
    wasRunning: false,
  });

  const { zenModeEnabled, isAudioUnlocked, unlockAudio } = useSettingsStore();
  const startTimer = useTimeStore((state) => state.startTimer);
  const switchModeWithSkip = useTimeStore((state) => state.switchModeWithSkip);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;

    setStorageQuotaErrorHandler(() => {
      setStorageError('Storage quota exceeded. Some data may not be saved.');
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setStorageError(null), 5000);
    });

    const handleStorageFallback = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;
      setStorageError(customEvent.detail.message);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setStorageError(null), 5000);
    };
    const handleStorageError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;
      setStorageError(customEvent.detail.message);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setStorageError(null), 5000);
    };

    window.addEventListener('storage-fallback', handleStorageFallback);
    window.addEventListener('storage-error', handleStorageError);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('storage-fallback', handleStorageFallback);
      window.removeEventListener('storage-error', handleStorageError);
    };
  }, []);

  useEffect(() => {
    if (zenModeEnabled && !isAudioUnlocked) {
      const handleAnyClick = () => {
        unlockAudio();
      };

      document.addEventListener('click', handleAnyClick, { once: true });
      document.addEventListener('touchstart', handleAnyClick, { once: true });

      return () => {
        document.removeEventListener('click', handleAnyClick);
        document.removeEventListener('touchstart', handleAnyClick);
      };
    }
  }, [zenModeEnabled, isAudioUnlocked, unlockAudio]);

  const handleDirtySwitch = ({
    targetMode,
    currentMode,
    wasRunning,
  }: {
    targetMode: TimerMode;
    currentMode: TimerMode;
    wasRunning: boolean;
  }) => {
    setSwitchModalState({
      isOpen: true,
      targetMode,
      currentMode,
      wasRunning,
    });
  };

  const handleConfirmSwitch = () => {
    switchModeWithSkip(switchModalState.targetMode);
    setSwitchModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancelSwitch = () => {
    const shouldResume = switchModalState.wasRunning;
    setSwitchModalState((prev) => ({ ...prev, isOpen: false }));
    if (shouldResume) {
      void startTimer();
    }
  };

  if (!isMounted) {
    return (
      <div
        className={`${styles.pomozenPage} flex min-h-screen w-full items-center justify-center px-6 py-12 text-white`}
      >
        <div className="app-surface w-full max-w-lg rounded-[32px] px-6 py-10 text-center backdrop-blur-md">
          <p className="app-eyebrow">HealthHub Tool</p>
          <h1 className="mt-3 text-3xl font-bold">Loading Focus Timer</h1>
          <p className="mt-4 text-sm text-white/70">
            Restoring your local timer settings, tasks, and recent focus history.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.pomozenPage} relative flex h-screen w-full flex-col items-center overflow-hidden bg-(--theme-bg)`}
    >
      <VisualBell />
      <ZenPlayer />

      <main className="custom-scrollbar z-10 flex-1 w-full overflow-y-auto">
        <div className="app-shell mx-auto flex w-full max-w-5xl flex-col items-center gap-3 px-3 pb-4 pt-3 sm:gap-4 sm:px-4 sm:pt-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl text-white">
              <p className="app-eyebrow">HealthHub Tool</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                Focus Timer
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                A public Pomodoro timer with task tracking, ambient audio, and
                browser-only persistence for offline-friendly focus sessions.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="hidden flex-wrap gap-2 lg:flex">
                <button
                  onClick={() => setIsColorPsychOpen(true)}
                  className="whitespace-nowrap rounded-full bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30 sm:px-4 sm:text-sm"
                >
                  Color Psychology
                </button>
                <button
                  onClick={() => setIsGuideOpen(true)}
                  className="whitespace-nowrap rounded-full bg-white/20 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/30 sm:px-4 sm:text-sm"
                >
                  Pomodoro Technique
                </button>
              </div>

              <div className="flex gap-2 lg:hidden">
                <button
                  onClick={() => setIsColorPsychOpen(true)}
                  className="flex items-center justify-center rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
                  aria-label="Color Psychology"
                  title="Color Psychology"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 5.878-4.792 3.75 3.75 0 0 0-4.706-4.706 3.75 3.75 0 0 0-4.706-4.706A6 6 0 1 0 12 18.75Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 7.5h.008v.008H10.5V7.5Zm3 0h.008v.008H13.5V7.5Zm-4.5 3h.008v.008H9V10.5Zm6 0h.008v.008H15V10.5Z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => setIsGuideOpen(true)}
                  className="flex items-center justify-center rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
                  aria-label="Pomodoro Technique"
                  title="Pomodoro Technique"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                    />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => setIsStatsOpen(true)}
                className="flex items-center justify-center rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
                aria-label="Stats"
                title="Stats"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
                aria-label="Settings"
                title="Settings"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <ModeSwitcher onDirtySwitch={handleDirtySwitch} />
          <ScheduleMeter />

          <div className="shrink-0">
            <TimerDisplay />
          </div>

          <div className="flex w-full shrink-0 justify-center">
            <TimerControls />
          </div>

          <div className="flex w-full shrink-0 justify-center">
            <DailyGoalCard />
          </div>

          <div className="mb-4 flex w-full shrink-0 justify-center">
            <TaskBoard />
          </div>

          <div className="shrink-0 w-full">
            <SEOContent />
          </div>
        </div>
      </main>

      <TimerFooter />

      {zenModeEnabled && !isAudioUnlocked && (
        <div
          className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white animate-bounce pointer-events-none sm:bottom-24 md:bottom-20"
          aria-label="Click anywhere to enable zen audio"
        >
          Click anywhere to enable zen audio
        </div>
      )}

      {storageError && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white animate-bounce sm:bottom-24 md:bottom-20">
          {storageError}
        </div>
      )}

      <SwitchModeModal
        isOpen={switchModalState.isOpen}
        currentMode={switchModalState.currentMode}
        targetMode={switchModalState.targetMode}
        onCancel={handleCancelSwitch}
        onConfirm={handleConfirmSwitch}
      />

      <Suspense fallback={null}>
        <ErrorBoundary>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
        </ErrorBoundary>
        <ErrorBoundary>
          <ColorPsychologyModal
            isOpen={isColorPsychOpen}
            onClose={() => setIsColorPsychOpen(false)}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <PomodoroGuideModal
            isOpen={isGuideOpen}
            onClose={() => setIsGuideOpen(false)}
          />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}
