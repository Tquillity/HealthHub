import { z } from 'zod';
import { useTimeStore } from '@/lib/pomo-store/useTimeStore';
import { useTaskStore } from '@/lib/pomo-store/useTaskStore';
import { useSettingsStore } from '@/lib/pomo-store/useSettingsStore';

const TimerModeSchema = z.enum(['pomodoro', 'short', 'long']);

const TimeStoreSchema = z.object({
  mode: TimerModeSchema,
  pomodorosCompleted: z.number().int().min(0).max(10000),
  timeLeft: z.number().int().min(0).optional(),
  isRunning: z.boolean().optional(),
  sessionEndAt: z.number().int().min(0).nullable().optional(),
  history: z.record(z.string(), z.object({
    pomodoro: z.number().int().min(0),
    short: z.number().int().min(0),
    long: z.number().int().min(0)
  })).optional()
});

const TaskSchema = z.object({
  id: z.string(),
  title: z.string().max(100),
  completed: z.boolean(),
  estPomodoros: z.number().int().min(1).max(100),
  actPomodoros: z.number().int().min(0).max(1000)
});

const TaskStoreSchema = z.object({
  tasks: z.array(TaskSchema).max(1000),
  activeTaskId: z.string().nullable().optional()
});

const SettingsStoreSchema = z.object({
  durations: z.object({
    pomodoro: z.number().int().min(1).max(60),
    short: z.number().int().min(1).max(60),
    long: z.number().int().min(1).max(60)
  }).optional(),
  themeColors: z.object({
    pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    long: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }).optional(),
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
  presets: z.array(z.object({
    id: z.string(),
    name: z.string().max(50),
    data: z.object({
      durations: z.object({
        pomodoro: z.number().int().min(1).max(60),
        short: z.number().int().min(1).max(60),
        long: z.number().int().min(1).max(60)
      }),
      themeColors: z.object({
        pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        long: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
      }),
      zenTrack: z.enum(['rain', 'white_noise', 'forest']),
      zenVolume: z.number().min(0).max(1),
      zenStrategy: z.enum(['always', 'break_only'])
    })
  })).max(50).optional()
});

const BackupFileSchema = z.object({
  timeStore: TimeStoreSchema,
  taskStore: TaskStoreSchema,
  settingsStore: SettingsStoreSchema.optional(),
  timestamp: z.number().optional(),
  version: z.number().optional()
});

const SettingsFileSchema = z.object({
  type: z.literal('pomozen_settings'),
  durations: z.object({
    pomodoro: z.number().int().min(1).max(60),
    short: z.number().int().min(1).max(60),
    long: z.number().int().min(1).max(60)
  }),
  themeColors: z.object({
    pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    long: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
  }),
  zenTrack: z.enum(['rain', 'white_noise', 'forest']),
  zenVolume: z.number().min(0).max(1),
  zenStrategy: z.enum(['always', 'break_only']),
  dailyGoalPomodoros: z.number().int().min(1).max(24).optional(),
  autoStartBreaks: z.boolean().optional(),
  autoStartPomodoros: z.boolean().optional(),
  presets: z.array(z.object({
    id: z.string(),
    name: z.string().max(50),
    data: z.object({
      durations: z.object({
        pomodoro: z.number().int().min(1).max(60),
        short: z.number().int().min(1).max(60),
        long: z.number().int().min(1).max(60)
      }),
      themeColors: z.object({
        pomodoro: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        short: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        long: z.string().regex(/^#[0-9A-Fa-f]{6}$/)
      }),
      zenTrack: z.enum(['rain', 'white_noise', 'forest']),
      zenVolume: z.number().min(0).max(1),
      zenStrategy: z.enum(['always', 'break_only'])
    })
  })).max(50)
});

const downloadJSON = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
};

export const exportData = () => {
  const data = {
    timeStore: useTimeStore.getState(),
    taskStore: useTaskStore.getState(),
    settingsStore: useSettingsStore.getState(),
    timestamp: Date.now(),
    version: 3
  };
  downloadJSON(data, `pomozen-backup-${new Date().toISOString().slice(0, 10)}.json`);
};

