import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Completely disable PWA in development to avoid workbox logs
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    // Suppress all workbox logging
    disableDevLogs: true,
    // Additional log suppression
    skipWaiting: true,
    clientsClaim: true,
    // Runtime caching with quiet logging
    runtimeCaching: [],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  // Add empty turbopack config to silence the warning
  // PWA plugin uses webpack, but we can use both
  turbopack: {},
  // Suppress CSS preload warnings - these are false positives in Next.js
  // The CSS is loaded and used immediately, but browser timing detection can be off
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Recipe images uploaded via Vercel Blob (src/actions/image-upload.ts) render through next/image,
  // which rejects hosts that are not listed here.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  // Baseline hardening for every route. A Content-Security-Policy is intentionally not set yet:
  // AdSense and Stripe need a reviewed allowlist first (see Docs/reviews).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
