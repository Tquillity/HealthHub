/**
 * @fileoverview Web Worker service for timer management.
 * 
 * Provides singleton access to the timer worker with proper lifecycle management.
 * Uses Comlink for type-safe communication between main thread and worker.
 * 
 * @module worker.service
 */

import * as Comlink from 'comlink';
import type { TimerWorkerAPI } from '@/lib/pomo/types/worker-types';

let workerInstance: Comlink.Remote<TimerWorkerAPI> | null = null;
let underlyingWorker: Worker | null = null;

/**
 * Get or create the timer worker instance.
 * 
 * Returns a singleton worker instance wrapped with Comlink for type-safe communication.
 * The worker is created lazily on first access.
 * 
 * @returns {Comlink.Remote<TimerWorkerAPI>} Worker API proxy
 */
export const getWorker = () => {
  if (!workerInstance) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are unavailable in this environment.');
    }

    const worker = new Worker(new URL('../../../workers/timer.worker.ts', import.meta.url), {
      type: 'module',
    });
    
    underlyingWorker = worker;
    
    worker.onerror = () => {
      if (underlyingWorker) {
        underlyingWorker.terminate();
        underlyingWorker = null;
      }
      workerInstance = null;
    };
    
    worker.addEventListener('error', () => {
      if (underlyingWorker) {
        underlyingWorker.terminate();
        underlyingWorker = null;
      }
      workerInstance = null;
    });
    
    workerInstance = Comlink.wrap<TimerWorkerAPI>(worker);
  }
  return workerInstance;
};

/**
 * Terminate the worker and clean up resources.
 * 
 * Should be called when the application is shutting down or when
 * the worker needs to be recreated.
 */
export const terminateWorker = () => {
  if (underlyingWorker) {
    underlyingWorker.terminate();
    underlyingWorker = null;
  }
  workerInstance = null;
};

