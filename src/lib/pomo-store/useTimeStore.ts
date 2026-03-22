'use client';

/**
 * @fileoverview Timer state management store using Zustand with persistence.
 * 
 * Manages timer state including time remaining, running status, mode, completion history,
 * and automatic mode switching based on Pomodoro technique rules.
 * 
 * @module useTimeStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as Comlink from 'comlink';
import { getWorker } from '@/lib/pomo/services/worker.service';
import type { DailyStats, HistoryByDate, TimerMode } from '@/lib/pomo/types';
import { events } from '@/lib/pomo/services/event.service';
import { useSettingsStore } from './useSettingsStore';
import { useTaskStore } from './useTaskStore';
import { format } from 'date-fns';
import { createSafeStorage } from '@/lib/pomo/utils/storageWrapper';
import { getDuration } from '@/lib/pomo/utils/timerDefaults';
import { getScheduledBreakMode } from '@/lib/pomo/utils/timerSchedule';

const EMPTY_DAILY_STATS: DailyStats = {
  pomodoro: 0,
  short: 0,
  long: 0,
};

const updateHistoryForCompletion = (
  history: HistoryByDate,
  mode: TimerMode,
  completedAt: number
) => {
  const dayKey = format(new Date(completedAt), 'yyyy-MM-dd');
  const currentStats = history[dayKey] ?? EMPTY_DAILY_STATS;

  return {
    ...history,
    [dayKey]: {
      ...currentStats,
      [mode]: currentStats[mode] + 1,
    },
  };
};

const applyCompletedPomodoroToTask = () => {
  const activeId = useTaskStore.getState().activeTaskId;
  if (activeId) {
    useTaskStore.getState().updateActPomo(activeId);
  }
};

const getNextSessionState = (
  mode: TimerMode,
  pomodorosCompleted: number,
  history: HistoryByDate,
  completedAt: number
) => {
  const updatedHistory = updateHistoryForCompletion(history, mode, completedAt);

  if (mode === 'pomodoro') {
    const nextMode = getScheduledBreakMode(pomodorosCompleted);
    return {
      pomodorosCompleted: pomodorosCompleted + 1,
      mode: nextMode,
      timeLeft: getDuration(nextMode),
      history: updatedHistory,
    };
  }

  return {
    pomodorosCompleted,
    mode: 'pomodoro' as const,
    timeLeft: getDuration('pomodoro'),
    history: updatedHistory,
  };
};

const shouldAutoStartMode = (mode: TimerMode) => {
  const { autoStartBreaks, autoStartPomodoros } = useSettingsStore.getState();
  return mode === 'pomodoro' ? autoStartPomodoros : autoStartBreaks;
};

/**
 * Timer state interface.
 * 
 * @interface TimeState
 * @property {number} timeLeft - Remaining time in seconds
 * @property {boolean} isRunning - Whether timer is currently running
 * @property {TimerMode} mode - Current timer mode (pomodoro, short, long)
 * @property {number} pomodorosCompleted - Total pomodoros completed in current session
 * @property {Record<string, DailyStats>} history - Daily completion history keyed by date (YYYY-MM-DD)
 * @property {number | null} sessionEndAt - Unix timestamp when the active session should end
 * @property {() => Promise<void>} startTimer - Start the timer
 * @property {() => void} pauseTimer - Pause the timer
 * @property {() => void} resetTimer - Reset timer to initial duration for current mode
 * @property {(mode: TimerMode) => void} setMode - Change timer mode and reset
 * @property {(mode: TimerMode) => void} switchModeWithSkip - Skip current session and switch modes while maintaining cycle position
 * @property {(elapsedSeconds?: number) => void} tick - Decrement timer (called by worker)
 * @property {(now?: number) => Promise<void>} syncWithWallClock - Reconcile the timer against the system clock
 */
interface TimeState {
  timeLeft: number;
  isRunning: boolean;
  mode: TimerMode;
  pomodorosCompleted: number;
  history: HistoryByDate;
  sessionEndAt: number | null;
  
  startTimer: () => Promise<void>;
  pauseTimer: () => void;
  resetTimer: () => void;
  setMode: (mode: TimerMode) => void;
  switchModeWithSkip: (mode: TimerMode) => void;
  tick: (elapsedSeconds?: number) => void;
  syncWithWallClock: (now?: number) => Promise<void>;
}

