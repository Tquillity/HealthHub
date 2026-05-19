# PWA Setup Instructions

## Icons

Committed app icons live in `public/`:

| File | Size | Purpose |
|------|------|---------|
| `logo512.png` | 512×512 | Master icon (maskable) |
| `logo192.png` | 192×192 | Smaller launcher icon |

**Design:** `#2563eb` background with a white rounded “HH” mark, aligned with the in-app nav branding.

**Manifest:** `public/manifest.json` references `/logo192.png` and `/logo512.png`. No hotlinked placeholders — both files must stay in the repo.

### Regenerating icons

If you update branding, regenerate both sizes and commit them together:

```bash
# Example: export 512×512 from your design tool, then resize to 192×192.
# Optional one-off (requires Pillow): adjust paths and run from repo root.
python3 -c "
from PIL import Image
from pathlib import Path
root = Path('public')
# ... same draw logic as Sprint 2–3, or load a master SVG/PNG export
"
```

After changing icons, run `pnpm build` and verify in Chrome DevTools → **Application** → **Manifest** (icons load without 404).

## PWA Configuration

The PWA is configured in `next.config.ts` using `@ducanh2912/next-pwa`.

**Note:** PWA features are disabled in development mode. They are active in production builds (`pnpm build` + `pnpm start`).

## Testing PWA

1. Build the app: `pnpm build`
2. Start production server: `pnpm start`
3. Open in Chrome/Edge
4. Check **Application** tab in DevTools for Service Worker
5. Use **Install** / **Add to Home Screen** to test install

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
