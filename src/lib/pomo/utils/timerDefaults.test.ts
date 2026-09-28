import { describe, expect, it } from 'vitest';
import { shouldResetSessionForDurationEdit } from '@/lib/pomo/utils/timerDefaults';

describe('shouldResetSessionForDurationEdit (TIMER-12)', () => {
  it('resets an idle session of the edited mode', () => {
    expect(shouldResetSessionForDurationEdit('pomodoro', 'pomodoro', false)).toBe(true);
  });

  it('never resets a running session', () => {
    expect(shouldResetSessionForDurationEdit('pomodoro', 'pomodoro', true)).toBe(false);
  });

  it('does not reset when another mode is edited', () => {
    expect(shouldResetSessionForDurationEdit('short', 'pomodoro', false)).toBe(false);
    expect(shouldResetSessionForDurationEdit('long', 'short', true)).toBe(false);
  });
});
