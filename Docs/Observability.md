# HealthHub — Observability (Phase 9)

## Current state

- **Proxy:** Structured errors use `[HealthHub proxy]` prefix in `src/proxy.ts`.
- **Session:** `@/lib/session` — `getServerSession()`, `getSessionUserId()`, `requireSessionUserId()`.
- **Client surfaces:** `AppErrorBoundary` on groceries, meal planner, learn detail, routines, journal, recipe forms.
- **Server actions:** Catch blocks in meal/grocery/recipe action modules use `[HealthHub action]` prefix.
- **Stripe spike:** `[HealthHub stripe]` in webhook route (log-only).
- **Protected layout:** `export const dynamic = 'force-dynamic'` on `src/app/(protected)/layout.tsx` because layout reads session via `headers()` on every request.
- **CI:** `quality` job — `tsc`, `lint`, `test`, `build`. Optional `e2e` job with `continue-on-error: true`.

## Server action logging convention

```typescript
console.error('[HealthHub action] meal-plan-mutations clearAllMeals:', error);
```

Use the feature module name after the prefix for grep-friendly logs.

## Decision record (deferred)

| Option | Pros | Cons | Status |
|--------|------|------|--------|
| **Sentry** | Error grouping, releases, user context | Cost, PII review for health data | Not installed |
| **OpenTelemetry** | Traces + metrics, vendor-neutral | More setup for Next.js App Router | Not installed |

**Phase 9 decision:** **Do not install Sentry** until legal review of health/journal data handling (**S3-1**) completes. Continue with structured `console.error` prefixes and `AppErrorBoundary` for user-facing failures.

**If Sentry is adopted later:**

- Use `@sentry/nextjs` with PII scrubbing for journal fields
- Gate on `LEGAL_REVIEW_APPROVED` and a dedicated DPA
- Document release health in this file

## Manual auth proxy checklist

- Guest can open `/recipes`, `/learn`, `/timer` without redirect loop
- Protected routes redirect to `/sign-in` when logged out
- Session cookie present after sign-in; `/dashboard` loads

## E2E smoke

```bash
pnpm test:e2e:install
pnpm build && pnpm start   # separate terminal
pnpm test:e2e
```

CI: optional `e2e` job — non-blocking until stable.
