'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Task } from '@/lib/pomo/types';
import { createSafeStorage } from '@/lib/pomo/utils/storageWrapper';

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  addTask: (title: string, est: number) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
  updateActPomo: (id: string) => void; // Increment actual pomodoros for a task
  clearTasks: () => void;
  clearCompletedTasks: () => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: [],
      activeTaskId: null,

      addTask: (title, est) => set((state) => ({
        tasks: [...state.tasks, {
          id: crypto.randomUUID(),
          title: title.trim().slice(0, 100),
          completed: false,
          estPomodoros: est,
          actPomodoros: 0
        }]
      })),

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        activeTaskId: state.activeTaskId === id ? null : state.activeTaskId
      })),

      toggleTask: (id) => set((state) => ({
        tasks: state.tasks.map((t) => t.id === id ? { ...t, completed: !t.completed } : t)
      })),

      setActiveTask: (id) => set({ activeTaskId: id }),
      
      updateActPomo: (id) => set((state) => ({
        tasks: state.tasks.map((t) => t.id === id ? { ...t, actPomodoros: t.actPomodoros + 1 } : t)
      })),

      clearTasks: () => set({ tasks: [], activeTaskId: null }),

      clearCompletedTasks: () => set((state) => ({
        tasks: state.tasks.filter((t) => !t.completed),
        activeTaskId: state.activeTaskId && state.tasks.find(t => t.id === state.activeTaskId)?.completed ? null : state.activeTaskId
      }))
    }),
    { 
      name: 'pomo-tasks-storage',
      storage: createJSONStorage(() => createSafeStorage())
    }
  )
);

