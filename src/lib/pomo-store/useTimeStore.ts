'use client';

/**
 * @fileoverview Timer state management store using Zustand with persistence.
 *
 * Manages timer state including time remaining, running status, mode, completion history,
 * and automatic mode switching based on Pomodoro technique rules.
 *
 * While a session runs, `sessionEndAt` (wall clock) is the source of truth: every worker
 * pulse recomputes `timeLeft` from it instead of subtracting elapsed seconds.
 *
 * @module useTimeStore
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as Comlink from 'comlink';
import { getWorker } from '@/lib/pomo/services/worker.service';
import type { TimerWorkerAPI } from '@/lib/pomo/types/worker-types';
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

/** Whole seconds left until `sessionEndAt`, rounded up so the display never shows 0 early. */
export const getRemainingSeconds = (sessionEndAt: number, now: number) =>
  Math.max(0, Math.ceil((sessionEndAt - now) / 1000));

/**
 * A pulse that arrives this long after the deadline means the tab or device was asleep.
 * The completion is then handed to `syncWithWallClock`, which replays every session that
 * ended in the meantime from the stored deadlines.
 */
export const LATE_COMPLETION_CATCH_UP_MS = 5000;

/*
 * Worker pulse bookkeeping (TIMER-19). The worker only needs to be started once per worker
 * instance; focus/visibility syncs used to call `start` with a fresh Comlink proxy every time
 * (each one opening a MessageChannel that was never released). `pulseWorker` remembers which
 * worker instance is pulsing, so a replacement worker (after an error) is started again.
 */
let pulseWorker: Comlink.Remote<TimerWorkerAPI> | null = null;
let pulseCallback: ((elapsedSeconds: number) => void) | null = null;

const getPulseCallback = () => {
  pulseCallback ??= Comlink.proxy(() => {
    useTimeStore.getState().tick();
  });
  return pulseCallback;
};

const ensurePulse = async () => {
  const worker = getWorker();
  if (pulseWorker === worker) return;
  pulseWorker = worker;
  try {
    await worker.start(getPulseCallback());
  } catch (error) {
    if (pulseWorker === worker) pulseWorker = null;
    throw error;
  }
};

const stopPulse = (action: 'pause' | 'reset') => {
  pulseWorker = null;
  let worker: Comlink.Remote<TimerWorkerAPI>;
  try {
    worker = getWorker();
  } catch {
    return;
  }
  const pending = action === 'pause' ? worker.pause() : worker.reset();
  void Promise.resolve(pending).catch(() => undefined);
};

