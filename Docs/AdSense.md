# Google AdSense — integration plan (Phase 8)

**Status:** Planning only. **No ad scripts in the app until S3-1 legal review is complete.**

## Gate

- Lawyer-approved Privacy Policy and Terms (see `LEGAL_REVIEW_VERSION` in `src/lib/legal/constants.ts`)
- Cookie consent UX live (`src/components/legal/cookie-consent.tsx`)
- Set `NEXT_PUBLIC_ADSENSE_ENABLED=true` only after approval

## Environment variables

```env
# Publisher client id (ca-pub-xxxxxxxx)
NEXT_PUBLIC_ADSENSE_CLIENT=""
# Master switch — default false in all environments until legal sign-off
NEXT_PUBLIC_ADSENSE_ENABLED=false
```

## Recommended placements (phase 1)

| Surface | Placement | Rationale |
|---------|-----------|-----------|
| `/learn` list | Below hero, above grid | Public, content-rich |
| `/recipes` (public list) | Footer of list | Public, high traffic |
| `/learn/[id]` | Below article body | Long-form content |
| Protected routes | **None initially** | Avoid signed-in UX noise |

## Implementation sketch (future PR)

1. `src/components/ads/adsense-slot.tsx` — client component; returns `null` unless `NEXT_PUBLIC_ADSENSE_ENABLED === 'true'`.
2. Load script once in layout or slot via `next/script` with `strategy="afterInteractive"`.
3. Update Privacy Policy “Cookies and advertising” with actual AdSense cookie names after Google account setup.

## CSP / `next.config.ts`

When enabling scripts, allow:

- `https://pagead2.googlesyndication.com`
- `https://googleads.g.doubleclick.net`
- `https://tpc.googlesyndication.com`

Document any `headers()` CSP changes in the implementation PR.

## Rejection-risk checklist

- [ ] Substantive public content on `/learn` and `/recipes`
- [ ] Clear Privacy + Terms links in footer on all public pages
- [ ] No ads on auth-only or empty states
- [ ] Cookie consent before non-essential scripts
- [ ] No misleading health/medical claims adjacent to ads

## Cookie consent prerequisite

`src/components/legal/cookie-consent.tsx` is live (essential vs accept-all). Do not load ad scripts until this UX and lawyer-approved Privacy copy are in place.

## Related

- [`Docs/SprintList.md`](./SprintList.md) — S7-1, S3-1
- [`src/app/(public)/privacy/page.tsx`](../src/app/(public)/privacy/page.tsx)
