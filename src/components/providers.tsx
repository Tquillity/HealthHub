'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ReactNode, useEffect } from 'react';
import { ServiceWorkerCleanup } from './providers/service-worker-cleanup';

export function Providers({ children }: { children: ReactNode }) {
  // Suppress CSS preload warnings in development
  // These are false positives - CSS is loaded and used immediately
  // Next.js preloads CSS for performance, but browser timing detection can be off
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        // Filter out CSS preload warnings
        if (message.includes('preloaded using link preload but not used')) {
          return; // Suppress this warning
        }
        originalWarn.apply(console, args);
      };

      return () => {
        console.warn = originalWarn;
      };
    }
  }, []);

  return (
    <NuqsAdapter>
      <ServiceWorkerCleanup />
      {children}
    </NuqsAdapter>
  );
}
