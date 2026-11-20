import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';
import { SERVER_ACTION_BODY_LIMIT } from './src/lib/upload-limits';

const withPWA = withPWAInit({
  dest: 'public',
  // Front-end-nav caching stored the full HTML of every visited page, including decrypted journal,
  // cycle and profile data, in Cache Storage with no expiry, and nothing ever read it back
  // (runtimeCaching is empty). Keep authenticated pages out of the service worker.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  // A forced reload on reconnect threw away unsaved journal / recipe input.
  reloadOnOnline: false,
  // Every file in public/ is precached on install unless excluded here. The three ambient loops are
  // ~58 MB each, so without this every visitor (even on a recipe page from Google) downloaded ~174 MB.
  // They still stream normally when the timer plays them.
  publicExcludes: [
    '!noprecache/**/*',
    '!sounds/rain.mp3',
    '!sounds/forest.mp3',
    '!sounds/white_noise.mp3',
    '!uploads/**/*',
  ],
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
    // Next's default Server Action body limit is 1 MB, which rejected most phone photos before
    // uploadImage ran. See src/lib/upload-limits.ts.
    serverActions: {
      bodySizeLimit: SERVER_ACTION_BODY_LIMIT,
    },
  },
  // Recipe images uploaded via Vercel Blob (src/actions/image-upload.ts) render through next/image,
  // which rejects hosts that are not listed here.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
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
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
