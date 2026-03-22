'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TimerMode } from '@/lib/pomo/types';
import { createSafeStorage } from '@/lib/pomo/utils/storageWrapper';

export type ZenTrack = 'rain' | 'white_noise' | 'forest';

export interface Preset {
  id: string;
  name: string;
  data: {
    durations: Record<TimerMode, number>;
    themeColors: Record<TimerMode, string>;
    zenTrack: ZenTrack;
    zenVolume: number;
    zenStrategy: 'always' | 'break_only';
  }
}

interface SettingsState {
  durations: Record<TimerMode, number>;
  themeColors: Record<TimerMode, string>;
  dailyGoalPomodoros: number;
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  soundEnabled: boolean;
  isFocusMode: boolean;
  zenModeEnabled: boolean;
  zenTrack: ZenTrack;
  zenVolume: number;
  zenStrategy: 'always' | 'break_only';
  presets: Preset[];
  isAudioUnlocked: boolean;
  notificationsEnabled: boolean;
  
  updateDuration: (mode: TimerMode, minutes: number) => void;
  setDailyGoalPomodoros: (goal: number) => void;
  setThemeColor: (mode: TimerMode, color: string) => void;
  resetThemeColors: () => void;
  toggleAutoStartBreaks: () => void;
  toggleAutoStartPomodoros: () => void;
  toggleSound: () => void;
  toggleFocusMode: () => void;
  
  toggleZenMode: () => void;
  setZenTrack: (track: ZenTrack) => void;
  setZenVolume: (volume: number) => void;
  setZenStrategy: (strategy: 'always' | 'break_only') => void;
  toggleNotifications: () => void;

  addPreset: (name: string) => void;
  deletePreset: (id: string) => void;
  loadPreset: (id: string) => void;
  loadFactoryDefaults: () => void;
  unlockAudio: () => void;
}

const DEFAULT_THEME_COLORS = {
  pomodoro: '#c15c5c',
  short: '#52a89a',
  long: '#2c5578',
};

const DEFAULT_DURATIONS = { pomodoro: 25, short: 5, long: 15 };
const DEFAULT_DAILY_GOAL = 8;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      durations: DEFAULT_DURATIONS,
      themeColors: DEFAULT_THEME_COLORS,
      dailyGoalPomodoros: DEFAULT_DAILY_GOAL,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      soundEnabled: true,
      isFocusMode: false,
      
      zenModeEnabled: false,
      zenTrack: 'rain',
      zenVolume: 0.5,
      zenStrategy: 'always',
      presets: [],
      isAudioUnlocked: false,
      notificationsEnabled: false,

      updateDuration: (mode, minutes) => set((state) => ({
        durations: { ...state.durations, [mode]: minutes }
      })),
      setDailyGoalPomodoros: (goal) => set({
        dailyGoalPomodoros: Math.min(24, Math.max(1, goal))
      }),
      setThemeColor: (mode, color) => set((state) => ({
        themeColors: { ...state.themeColors, [mode]: color }
      })),
      resetThemeColors: () => set({ themeColors: DEFAULT_THEME_COLORS }),
      
      toggleAutoStartBreaks: () => set((state) => ({
        autoStartBreaks: !state.autoStartBreaks
      })),
      toggleAutoStartPomodoros: () => set((state) => ({
        autoStartPomodoros: !state.autoStartPomodoros
      })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
      
      toggleZenMode: () => set((state) => ({ zenModeEnabled: !state.zenModeEnabled })),
      setZenTrack: (track) => set({ zenTrack: track }),
      setZenVolume: (volume) => set({ zenVolume: volume }),
      setZenStrategy: (strategy) => set({ zenStrategy: strategy }),

      addPreset: (name) => {
        const { durations, themeColors, zenTrack, zenVolume, zenStrategy } = get();
        const newPreset: Preset = {
            id: crypto.randomUUID(),
            name,
            data: { durations, themeColors, zenTrack, zenVolume, zenStrategy }
        };
        set((state) => ({ presets: [...state.presets, newPreset] }));
      },

      deletePreset: (id) => set((state) => ({
        presets: state.presets.filter(p => p.id !== id)
      })),

      loadPreset: (id) => {
        const preset = get().presets.find(p => p.id === id);
        if (preset) {
            set({
                durations: preset.data.durations,
                themeColors: preset.data.themeColors,
                zenTrack: preset.data.zenTrack,
                zenVolume: preset.data.zenVolume,
                zenStrategy: preset.data.zenStrategy
            });
        }
      },

      loadFactoryDefaults: () => {
          set({
              durations: DEFAULT_DURATIONS,
              themeColors: DEFAULT_THEME_COLORS,
              zenTrack: 'rain',
              zenVolume: 0.5,
              zenStrategy: 'always',
              dailyGoalPomodoros: DEFAULT_DAILY_GOAL,
              autoStartBreaks: false,
              autoStartPomodoros: false,
              soundEnabled: true,
              zenModeEnabled: false
          });
      },
      unlockAudio: () => set({ isAudioUnlocked: true }),
      toggleNotifications: () => {
        const current = get().notificationsEnabled;
        if (!('Notification' in window)) {
          set({ notificationsEnabled: false });
          return;
        }

        if (Notification.permission === 'denied') {
          set({ notificationsEnabled: false });
          return;
        }

        if (!current && Notification.permission === 'default') {
          Notification.requestPermission().then((permission) => {
            set({ notificationsEnabled: permission === 'granted' });
          });
        } else {
          set({ notificationsEnabled: !current });
        }
      }
    }),
    { 
      name: 'pomo-settings-storage',
      version: 5,
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (state) => ({ 
        durations: state.durations, 
        themeColors: state.themeColors,
        dailyGoalPomodoros: state.dailyGoalPomodoros,
        autoStartBreaks: state.autoStartBreaks,
        autoStartPomodoros: state.autoStartPomodoros,
        soundEnabled: state.soundEnabled,
        zenModeEnabled: state.zenModeEnabled,
        zenTrack: state.zenTrack,
        zenVolume: state.zenVolume,
        zenStrategy: state.zenStrategy,
        presets: state.presets,
        notificationsEnabled: state.notificationsEnabled 
      }),
      migrate: (persistedState: unknown, version) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const state = persistedState as any;

          let migratedState = state;

          if (version === 3) {
            const oldPreset = state.savedPreset;
            const newPresets = [];
            if (oldPreset) {
              newPresets.push({
                id: 'migrated-legacy-preset',
                name: 'My Saved Preset',
                data: oldPreset
              });
            }
            migratedState = {
              ...state,
              presets: newPresets,
              savedPreset: undefined
            };
          } else if (version < 3) {
            migratedState = { ...state, presets: [] };
          }

          if (version < 5) {
            const legacyAutoStart = migratedState.autoStart ?? false;
            return {
              ...migratedState,
              dailyGoalPomodoros:
                migratedState.dailyGoalPomodoros ?? DEFAULT_DAILY_GOAL,
              autoStartBreaks:
                migratedState.autoStartBreaks ?? legacyAutoStart,
              autoStartPomodoros:
                migratedState.autoStartPomodoros ?? legacyAutoStart,
            };
          }

          return migratedState;
      }
    }
  )
);