export const useTimeStore = create<TimeState>()(
  persist(
    (set, get) => ({
      timeLeft: getDuration('pomodoro'),
      isRunning: false,
      mode: 'pomodoro',
      pomodorosCompleted: 0,
      history: {},
      sessionEndAt: null,

      startTimer: async () => {
        const { isRunning, timeLeft } = get();
        if (isRunning) return;

        const sessionEndAt = Date.now() + timeLeft * 1000;
        set({ isRunning: true, sessionEndAt });
        try {
          await getWorker().start(
            Comlink.proxy((elapsedSeconds: number = 1) => get().tick(elapsedSeconds))
          );
        } catch {
          set({ isRunning: false, sessionEndAt: null });
        }
      },

      pauseTimer: () => {
        set({ isRunning: false, sessionEndAt: null });
        getWorker().pause();
      },

      resetTimer: () => {
        const { mode } = get();
        set({ isRunning: false, timeLeft: getDuration(mode), sessionEndAt: null });
        getWorker().reset();
      },

      setMode: (mode) => {
        set({ mode, isRunning: false, timeLeft: getDuration(mode), sessionEndAt: null });
        getWorker().reset();
      },

      switchModeWithSkip: (targetMode) => {
        const { mode, pomodorosCompleted } = get();

        const shouldIncrement =
          mode === 'pomodoro' && targetMode !== 'pomodoro';

        set({
          pomodorosCompleted: shouldIncrement ? pomodorosCompleted + 1 : pomodorosCompleted,
          mode: targetMode,
          isRunning: false,
          timeLeft: getDuration(targetMode),
          sessionEndAt: null,
        });

        getWorker().reset();
      },

      tick: (elapsedSeconds: number = 1) => {
        const { timeLeft, mode, pomodorosCompleted, history } = get();
        
        const newTimeLeft = Math.max(0, timeLeft - elapsedSeconds);
        
        if (newTimeLeft > 0) {
          set({ timeLeft: newTimeLeft });
          return;
        }

        set({ timeLeft: 0, sessionEndAt: null });
        get().pauseTimer();
        events.emit('timer:complete', mode);
        
        if (mode === 'pomodoro') {
          applyCompletedPomodoroToTask();
        }

        const nextSessionState = getNextSessionState(
          mode,
          pomodorosCompleted,
          history,
          Date.now()
        );

        set(nextSessionState);

        if (shouldAutoStartMode(nextSessionState.mode)) {
          void get().startTimer();
        }
      },

      syncWithWallClock: async (now = Date.now()) => {
        const { isRunning, sessionEndAt } = get();

        if (!isRunning) {
          return;
        }

        if (!sessionEndAt) {
          set({ isRunning: false, sessionEndAt: null });
          getWorker().reset();
          return;
        }

        if (sessionEndAt > now) {
          const syncedTimeLeft = Math.max(
            1,
            Math.ceil((sessionEndAt - now) / 1000)
          );

          if (syncedTimeLeft !== get().timeLeft) {
            set({ timeLeft: syncedTimeLeft });
          }

          try {
            await getWorker().start(
              Comlink.proxy((elapsedSeconds: number = 1) => get().tick(elapsedSeconds))
            );
          } catch {
            set({ isRunning: false, sessionEndAt: null });
          }
          return;
        }

        let currentMode = get().mode;
        let currentPomodorosCompleted = get().pomodorosCompleted;
        let currentHistory = get().history;
        let currentSessionEndAt = sessionEndAt;
        let iterations = 0;

        while (currentSessionEndAt <= now && iterations < 100) {
          if (currentMode === 'pomodoro') {
            applyCompletedPomodoroToTask();
          }

          const completedSessionState = getNextSessionState(
            currentMode,
            currentPomodorosCompleted,
            currentHistory,
            currentSessionEndAt
          );

          currentMode = completedSessionState.mode;
          currentPomodorosCompleted = completedSessionState.pomodorosCompleted;
          currentHistory = completedSessionState.history;

          if (!shouldAutoStartMode(currentMode)) {
            set({
              ...completedSessionState,
              isRunning: false,
              sessionEndAt: null,
            });
            getWorker().reset();
            return;
          }

          currentSessionEndAt += getDuration(currentMode) * 1000;
          iterations += 1;
        }

        const syncedTimeLeft = Math.max(
          1,
          Math.ceil((currentSessionEndAt - now) / 1000)
        );

        set({
          mode: currentMode,
          pomodorosCompleted: currentPomodorosCompleted,
          history: currentHistory,
          timeLeft: syncedTimeLeft,
          isRunning: true,
          sessionEndAt: currentSessionEndAt,
        });

        try {
          await getWorker().start(
            Comlink.proxy((elapsedSeconds: number = 1) => get().tick(elapsedSeconds))
          );
        } catch {
          set({ isRunning: false, sessionEndAt: null });
        }
      },
    }),
    { 
      name: 'pomo-time-storage',
      version: 3,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persistedState: unknown, version: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = persistedState as any;

        let migratedState = state;

        if (version === 0 || version === 1) {
          const newHistory: HistoryByDate = {};
          if (state.history) {
            Object.entries(state.history).forEach(([date, count]) => {
              newHistory[date] = { pomodoro: count as number, short: 0, long: 0 };
            });
          }
          migratedState = { ...state, history: newHistory };
        }

        if (version < 3) {
          return {
            ...migratedState,
            history: migratedState.history ?? {},
            isRunning: false,
            sessionEndAt: null,
          };
        }

        return migratedState;
      },
    }
  )
);
