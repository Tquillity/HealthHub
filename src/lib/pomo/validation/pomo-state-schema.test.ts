import { describe, expect, it } from 'vitest';
import {
  createDefaultPomoStatePayload,
  normalizePomoStateForPersist,
  PomoStatePayloadSchema,
} from '@/lib/pomo/validation/pomo-state-schema';

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
});
