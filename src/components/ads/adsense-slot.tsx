'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

const CONSENT_KEY = 'healthhub-cookie-consent';

type AdsenseSlotProps = {
  slotId: string;
  className?: string;
};

function adsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
}

function hasAdConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CONSENT_KEY) === 'all';
}

/**
 * Renders nothing unless AdSense is enabled and user accepted cookies.
 * See Docs/AdSense.md — requires lawyer-approved legal copy first.
 */
export function AdsenseSlot({ slotId, className }: AdsenseSlotProps) {
  const [show, setShow] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  useEffect(() => {
    setShow(adsEnabled() && hasAdConsent());
  }, []);

  if (!show || !clientId) {
    return null;
  }

  return (
    <div className={className} data-ad-slot={slotId}>
      <Script
        id="adsense-loader"
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
        crossOrigin="anonymous"
      />
      <ins
        className="adsbygoogle block min-h-[90px] w-full"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
      <Script id={`adsense-push-${slotId}`} strategy="afterInteractive">
        {`(adsbygoogle = window.adsbygoogle || []).push({});`}
      </Script>
    </div>
  );
}
