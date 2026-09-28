import { describe, expect, it } from 'vitest';
import {
  createDefaultPomoStatePayload,
  describePomoPayloadIssue,
  normalizePomoStateForPersist,
  POMO_LIMITS,
  PomoStatePayloadSchema,
  sanitizePomoHistory,
  sanitizePomoPayloadHistory,
} from '@/lib/pomo/validation/pomo-state-schema';

const day = (index: number) => {
  const date = new Date(Date.UTC(2000, 0, 1) + index * 86_400_000);
  return date.toISOString().slice(0, 10);
};

const stats = { pomodoro: 1, short: 0, long: 0 };

describe('pomo state schema', () => {
  it('accepts default payload', () => {
    const payload = createDefaultPomoStatePayload();
    expect(PomoStatePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('normalizePomoStateForPersist forces paused session', () => {
    const payload = createDefaultPomoStatePayload();
    payload.timeStore.isRunning = true;
    payload.timeStore.sessionEndAt = Date.now() + 60_000;

    const normalized = normalizePomoStateForPersist(payload);
    expect(normalized.timeStore.isRunning).toBe(false);
    expect(normalized.timeStore.sessionEndAt).toBeNull();
  });

  it('rejects oversized task list', () => {
    const payload = createDefaultPomoStatePayload();
    payload.taskStore.tasks = Array.from({ length: 1001 }, (_, i) => ({
      id: `t-${i}`,
      title: 'x',
      completed: false,
      estPomodoros: 1,
      actPomodoros: 0,
    }));
    expect(PomoStatePayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts yyyy-MM-dd history keys', () => {
    const payload = createDefaultPomoStatePayload();
    payload.timeStore.history = { '2026-09-28': stats };
    expect(PomoStatePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects history keys that are not yyyy-MM-dd', () => {
    for (const key of [
      'Mon Sep 28 2026',
      '2026-9-28',
      '__proto__x',
      '2026-09-28T00:00',
    ]) {
      const payload = createDefaultPomoStatePayload();
      payload.timeStore.history = { [key]: stats };
      expect(PomoStatePayloadSchema.safeParse(payload).success, key).toBe(
        false
      );
    }
  });

  it('caps history at the maximum number of days', () => {
    const atLimit = createDefaultPomoStatePayload();
    atLimit.timeStore.history = Object.fromEntries(
      Array.from({ length: POMO_LIMITS.historyDaysMax }, (_, i) => [
        day(i),
        stats,
      ])
    );
    expect(PomoStatePayloadSchema.safeParse(atLimit).success).toBe(true);

    const overLimit = createDefaultPomoStatePayload();
    overLimit.timeStore.history = Object.fromEntries(
      Array.from({ length: POMO_LIMITS.historyDaysMax + 1 }, (_, i) => [
        day(i),
        stats,
      ])
    );
    expect(PomoStatePayloadSchema.safeParse(overLimit).success).toBe(false);
  });

  it('limits task, active task and preset ids to 64 chars', () => {
    const longId = 'x'.repeat(POMO_LIMITS.idMax + 1);
    const okId = 'x'.repeat(POMO_LIMITS.idMax);
    const task = {
      title: 't',
      completed: false,
      estPomodoros: 1,
      actPomodoros: 0,
    };

    const okPayload = createDefaultPomoStatePayload();
    okPayload.taskStore.tasks = [{ ...task, id: okId }];
    okPayload.taskStore.activeTaskId = okId;
    expect(PomoStatePayloadSchema.safeParse(okPayload).success).toBe(true);

    const badTask = createDefaultPomoStatePayload();
    badTask.taskStore.tasks = [{ ...task, id: longId }];
    expect(PomoStatePayloadSchema.safeParse(badTask).success).toBe(false);

    const badActive = createDefaultPomoStatePayload();
    badActive.taskStore.activeTaskId = longId;
    expect(PomoStatePayloadSchema.safeParse(badActive).success).toBe(false);

    const badPreset = createDefaultPomoStatePayload();
    badPreset.settingsStore = {
      presets: [
        {
          id: longId,
          name: 'Deep work',
          data: {
            durations: { pomodoro: 25, short: 5, long: 15 },
            themeColors: {
              pomodoro: '#c15c5c',
              short: '#52a89a',
              long: '#2c5578',
            },
            zenTrack: 'rain',
            zenVolume: 0.5,
            zenStrategy: 'always',
          },
        },
      ],
    };
    expect(PomoStatePayloadSchema.safeParse(badPreset).success).toBe(false);
  });

  it('describes the failing field path for the error banner', () => {
    const payload = createDefaultPomoStatePayload();
    payload.settingsStore = {
      presets: [
        {
          id: 'p1',
          name: 'n'.repeat(POMO_LIMITS.presetNameMax + 10),
          data: {
            durations: { pomodoro: 25, short: 5, long: 15 },
            themeColors: {
              pomodoro: '#c15c5c',
              short: '#52a89a',
              long: '#2c5578',
            },
            zenTrack: 'rain',
            zenVolume: 0.5,
            zenStrategy: 'always',
          },
        },
      ],
    };
    const result = PomoStatePayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(describePomoPayloadIssue(result.error)).toMatch(
      /^Invalid timer payload: settingsStore\.presets\.0\.name \(/
    );
  });

  it('sanitizePomoHistory drops invalid keys and keeps the newest days', () => {
    const history: Record<string, typeof stats> = { 'not-a-day': stats };
    for (let i = 0; i < POMO_LIMITS.historyDaysMax + 5; i += 1) {
      history[day(i)] = stats;
    }
    const sanitized = sanitizePomoHistory(history)!;
    const keys = Object.keys(sanitized);
    expect(keys).toHaveLength(POMO_LIMITS.historyDaysMax);
    expect(keys).not.toContain('not-a-day');
    expect(keys).not.toContain(day(0));
    expect(keys).toContain(day(POMO_LIMITS.historyDaysMax + 4));
  });

  it('sanitizePomoPayloadHistory makes legacy stored payloads parse instead of resetting', () => {
    const raw = {
      ...createDefaultPomoStatePayload(),
      timeStore: {
        ...createDefaultPomoStatePayload().timeStore,
        pomodorosCompleted: 42,
        history: { 'Mon Sep 28 2026': stats, '2026-09-28': stats },
      },
    };
    expect(PomoStatePayloadSchema.safeParse(raw).success).toBe(false);
    const parsed = PomoStatePayloadSchema.safeParse(
      sanitizePomoPayloadHistory(raw)
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.timeStore.pomodorosCompleted).toBe(42);
    expect(parsed.data.timeStore.history).toEqual({ '2026-09-28': stats });
  });
});
