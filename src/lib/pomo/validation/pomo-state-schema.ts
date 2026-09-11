import { z } from 'zod';

export const TimerModeSchema = z.enum(['pomodoro', 'short', 'long']);

export const TimeStoreSchema = z.object({
  mode: TimerModeSchema,
  pomodorosCompleted: z.number().int().min(0).max(10000),
  timeLeft: z.number().int().min(0).optional(),
  isRunning: z.boolean().optional(),
  sessionEndAt: z.number().int().min(0).nullable().optional(),
  history: z
    .record(
      z.string(),
      z.object({
        pomodoro: z.number().int().min(0),
        short: z.number().int().min(0),
        long: z.number().int().min(0),
      })
    )
    .optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().max(100),
  completed: z.boolean(),
  estPomodoros: z.number().int().min(1).max(100),
  actPomodoros: z.number().int().min(0).max(1000),
});

export const TaskStoreSchema = z.object({
  tasks: z.array(TaskSchema).max(1000),
  activeTaskId: z.string().nullable().optional(),
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
        id: z.string(),
        name: z.string().max(50),
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
    .max(50)
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
export function normalizePomoStateForPersist(payload: PomoStatePayload): PomoStatePayload {
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

export function parsePomoStatePayload(raw: unknown): PomoStatePayload | null {
  const result = PomoStatePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
