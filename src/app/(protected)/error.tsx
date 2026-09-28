'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Route-level error UI for the authenticated app (keeps the sidebar layout). */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[HealthHub route error]', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600">
          This page could not be loaded. Your data is safe. Try again, or go
          back to the dashboard if the problem continues.
        </p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs text-gray-400">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={reset} className="min-h-[44px]">
          Try again
        </Button>
        <Link href="/dashboard" className="inline-flex">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] w-full"
          >
            Go to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
