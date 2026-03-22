/**
 * @fileoverview Event service for application-wide event communication.
 * 
 * Provides a type-safe pub/sub system for timer events and other application events.
 * 
 * @module event.service
 */

import type { TimerMode } from '@/lib/pomo/types';

/**
 * Event type definitions for the application.
 * 
 * @interface PomoEvents
 * @property {TimerMode} 'timer:complete' - Emitted when timer completes
 * @property {number} 'timer:tick' - Emitted on each timer tick (time remaining)
 */
export interface PomoEvents {
  'timer:complete': TimerMode;
  'timer:tick': number;
}

/**
 * Helper type for event listener callbacks.
 * 
 * @template K - Event key type
 */
type Listener<K extends keyof PomoEvents> = (data: PomoEvents[K]) => void;

/**
 * Event service implementing pub/sub pattern with type safety.
 * 
 * @class EventService
 */
class EventService {
  private listeners: { [K in keyof PomoEvents]?: Listener<K>[] } = {};

  /**
   * Subscribe to an event.
   * 
   * @template K - Event key type
   * @param {K} event - Event name to listen to
   * @param {Listener<K>} fn - Callback function
   * @returns {() => void} Unsubscribe function
   */
  on<K extends keyof PomoEvents>(event: K, fn: Listener<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(fn);
    return () => this.off(event, fn);
  }

  /**
   * Unsubscribe from an event.
   * 
   * @template K - Event key type
   * @param {K} event - Event name
   * @param {Listener<K>} fn - Callback function to remove
   */
  off<K extends keyof PomoEvents>(event: K, fn: Listener<K>) {
    const listeners = this.listeners[event];
    if (!listeners) return;
    const filtered = listeners.filter(l => l !== fn);
    if (filtered.length === 0) {
      delete this.listeners[event];
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = filtered;
    }
  }

  /**
   * Emit an event to all subscribers.
   * 
   * @template K - Event key type
   * @param {K} event - Event name
   * @param {PomoEvents[K]} data - Event data
   */
  emit<K extends keyof PomoEvents>(event: K, data: PomoEvents[K]) {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach(fn => fn(data));
  }
}

export const events = new EventService();