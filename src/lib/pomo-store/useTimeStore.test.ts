import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeWorker = {
  start: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

const workerState = vi.hoisted(() => ({ current: null as FakeWorker | null }));

vi.mock('@/lib/pomo/services/worker.service', () => ({
  getWorker: () => workerState.current,
  terminateWorker: () => undefined,
}));

import { events } from '@/lib/pomo/services/event.service';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';
import { useTaskStore } from '@/lib/pomo-store/useTaskStore';
import {
  LATE_COMPLETION_CATCH_UP_MS,
  useTimeStore,
} from '@/lib/pomo-store/useTimeStore';

const START = new Date('2026-09-28T09:00:00.000Z').getTime();
const MIN = 60_000;

const createFakeWorker = (): FakeWorker => ({
  start: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  reset: vi.fn(async () => undefined),
});

/** Advance the wall clock and deliver one worker pulse. */
const pulseAt = (ms: number) => {
  vi.setSystemTime(ms);
  useTimeStore.getState().tick(1);
};

describe('useTimeStore (wall-clock derived timing)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    workerState.current = createFakeWorker();

    useSettingsStore.setState({
      durations: { pomodoro: 25, short: 5, long: 15 },
      autoStartBreaks: false,
      autoStartPomodoros: false,
    });
    useTaskStore.setState({ tasks: [], activeTaskId: null });
    useTimeStore.setState({
      mode: 'pomodoro',
      timeLeft: 25 * 60,
      isRunning: false,
      pomodorosCompleted: 0,
      history: {},
      sessionEndAt: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives timeLeft from sessionEndAt instead of subtracting elapsed seconds (TIMER-2)', async () => {
    await useTimeStore.getState().startTimer();
    expect(useTimeStore.getState().sessionEndAt).toBe(START + 25 * MIN);

    // Jittery pulses: a floor-and-reset worker would lose a second on each of these.
    let now = START;
    for (let i = 0; i < 10; i += 1) {
      now += 1_900;
      pulseAt(now);
    }

    // 19s elapsed -> 1481s left (ceil).
    expect(useTimeStore.getState().timeLeft).toBe(25 * 60 - 19);
  });

  it('does not double-subtract when a pulse and a wall-clock sync both run after wake (TIMER-5)', async () => {
    await useTimeStore.getState().startTimer();

    vi.setSystemTime(START + 5 * MIN);
    useTimeStore.getState().tick(300);
    await useTimeStore.getState().syncWithWallClock();
    useTimeStore.getState().tick(300);

    expect(useTimeStore.getState().timeLeft).toBe(20 * 60);
    expect(useTimeStore.getState().isRunning).toBe(true);
  });

  it('keeps the remaining time correct across pause and resume', async () => {
    await useTimeStore.getState().startTimer();
    pulseAt(START + 10_000);

    vi.setSystemTime(START + 10_400);
    useTimeStore.getState().pauseTimer();
    expect(useTimeStore.getState().isRunning).toBe(false);
    expect(useTimeStore.getState().sessionEndAt).toBeNull();
    expect(useTimeStore.getState().timeLeft).toBe(25 * 60 - 10);

    // Time passing while paused does not count.
    vi.setSystemTime(START + 10 * MIN);
    useTimeStore.getState().tick(1);
    expect(useTimeStore.getState().timeLeft).toBe(25 * 60 - 10);

    await useTimeStore.getState().startTimer();
    expect(useTimeStore.getState().sessionEndAt).toBe(
      START + 10 * MIN + (25 * 60 - 10) * 1000
    );

    pulseAt(START + 10 * MIN + 5_000);
    expect(useTimeStore.getState().timeLeft).toBe(25 * 60 - 15);
  });

  it('emits timer:complete after the completed session is recorded (TIMER-6)', async () => {
    useTaskStore.setState({
      tasks: [
        {
          id: 'task-1',
          title: 'Write',
          completed: false,
          estPomodoros: 2,
          actPomodoros: 0,
        },
      ],
      activeTaskId: 'task-1',
    });
    const seen: Array<{
      mode: string;
      pomodorosCompleted: number;
      history: unknown;
    }> = [];
    const unsubscribe = events.on('timer:complete', () => {
      const state = useTimeStore.getState();
      seen.push({
        mode: state.mode,
        pomodorosCompleted: state.pomodorosCompleted,
        history: state.history,
      });
    });

    await useTimeStore.getState().startTimer();
    pulseAt(START + 25 * MIN + 100);
    unsubscribe();

    expect(seen).toEqual([
      {
        mode: 'short',
        pomodorosCompleted: 1,
        history: { '2026-09-28': { pomodoro: 1, short: 0, long: 0 } },
      },
    ]);
    expect(useTimeStore.getState()).toMatchObject({
      isRunning: false,
      sessionEndAt: null,
      timeLeft: 5 * 60,
    });
    expect(useTaskStore.getState().tasks[0]?.actPomodoros).toBe(1);
  });

  it('auto-starts the next session without restarting the worker pulse', async () => {
    useSettingsStore.setState({ autoStartBreaks: true });
    await useTimeStore.getState().startTimer();
    const worker = workerState.current!;
    expect(worker.start).toHaveBeenCalledTimes(1);

    pulseAt(START + 25 * MIN + 200);

    expect(useTimeStore.getState()).toMatchObject({
      mode: 'short',
      isRunning: true,
      timeLeft: 5 * 60,
      sessionEndAt: START + 25 * MIN + 200 + 5 * MIN,
    });
    await vi.runAllTimersAsync();
    expect(worker.start).toHaveBeenCalledTimes(1);
    expect(worker.pause).not.toHaveBeenCalled();
  });

  it('startTimer with timeLeft 0 starts a full session instead of recording a fake one (TIMER-6)', async () => {
    useTimeStore.setState({ timeLeft: 0 });
    const onComplete = vi.fn();
    const unsubscribe = events.on('timer:complete', onComplete);

    await useTimeStore.getState().startTimer();
    pulseAt(START + 1_000);
    unsubscribe();

    expect(onComplete).not.toHaveBeenCalled();
    expect(useTimeStore.getState()).toMatchObject({
      isRunning: true,
      timeLeft: 25 * 60 - 1,
      sessionEndAt: START + 25 * MIN,
      history: {},
      pomodorosCompleted: 0,
    });
  });

  it('syncWithWallClock catches up across several auto-started sessions', async () => {
    useSettingsStore.setState({
      autoStartBreaks: true,
      autoStartPomodoros: true,
    });
    await useTimeStore.getState().startTimer();

    // 25m pomodoro + 5m short break end, then 10 minutes into the next pomodoro.
    await useTimeStore.getState().syncWithWallClock(START + 40 * MIN);

    expect(useTimeStore.getState()).toMatchObject({
      mode: 'pomodoro',
      pomodorosCompleted: 1,
      isRunning: true,
      timeLeft: 15 * 60,
      sessionEndAt: START + 55 * MIN,
      history: { '2026-09-28': { pomodoro: 1, short: 1, long: 0 } },
    });
  });

  it('a late pulse after sleep replays missed sessions from the stored deadlines', async () => {
    useSettingsStore.setState({
      autoStartBreaks: true,
      autoStartPomodoros: true,
    });
    await useTimeStore.getState().startTimer();

    pulseAt(START + 40 * MIN);
    await vi.runAllTimersAsync();

    expect(40 * MIN - 25 * MIN).toBeGreaterThan(LATE_COMPLETION_CATCH_UP_MS);
    expect(useTimeStore.getState()).toMatchObject({
      mode: 'pomodoro',
      pomodorosCompleted: 1,
      timeLeft: 15 * 60,
      sessionEndAt: START + 55 * MIN,
    });
  });

  it('stops at the first session that does not auto-start when catching up', async () => {
    useSettingsStore.setState({
      autoStartBreaks: true,
      autoStartPomodoros: false,
    });
    await useTimeStore.getState().startTimer();

    await useTimeStore.getState().syncWithWallClock(START + 2 * 60 * MIN);

    expect(useTimeStore.getState()).toMatchObject({
      mode: 'pomodoro',
      pomodorosCompleted: 1,
      isRunning: false,
      sessionEndAt: null,
      timeLeft: 25 * 60,
      history: { '2026-09-28': { pomodoro: 1, short: 1, long: 0 } },
    });
  });

  it('reuses the running worker pulse on repeated focus syncs (TIMER-19)', async () => {
    await useTimeStore.getState().startTimer();
    const worker = workerState.current!;

    vi.setSystemTime(START + MIN);
    await useTimeStore.getState().syncWithWallClock();
    await useTimeStore.getState().syncWithWallClock();
    await useTimeStore.getState().syncWithWallClock();

    expect(worker.start).toHaveBeenCalledTimes(1);

    // A replacement worker (e.g. after a worker error) is started again.
    const replacement = createFakeWorker();
    workerState.current = replacement;
    await useTimeStore.getState().syncWithWallClock();
    expect(replacement.start).toHaveBeenCalledTimes(1);
  });

  it('restarts the pulse after a pause', async () => {
    await useTimeStore.getState().startTimer();
    const worker = workerState.current!;
    useTimeStore.getState().pauseTimer();
    await useTimeStore.getState().startTimer();

    expect(worker.pause).toHaveBeenCalledTimes(1);
    expect(worker.start).toHaveBeenCalledTimes(2);
  });

  it('ignores pulses while not running', () => {
    pulseAt(START + 30 * MIN);
    expect(useTimeStore.getState()).toMatchObject({
      isRunning: false,
      timeLeft: 25 * 60,
      pomodorosCompleted: 0,
    });
  });
});
