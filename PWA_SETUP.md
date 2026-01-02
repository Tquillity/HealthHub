# PWA Setup Instructions

## Icons Required

The PWA manifest references two icon files that need to be created:

1. `/public/logo192.png` - 192x192 pixels
2. `/public/logo512.png` - 512x512 pixels

### Quick Setup

You can generate these icons using any image editor or online tool:

1. Create a square logo/icon for HealthAssist
2. Export at 192x192 and 512x512 resolutions
3. Place both files in the `/public` directory

### Alternative: Use a placeholder service

You can temporarily use a placeholder service like:
- `https://via.placeholder.com/192` for logo192.png
- `https://via.placeholder.com/512` for logo512.png

Or create simple colored squares with text using an image editor.

## PWA Configuration

The PWA is configured in `next.config.ts` using `@ducanh2912/next-pwa`.

**Note:** PWA features are disabled in development mode. They will be active in production builds.

## Testing PWA

1. Build the app: `npm run build`
2. Start production server: `npm start`
3. Open in Chrome/Edge
4. Check "Application" tab in DevTools for Service Worker
5. Use "Add to Home Screen" to test install

## X (Twitter) OAuth Setup

To enable X (Twitter) OAuth:

1. Go to https://developer.twitter.com/en/portal/dashboard
2. Create a new app
3. Set callback URL to: `http://localhost:3000/api/auth/callback/x` (for development)
4. Add production callback URL when deploying
5. Copy Client ID and Client Secret
6. Add to `.env`:
   ```
   X_CLIENT_ID=your_client_id_here
   X_CLIENT_SECRET=your_client_secret_here
   ```

The OAuth flow is already configured in `src/lib/auth.ts`.

