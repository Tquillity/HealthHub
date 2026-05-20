# HealthHub — Observability (Phase 7 stub)

## Current state

- **Proxy:** Structured errors use `[HealthHub proxy]` prefix in `src/proxy.ts`.
- **Client surfaces:** `AppErrorBoundary` wraps groceries, meal planner, and learn detail interactions.
- **Protected layout:** `export const dynamic = 'force-dynamic'` on `src/app/(protected)/layout.tsx` because the layout calls `auth.api.getSession({ headers })` on every request. Without it, Next.js can fail static export of child routes (e.g. meal planner) at build time. Trade-off: no static prerender for the authenticated segment.
- **CI:** `pnpm lint`, `tsc --noEmit`, `pnpm test`, `pnpm build` on push/PR.

## Decision record (deferred)

| Option | Pros | Cons | Status |
|--------|------|------|--------|
| **Sentry** | Error grouping, releases, user context | Cost, PII review for health data | Not installed |
| **OpenTelemetry** | Traces + metrics, vendor-neutral | More setup for Next.js App Router | Not installed |

**Recommendation:** Evaluate Sentry after legal review of health/journal data handling (**S3-1**). Start with server-action `console.error` prefixes and client `AppErrorBoundary` until then.

## Manual auth proxy checklist

- Guest can open `/recipes`, `/learn`, `/timer` without redirect loop
- Protected routes redirect to `/sign-in` when logged out
- Session cookie present after sign-in; `/dashboard` loads

## E2E smoke

See `e2e/smoke.spec.ts` and `playwright.config.ts`. Run locally:

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

CI wiring is optional until secrets for a test user are available.
