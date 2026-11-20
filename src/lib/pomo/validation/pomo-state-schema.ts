import { z } from 'zod';

/**
 * Payload limits shared by the server schema and the client stores/UI, so the client never
 * builds state that the server will reject (TIMER-11 / TIMER-16).
 */
export const POMO_LIMITS = {
  presetNameMax: 50,
  presetsMax: 50,
  taskTitleMax: 100,
  tasksMax: 1000,
  idMax: 64,
  /** Roughly ten years of daily history. */
  historyDaysMax: 3700,
} as const;

/** History keys are local calendar days (`yyyy-MM-dd`). */
export const POMO_HISTORY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const DailyStatsSchema = z.object({
  pomodoro: z.number().int().min(0),
  short: z.number().int().min(0),
  long: z.number().int().min(0),
});

export const TimerModeSchema = z.enum(['pomodoro', 'short', 'long']);

export const TimeStoreSchema = z.object({
  mode: TimerModeSchema,
  pomodorosCompleted: z.number().int().min(0).max(10000),
  timeLeft: z.number().int().min(0).optional(),
  isRunning: z.boolean().optional(),
  sessionEndAt: z.number().int().min(0).nullable().optional(),
  history: z
    .record(
      z
        .string()
        .regex(POMO_HISTORY_KEY_PATTERN, 'Expected a yyyy-MM-dd day key'),
      DailyStatsSchema
    )
    .refine(
      (history) => Object.keys(history).length <= POMO_LIMITS.historyDaysMax,
      {
        message: `History is limited to ${POMO_LIMITS.historyDaysMax} days`,
      }
    )
    .optional(),
});

export const TaskSchema = z.object({
  id: z.string().max(POMO_LIMITS.idMax),
  title: z.string().max(POMO_LIMITS.taskTitleMax),
  completed: z.boolean(),
  estPomodoros: z.number().int().min(1).max(100),
  actPomodoros: z.number().int().min(0).max(1000),
});

export const TaskStoreSchema = z.object({
  tasks: z.array(TaskSchema).max(POMO_LIMITS.tasksMax),
  activeTaskId: z.string().max(POMO_LIMITS.idMax).nullable().optional(),
});

export const SettingsStoreSchema = z.object({
  durations: z
    .object({
      pomodoro: z.number().int().min(1).max(60),
      short: z.number().int().min(1).max(60),
      long: z.number().int().min(1).max(60),
    })
    .optional(),
  themeColors: z
    .object({
      pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      long: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })
    .optional(),
  zenTrack: z.enum(['rain', 'white_noise', 'forest']).optional(),
  zenVolume: z.number().min(0).max(1).optional(),
  zenStrategy: z.enum(['always', 'break_only']).optional(),
  dailyGoalPomodoros: z.number().int().min(1).max(24).optional(),
  autoStartBreaks: z.boolean().optional(),
  autoStartPomodoros: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  zenModeEnabled: z.boolean().optional(),
  presets: z
    .array(
      z.object({
        id: z.string().max(POMO_LIMITS.idMax),
        name: z.string().max(POMO_LIMITS.presetNameMax),
        data: z.object({
          durations: z.object({
            pomodoro: z.number().int().min(1).max(60),
            short: z.number().int().min(1).max(60),
            long: z.number().int().min(1).max(60),
          }),
          themeColors: z.object({
            pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
            short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
            long: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          }),
          zenTrack: z.enum(['rain', 'white_noise', 'forest']),
          zenVolume: z.number().min(0).max(1),
          zenStrategy: z.enum(['always', 'break_only']),
        }),
      })
    )
    .max(POMO_LIMITS.presetsMax)
    .optional(),
});

export const PomoStatePayloadSchema = z.object({
  timeStore: TimeStoreSchema,
  taskStore: TaskStoreSchema,
  settingsStore: SettingsStoreSchema.optional(),
  timestamp: z.number().optional(),
  version: z.number().optional(),
});

export type PomoStatePayload = z.infer<typeof PomoStatePayloadSchema>;

export const DEFAULT_POMO_DURATIONS = {
  pomodoro: 25,
  short: 5,
  long: 15,
} as const;