/**
 * Timer state interface.
 *
 * @interface TimeState
 * @property {number} timeLeft - Remaining time in seconds (derived from `sessionEndAt` while running)
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
 * @property {(elapsedSeconds?: number) => void} tick - Worker pulse: recompute `timeLeft` from `sessionEndAt` (the argument is ignored)
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

type PersistedTimeState = Partial<
  Pick<
    TimeState,
    'timeLeft' | 'isRunning' | 'mode' | 'pomodorosCompleted' | 'sessionEndAt'
  >
> & {
  history?: Record<string, unknown>;
};

export const useTimeStore = create<TimeState>()(
  persist(
    (set, get) => {
      const runPulse = async () => {
        try {
          await ensurePulse();
        } catch {
          set({ isRunning: false, sessionEndAt: null });
        }
      };

      /** Record the session that just ended, move to the next one, then announce it (TIMER-6). */
      const completeCurrentSession = (completedAt: number, now: number) => {
        const { mode, pomodorosCompleted, history } = get();

        if (mode === 'pomodoro') {
          applyCompletedPomodoroToTask();
        }

        const nextSessionState = getNextSessionState(
          mode,
          pomodorosCompleted,
          history,
          completedAt
        );
        const autoStart = shouldAutoStartMode(nextSessionState.mode);

        if (autoStart) {
          set({
            ...nextSessionState,
            isRunning: true,
            sessionEndAt: now + nextSessionState.timeLeft * 1000,
          });
        } else {
          set({ ...nextSessionState, isRunning: false, sessionEndAt: null });
          stopPulse('pause');
        }

        // Emit only after the new state is applied, so listeners (cloud save, notifications)
        // see the completed session rather than the pre-completion state.
        events.emit('timer:complete', mode);

        if (autoStart) {
          void runPulse();
        }
      };

      return {
        timeLeft: getDuration('pomodoro'),
        isRunning: false,
        mode: 'pomodoro',
        pomodorosCompleted: 0,
        history: {},
        sessionEndAt: null,

        startTimer: async () => {
          const { isRunning, timeLeft, mode } = get();
          if (isRunning) return;

          // A finished (0s) session must never be "started": it would complete instantly and
          // record a fake session. Start a fresh one for the current mode instead.
          const sessionSeconds = timeLeft > 0 ? timeLeft : getDuration(mode);
          set({
            isRunning: true,
            timeLeft: sessionSeconds,
            sessionEndAt: Date.now() + sessionSeconds * 1000,
          });
          await runPulse();
        },

        pauseTimer: () => {
          const { isRunning, sessionEndAt, timeLeft } = get();
          const remaining =
            isRunning && sessionEndAt !== null
              ? Math.max(1, getRemainingSeconds(sessionEndAt, Date.now()))
              : timeLeft;
          set({ isRunning: false, sessionEndAt: null, timeLeft: remaining });
          stopPulse('pause');
        },

        resetTimer: () => {
          const { mode } = get();
          set({
            isRunning: false,
            timeLeft: getDuration(mode),
            sessionEndAt: null,
          });
          stopPulse('reset');
        },

        setMode: (mode) => {
          set({
            mode,
            isRunning: false,
            timeLeft: getDuration(mode),
            sessionEndAt: null,
          });
          stopPulse('reset');
        },

        switchModeWithSkip: (targetMode) => {
          const { mode, pomodorosCompleted } = get();

          const shouldIncrement =
            mode === 'pomodoro' && targetMode !== 'pomodoro';

          set({
            pomodorosCompleted: shouldIncrement
              ? pomodorosCompleted + 1
              : pomodorosCompleted,
            mode: targetMode,
            isRunning: false,
            timeLeft: getDuration(targetMode),
            sessionEndAt: null,
          });

          stopPulse('reset');
        },

        tick: () => {
          const { timeLeft, isRunning, sessionEndAt } = get();

          // Ignore ticks that arrive after a pause/reset or a state import stopped the session;
          // otherwise a still-running worker keeps counting down and records fake completions.
          if (!isRunning) {
            return;
          }

          const now = Date.now();

          if (sessionEndAt === null) {
            // Running without a deadline (legacy state): anchor one so the countdown continues.
            set({ sessionEndAt: now + Math.max(1, timeLeft) * 1000 });
            return;
          }

          // Always derive the remaining time from the deadline, never by subtracting elapsed
          // time, so jitter and sleep cannot drift or double-count (TIMER-2 / TIMER-5).
          const remaining = getRemainingSeconds(sessionEndAt, now);

          if (remaining > 0) {
            if (remaining !== timeLeft) {
              set({ timeLeft: remaining });
            }
            return;
          }

          if (now - sessionEndAt > LATE_COMPLETION_CATCH_UP_MS) {
            void get().syncWithWallClock(now);
            return;
          }

          completeCurrentSession(sessionEndAt, now);
        },

        syncWithWallClock: async (now = Date.now()) => {
          const { isRunning, sessionEndAt } = get();

          if (!isRunning) {
            return;
          }

          if (!sessionEndAt) {
            set({ isRunning: false, sessionEndAt: null });
            stopPulse('reset');
            return;
          }

          if (sessionEndAt > now) {
            const syncedTimeLeft = Math.max(
              1,
              getRemainingSeconds(sessionEndAt, now)
            );

            if (syncedTimeLeft !== get().timeLeft) {
              set({ timeLeft: syncedTimeLeft });
            }

            await runPulse();
            return;
          }

          let currentMode = get().mode;
          let currentPomodorosCompleted = get().pomodorosCompleted;
          let currentHistory = get().history;
          let currentSessionEndAt = sessionEndAt;
          let lastCompletedMode: TimerMode = currentMode;
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

            lastCompletedMode = currentMode;
            currentMode = completedSessionState.mode;
            currentPomodorosCompleted =
              completedSessionState.pomodorosCompleted;
            currentHistory = completedSessionState.history;

            if (!shouldAutoStartMode(currentMode)) {
              set({
                ...completedSessionState,
                isRunning: false,
                sessionEndAt: null,
              });
              stopPulse('reset');
              events.emit('timer:complete', lastCompletedMode);
              return;
            }

            currentSessionEndAt += getDuration(currentMode) * 1000;
            iterations += 1;
          }

          const syncedTimeLeft = Math.max(
            1,
            getRemainingSeconds(currentSessionEndAt, now)
          );

          set({
            mode: currentMode,
            pomodorosCompleted: currentPomodorosCompleted,
            history: currentHistory,
            timeLeft: syncedTimeLeft,
            isRunning: true,
            sessionEndAt: currentSessionEndAt,
          });
          events.emit('timer:complete', lastCompletedMode);

          await runPulse();
        },
      };
    },
    {
      name: 'pomo-time-storage',
      version: 3,
      storage: createJSONStorage(() => createSafeStorage()),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as PersistedTimeState;

        let migratedState: PersistedTimeState = state;

        if (version === 0 || version === 1) {
          const newHistory: HistoryByDate = {};
          if (state.history) {
            Object.entries(state.history).forEach(([date, count]) => {
              newHistory[date] = {
                pomodoro: typeof count === 'number' ? count : 0,
                short: 0,
                long: 0,
              };
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
          } as TimeState;
        }

        return migratedState as TimeState;
      },
    }
  )
);
