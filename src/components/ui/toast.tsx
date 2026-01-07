'use client';

/**
 * Toast Component
 * 
 * Displays toast notifications from the global Zustand store.
 * Should be rendered once in the root layout to show all toasts.
 */

import { useUIStore } from '@/lib/store';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex min-w-[300px] items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'border-wellness-200 bg-wellness-50 text-wellness-800'
              : toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : toast.type === 'warning'
              ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
              : 'border-primary-200 bg-primary-50 text-primary-800'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="h-5 w-5 flex-shrink-0" />}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Close toast"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

