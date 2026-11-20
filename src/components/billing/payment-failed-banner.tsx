'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GENERIC_ERROR = 'Could not open the payment page. Please try again.';

/** Shown while Pro is in its grace period after a failed payment. */
export function PaymentFailedBanner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openPaymentPage = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(res.status === 404 && data.error ? data.error : GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    }
    setLoading(false);
  };

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-8"
    >
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          We couldn&apos;t take your last HealthHub Pro payment.
        </p>
        <p>
          You still have Pro while we retry. Please update your card so you
          don&apos;t lose it.
        </p>
        {error && <p className="text-red-700">{error}</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] shrink-0 gap-2"
        disabled={loading}
        onClick={() => void openPaymentPage()}
      >
        <CreditCard className="h-4 w-4" aria-hidden />
        {loading ? 'Opening…' : 'Update your card'}
      </Button>
    </div>
  );
}
