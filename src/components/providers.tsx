'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ReactNode } from 'react';
import { ServiceWorkerCleanup } from './providers/service-worker-cleanup';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <ServiceWorkerCleanup />
      {children}
    </NuqsAdapter>
  );
}
