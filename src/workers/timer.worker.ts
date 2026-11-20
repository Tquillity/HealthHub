import * as Comlink from 'comlink';
import type { TimerWorkerAPI } from '@/lib/pomo/types/worker-types';
import { TIMER_PULSE_MS } from '@/lib/pomo/types/worker-types';

/**
 * Steady pulse only. The worker does not count time: the store derives the remaining time
 * from the wall-clock `sessionEndAt` on every pulse, so jitter, throttling or sleep can never
 * drop or double-count seconds (TIMER-2 / TIMER-5).
 */
let timerId: number | null = null;

const api: TimerWorkerAPI = {
  start(callback) {
    if (timerId !== null) return;
    timerId = self.setInterval(() => {
      callback(1);
    }, TIMER_PULSE_MS);
  },

  pause() {
    if (timerId !== null) {
      self.clearInterval(timerId);
      timerId = null;
    }
  },

  reset() {
    this.pause();
  },
};

Comlink.expose(api);
