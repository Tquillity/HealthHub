/** Interval between worker pulses. Sub-second so the display and completion track the wall clock closely. */
export const TIMER_PULSE_MS = 250;

export interface TimerWorkerAPI {
  /**
   * Start pulsing `callback` every {@link TIMER_PULSE_MS}. No-op while already pulsing.
   * The argument is a legacy nominal value; consumers derive time from the wall clock.
   */
  start(callback: (elapsedSeconds: number) => void): void;
  pause(): void;
  reset(): void;
}
