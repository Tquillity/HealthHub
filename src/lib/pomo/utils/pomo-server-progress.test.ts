import { describe, expect, it } from 'vitest';
import { createDefaultPomoStatePayload } from '@/lib/pomo/validation/pomo-state-schema';
import { isEmptyPomoPayload, progressFromPomoPayload } from '@/lib/pomo/utils/pomo-server-progress';

describe('pomo server progress', () => {
  it('progressFromPomoPayload counts today pomodoros', () => {
    const today = new Date();
    const key = today.toISOString().slice(0, 10);
    const payload = createDefaultPomoStatePayload();
    payload.settingsStore = { dailyGoalPomodoros: 4 };
    payload.timeStore.history = {
      [key]: { pomodoro: 2, short: 0, long: 0 },
    };

    const progress = progressFromPomoPayload(payload, today);
    expect(progress.completed).toBe(2);
    expect(progress.goal).toBe(4);
    expect(progress.remaining).toBe(2);
  });

  it('isEmptyPomoPayload detects defaults', () => {
    expect(isEmptyPomoPayload(createDefaultPomoStatePayload())).toBe(true);
  });
});
