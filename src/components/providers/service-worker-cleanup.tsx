'use client';

import { useEffect } from 'react';

/**
 * Service Worker Cleanup Component
 * - Unregisters service workers in development to prevent Workbox console spam.
 * - Deletes the legacy front-end-nav "pages" cache. Older builds wrote the HTML of visited pages
 *   (decrypted journal, cycle and profile data) into it; nothing writes or reads it anymore.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.delete('pages').catch(() => {
        // Cache Storage can be unavailable (private mode, blocked storage); nothing to clean then.
      });
    }

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