export function createDefaultPomoStatePayload(): PomoStatePayload {
  return {
    timeStore: {
      mode: 'pomodoro',
      pomodorosCompleted: 0,
      timeLeft: DEFAULT_POMO_DURATIONS.pomodoro * 60,
      isRunning: false,
      sessionEndAt: null,
      history: {},
    },
    taskStore: {
      tasks: [],
      activeTaskId: null,
    },
    settingsStore: {
      durations: { ...DEFAULT_POMO_DURATIONS },
      dailyGoalPomodoros: 8,
    },
    timestamp: Date.now(),
    version: 3,
  };
}

/** Force paused session before persisting to PostgreSQL. */
export function normalizePomoStateForPersist(
  payload: PomoStatePayload
): PomoStatePayload {
  return {
    ...payload,
    timeStore: {
      ...payload.timeStore,
      isRunning: false,
      sessionEndAt: null,
    },
    timestamp: Date.now(),
    version: payload.version ?? 3,
  };
}

type DailyStatsRecord = z.infer<typeof DailyStatsSchema>;

/**
 * Drop history entries whose key is not a `yyyy-MM-dd` day and keep only the newest
 * `historyDaysMax` days, so legacy or oversized history cannot make every save fail.
 * Values are passed through unchanged; the schema still validates them.
 */
export function sanitizePomoHistory(
  history: unknown
): Record<string, DailyStatsRecord> | undefined {
  if (history === undefined || history === null) return undefined;
  if (typeof history !== 'object' || Array.isArray(history)) return undefined;

  const dayKeys = Object.keys(history)
    .filter((key) => POMO_HISTORY_KEY_PATTERN.test(key))
    .sort()
    .slice(-POMO_LIMITS.historyDaysMax);

  const source = history as Record<string, DailyStatsRecord>;
  const sanitized: Record<string, DailyStatsRecord> = {};
  for (const key of dayKeys) {
    sanitized[key] = source[key];
  }
  return sanitized;
}

/** Sanitize the history of an untrusted payload-shaped value before schema validation. */
export function sanitizePomoPayloadHistory(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const candidate = raw as { timeStore?: unknown };
  if (!candidate.timeStore || typeof candidate.timeStore !== 'object')
    return raw;
  const timeStore = candidate.timeStore as { history?: unknown };
  if (timeStore.history === undefined) return raw;
  return {
    ...candidate,
    timeStore: {
      ...timeStore,
      history: sanitizePomoHistory(timeStore.history),
    },
  };
}

/** Short, user-facing description of the first validation issue (e.g. `settingsStore.presets.0.name`). */
export function describePomoPayloadIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid timer payload';
  const path = issue.path.map((segment) => String(segment)).join('.');
  return path
    ? `Invalid timer payload: ${path} (${issue.message})`
    : `Invalid timer payload (${issue.message})`;
}

export const STORED_POMO_PAYLOAD_UNREADABLE_ERROR =
  'Saved timer data could not be read. It has been left unchanged; please retry or contact support.';

export type StoredPomoPayloadParseResult =
  | { ok: true; payload: PomoStatePayload; migrated: boolean }
  | { ok: false; error: string };

const historyKeyCount = (raw: unknown): number | null => {
  if (!raw || typeof raw !== 'object') return null;
  const timeStore = (raw as { timeStore?: unknown }).timeStore;
  if (!timeStore || typeof timeStore !== 'object') return null;
  const history = (timeStore as { history?: unknown }).history;
  if (history === undefined || history === null) return null;
  // Present but not a plain object: sanitization drops it, which counts as a change.
  if (typeof history !== 'object' || Array.isArray(history)) return -1;
  return Object.keys(history).length;
};

/**
 * Parse a stored `pomo_state.payload_json` row. Legacy history keys are dropped first
 * (`migrated: true` when that changed anything). A row that still fails validation is
 * reported as an error and must never be replaced with defaults: the next save would
 * otherwise overwrite the user's real data.
 */
export function parseStoredPomoPayload(
  raw: unknown
): StoredPomoPayloadParseResult {
  const sanitized = sanitizePomoPayloadHistory(raw);
  const parsed = PomoStatePayloadSchema.safeParse(sanitized);
  if (!parsed.success) {
    return { ok: false, error: STORED_POMO_PAYLOAD_UNREADABLE_ERROR };
  }
  return {
    ok: true,
    payload: parsed.data,
    migrated: historyKeyCount(raw) !== historyKeyCount(sanitized),
  };
}

export function parsePomoStatePayload(raw: unknown): PomoStatePayload | null {
  const result = PomoStatePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
