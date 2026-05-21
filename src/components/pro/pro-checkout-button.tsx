'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

type ProCheckoutButtonProps = {
  disabled?: boolean;
};

export function ProCheckoutButton({ disabled }: ProCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      console.error('[HealthHub stripe] checkout:', data.error ?? res.status);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      className="min-h-[44px] gap-2"
      disabled={disabled || loading}
      onClick={() => void startCheckout()}
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      {loading ? 'Redirecting…' : 'Upgrade to Pro'}
    </Button>
  );
}
