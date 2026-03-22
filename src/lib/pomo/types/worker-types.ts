export interface TimerWorkerAPI {
  start(callback: (elapsedSeconds: number) => void): void;
  pause(): void;
  reset(): void;
}

