import * as Comlink from 'comlink';
import type { TimerWorkerAPI } from '@/lib/pomo/types/worker-types';

let timerId: number | null = null;
let expectedTime: number = 0;
let lastTickTime: number = 0;

const api: TimerWorkerAPI = {
  start(callback) {
    if (timerId) return;

    const now = Date.now();
    lastTickTime = now;
    expectedTime = now + 1000;

    const tick = () => {
      const now = Date.now();
      const drift = now - expectedTime;
      
      const elapsedSeconds = Math.floor((now - lastTickTime) / 1000);
      lastTickTime = now;
      
      if (drift > 1000) {
        expectedTime = now + 1000;
        callback(elapsedSeconds);
      } else {
        callback(elapsedSeconds);
        expectedTime += 1000;
      }
      
      timerId = self.setTimeout(tick, Math.max(0, 1000 - drift));
    };

    timerId = self.setTimeout(tick, 1000);
  },

  pause() {
    if (timerId) {
      self.clearTimeout(timerId);
      timerId = null;
    }
  },

  reset() {
    this.pause();
    expectedTime = 0;
    lastTickTime = 0;
  }
};

Comlink.expose(api);