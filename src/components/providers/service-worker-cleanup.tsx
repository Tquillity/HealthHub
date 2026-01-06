'use client';

import { useEffect } from 'react';

/**
 * Service Worker Cleanup Component
 * Unregisters service workers in development to prevent Workbox console spam
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister().catch(() => {
              // Silently fail if unregistration fails
            });
          });
        });
      }
    }
  }, []);

  return null;
}

