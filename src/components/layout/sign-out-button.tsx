'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface SignOutButtonProps {
  className?: string;
}

/**
 * Ends the Better-Auth session and returns to sign-in.
 * Also drops PWA runtime caches so a shared device does not keep signed-in pages around.
 */
export function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await signOut();
      if (result?.error) {
        throw new Error(result.error.message ?? 'Sign out failed');
      }
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      router.push('/sign-in');
      router.refresh();
    } catch (signOutError) {
      // Stay put: navigating would just bounce back while the session is still valid
      console.error('[HealthHub auth] Sign out failed:', signOutError);
      setError('Could not sign out. Please try again.');
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className={cn(
          'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-60',
          className
        )}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
        {isPending ? 'Signing out…' : 'Sign out'}
      </button>
      {error ? (
        <p role="alert" className="px-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </>
  );
}
