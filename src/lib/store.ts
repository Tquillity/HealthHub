/**
 * Global UI State Store (Zustand)
 * 
 * Manages cross-component UI state for modals, notifications, and drawers.
 * Use this for state that needs to be shared across multiple components
 * (e.g., triggering a toast notification from a Server Action response).
 * 
 * For URL-based state (filters, pagination), use nuqs instead.
 */

import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface UIState {
  // Modal states
  modals: {
    [key: string]: boolean;
  };
  
  // Toast notifications
  toasts: Toast[];
  
  // Drawer states
  drawers: {
    [key: string]: boolean;
  };
  
  // Actions
  openModal: (key: string) => void;
  closeModal: (key: string) => void;
  toggleModal: (key: string) => void;
  
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  
  openDrawer: (key: string) => void;
  closeDrawer: (key: string) => void;
  toggleDrawer: (key: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  modals: {},
  toasts: [],
  drawers: {},
  
  openModal: (key: string) =>
    set((state) => ({
      modals: { ...state.modals, [key]: true },
    })),
  
  closeModal: (key: string) =>
    set((state) => ({
      modals: { ...state.modals, [key]: false },
    })),
  
  toggleModal: (key: string) =>
    set((state) => ({
      modals: { ...state.modals, [key]: !state.modals[key] },
    })),
  
  showToast: (message: string, type: Toast['type'] = 'info', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }],
    }));
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
    
    return id;
  },
  
  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  
  openDrawer: (key: string) =>
    set((state) => ({
      drawers: { ...state.drawers, [key]: true },
    })),
  
  closeDrawer: (key: string) =>
    set((state) => ({
      drawers: { ...state.drawers, [key]: false },
    })),
  
  toggleDrawer: (key: string) =>
    set((state) => ({
      drawers: { ...state.drawers, [key]: !state.drawers[key] },
    })),
}));

