import { POMO_TIME_STORAGE_KEY } from '@/lib/pomo/utils/dashboard-timer-snapshot';
import type { PomoStatePayload } from '@/lib/pomo/validation/pomo-state-schema';
import {
  PomoStatePayloadSchema,
  sanitizePomoPayloadHistory,
} from '@/lib/pomo/validation/pomo-state-schema';

function unwrapZustandPersist(raw: string | null): unknown {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

/** Build a server payload from legacy localStorage keys (Zustand persist envelope). */
export function buildPayloadFromLocalStorage(): PomoStatePayload | null {
  if (typeof window === 'undefined') return null;

  const timeState = unwrapZustandPersist(
    window.localStorage.getItem(POMO_TIME_STORAGE_KEY)
  );
  const settingsState = unwrapZustandPersist(
    window.localStorage.getItem('pomo-settings-storage')
  );
  const taskState = unwrapZustandPersist(
    window.localStorage.getItem('pomo-tasks-storage')
  );

  if (!timeState || typeof timeState !== 'object') {
    return null;
  }

  const candidate = {
    timeStore: timeState,
    taskStore: taskState ?? { tasks: [], activeTaskId: null },
    settingsStore: settingsState ?? undefined,
    timestamp: Date.now(),
    version: 3,
  };

  const result = PomoStatePayloadSchema.safeParse(
    sanitizePomoPayloadHistory(candidate)
  );
  return result.success ? result.data : null;
}
