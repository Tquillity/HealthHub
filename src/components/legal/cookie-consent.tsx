'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'healthhub-cookie-consent';
export const COOKIE_CONSENT_REOPEN_EVENT = 'healthhub-cookie-consent-reopen';

type ConsentValue = 'all' | 'essential';

/** Clears stored consent and re-opens the banner (e.g. footer “Manage preferences”). */
export function openCookiePreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_REOPEN_EVENT));
}

function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'all' || raw === 'essential') return raw;
  return null;
}

function writeConsent(value: ConsentValue) {
  localStorage.setItem(STORAGE_KEY, value);
}

/**
 * Non-blocking cookie notice. Does not load AdSense or analytics until
 * NEXT_PUBLIC_ADSENSE_ENABLED is true and product enables scripts separately.
 *
 * Phase 9+: optional "Manage preferences" link to reopen this bar after dismiss.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    const sync = () => {
      const value = readConsent();
      setHasConsent(value !== null);
      setVisible(value === null);
    };
    sync();
    const onReopen = () => {
      setHasConsent(false);
      setVisible(true);
    };
    window.addEventListener(COOKIE_CONSENT_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(COOKIE_CONSENT_REOPEN_EVENT, onReopen);
  }, []);

  const dismiss = (value: ConsentValue) => {
    writeConsent(value);
    setHasConsent(true);
    setVisible(false);
  };

  return (
    <>
    {hasConsent && !visible ? (
      <button
        type="button"
        onClick={openCookiePreferences}
        className="fixed bottom-4 left-4 z-40 min-h-[44px] rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Manage cookie preferences
      </button>
    ) : null}
    {visible ? (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white px-4 py-4 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          We use essential cookies for sign-in. Optional cookies for analytics or
          advertising may be added later — see our{' '}
          <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-700">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => dismiss('essential')}
          >
            Essential only
          </Button>
          <Button
            type="button"
            className="min-h-[44px]"
            onClick={() => dismiss('all')}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
    ) : null}
    </>
  );
}
