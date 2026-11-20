# PWA Setup Instructions

## Icons

Committed app icons live in `public/`:

| File | Size | Used for |
|------|------|----------|
| `logo512.png` | 512×512 | Install / splash icon (`any` and `maskable`), Open Graph image |
| `logo192.png` | 192×192 | Launcher icon (`any` and `maskable`), Apple touch icon, shortcut icons |

**Design:** `#2563eb` background with a white rounded “HH” mark, aligned with the in-app nav branding.
Both files are 4-bit palette PNGs (the artwork has five colours), which is lossless and about a third
smaller than the original RGB export.

**Manifest:** `public/manifest.json` lists each file twice, once with `"purpose": "any"` and once with
`"purpose": "maskable"`. Chrome warns against the combined `"any maskable"` value because one image
cannot have the right padding for both. `src/lib/pwa-manifest.test.ts` (part of `pnpm test`) checks that
every icon exists with the declared size, that `theme_color` matches the root layout, and that
`start_url` and the shortcuts point at real pages.

The installed app opens at `/dashboard` (`start_url`); signed-out users are sent to sign-in by
`src/proxy.ts`. `"id": "/"` keeps the app identity of installs made when `start_url` was `/`, so
those update in place instead of appearing as a second app.

### Regenerating icons

If you update branding, regenerate both sizes and commit them together:

- Keep the background full-bleed (no transparency) so the `maskable` entry works.
- Keep the mark inside the centre 80% circle, the maskable safe zone
  (https://web.dev/articles/maskable-icon). Check it at https://maskable.app.
- Export 512×512 and 192×192 PNGs. When the artwork has 256 colours or fewer, Pillow can convert
  them to palette PNGs without changing a pixel (the script checks this before saving):

```bash
python3 -c "
from PIL import Image
for name in ('logo192.png', 'logo512.png'):
    path = f'public/{name}'
    rgb = Image.open(path).convert('RGB')
    colors = rgb.getcolors(256)
    if colors is None:
        continue  # more than 256 colours: keep the RGB export
    flat = [value for _, color in colors for value in color]
    palette = Image.new('P', (1, 1))
    palette.putpalette(flat + [0] * (768 - len(flat)))
    indexed = rgb.quantize(palette=palette, dither=Image.Dither.NONE)
    assert indexed.convert('RGB').tobytes() == rgb.tobytes(), name
    indexed.save(path, optimize=True, bits=4 if len(colors) <= 16 else 8)
"
```

After changing icons, run `pnpm test` and `pnpm build`, then verify in Chrome DevTools → **Application** →
**Manifest** (icons load, no warnings).

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