export const importData = async (file: File): Promise<boolean> => {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    
    const result = BackupFileSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("Invalid backup file format");
    }

    const data = result.data;

    const currentSettings = useSettingsStore.getState();
    const currentDurations = currentSettings.durations;
    const importedDurations = data.settingsStore?.durations;
    
    const effectiveDurations = importedDurations ?? currentDurations;

    if (data.settingsStore) {
      useSettingsStore.setState({
        durations: effectiveDurations,
        themeColors: data.settingsStore.themeColors ?? currentSettings.themeColors,
        zenTrack: data.settingsStore.zenTrack ?? currentSettings.zenTrack,
        zenVolume: data.settingsStore.zenVolume ?? currentSettings.zenVolume,
        zenStrategy: data.settingsStore.zenStrategy ?? currentSettings.zenStrategy,
        presets: data.settingsStore.presets ?? [],
        dailyGoalPomodoros:
          data.settingsStore.dailyGoalPomodoros ?? currentSettings.dailyGoalPomodoros,
        autoStartBreaks:
          data.settingsStore.autoStartBreaks ??
          data.settingsStore.autoStart ??
          currentSettings.autoStartBreaks,
        autoStartPomodoros:
          data.settingsStore.autoStartPomodoros ??
          data.settingsStore.autoStart ??
          currentSettings.autoStartPomodoros,
        soundEnabled: data.settingsStore.soundEnabled ?? currentSettings.soundEnabled,
        notificationsEnabled:
          data.settingsStore.notificationsEnabled ?? currentSettings.notificationsEnabled,
        zenModeEnabled: data.settingsStore.zenModeEnabled ?? currentSettings.zenModeEnabled
      });
    }

    const fallbackDuration = effectiveDurations[data.timeStore.mode] * 60;

    useTimeStore.setState({ 
      mode: data.timeStore.mode, 
      pomodorosCompleted: data.timeStore.pomodorosCompleted,
      timeLeft: data.timeStore.timeLeft ?? fallbackDuration,
      isRunning: false,
      history: data.timeStore.history ?? {},
      sessionEndAt: null
    });
    
    useTaskStore.setState({ 
      tasks: data.taskStore.tasks,
      activeTaskId: data.taskStore.activeTaskId ?? null
    });
    
    return true;
  } catch {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('storage-error', {
        detail: { message: 'Failed to import file. It may be corrupt or invalid.' }
      }));
    }
    return false;
  }
};

export const exportSettingsOnly = () => {
    const settings = useSettingsStore.getState();
    const exportable = {
        durations: settings.durations,
        themeColors: settings.themeColors,
        zenTrack: settings.zenTrack,
        zenVolume: settings.zenVolume,
        zenStrategy: settings.zenStrategy,
        dailyGoalPomodoros: settings.dailyGoalPomodoros,
        autoStartBreaks: settings.autoStartBreaks,
        autoStartPomodoros: settings.autoStartPomodoros,
        presets: settings.presets,
        type: 'pomozen_settings' as const
    };
    downloadJSON(exportable, `pomozen-settings.json`);
};

export const importSettingsOnly = async (file: File): Promise<boolean> => {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        const result = SettingsFileSchema.safeParse(parsed);
        if (!result.success) {
          throw new Error("Invalid settings file format");
        }

        const data = result.data;
        const currentSettings = useSettingsStore.getState();

        useSettingsStore.setState({
            durations: data.durations,
            themeColors: data.themeColors,
            zenTrack: data.zenTrack,
            zenVolume: data.zenVolume,
            zenStrategy: data.zenStrategy,
            dailyGoalPomodoros:
              data.dailyGoalPomodoros ?? currentSettings.dailyGoalPomodoros,
            autoStartBreaks:
              data.autoStartBreaks ?? currentSettings.autoStartBreaks,
            autoStartPomodoros:
              data.autoStartPomodoros ?? currentSettings.autoStartPomodoros,
            presets: data.presets
        });
        return true;
    } catch {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('storage-error', {
            detail: { message: 'Invalid settings file. It may be corrupt or invalid.' }
          }));
        }
        return false;
    }
};
