'use client';

import Link from 'next/link';
import type { PomoCloudPersistenceStatus } from '@/lib/pomo/hooks/usePomoCloudPersistence';

type PomoCloudStatusBannerProps = {
  status: PomoCloudPersistenceStatus;
  saveError: string | null;
  lastSavedAt: string | null;
  onRetry: () => void;
};

export function PomoCloudStatusBanner({
  status,
  saveError,
  lastSavedAt,
  onRetry,
}: PomoCloudStatusBannerProps) {
  if (status === 'loading' || status === 'local') {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="fixed bottom-28 left-1/2 z-50 flex max-w-md -translate-x-1/2 flex-col items-center gap-2 sm:bottom-24 md:bottom-20">
        <div className="rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white">
          {saveError ?? 'Cloud save failed'}
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] rounded-full bg-white/20 px-4 py-2 text-xs font-medium text-white hover:bg-white/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white sm:bottom-24 md:bottom-20">
      Cloud saved
      {lastSavedAt ? ` · ${new Date(lastSavedAt).toLocaleTimeString()}` : null}
      {' · '}
      <Link href="/pro" className="underline">
        Pro
      </Link>
    </div>
  );
}
