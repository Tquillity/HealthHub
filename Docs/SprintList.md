# HealthHub — Master Sprint Roadmap & Implementation Plan

**Last Updated:** 2026-05-20  
**Status:** Living document — update after every sprint  
**Roadmap (phases):** [`Docs/SprintRoadmap.md`](./SprintRoadmap.md)  
**Source Inputs:** Cursor May 2026 Review + Grok QC Feedback (QC passes 2–3) + `AGENTS.md` + live codebase analysis

---

## Executive Action Plan (one page)

| When | Focus | Exit criteria |
|------|--------|----------------|
| **Now (Sprint 0)** | Legal, env, tsconfig, footer, zod, safe lint | `/privacy` + `/terms` live; `.env.example`; lint count falling |
| **Week 1 (Sprint 1)** | Cursor rules, deps, CI prep, ESLint batch 2 | `.cursor/rules/*.mdc`, `AGENTS.md`, `eslint-config-next@16`, run `/index` |
| **Week 2 (Sprint 2)** | Zod on all actions, types, journal move done | No action file without Zod; `any` reduced in cycle/recipe |
| **Week 3+** | SEO, mobile, tests, premium stub | CI green; AdSense-ready content |

**Pre-flight (new developers):**

1. Node ≥20, pnpm 10.x  
2. `cp .env.example .env` and fill `DATABASE_URL`, `BETTER_AUTH_*`  
3. `pnpm install && pnpm db:push && pnpm db:seed`  
4. `pnpm dev` (webpack mode for PWA)

**Sprint 0 implementation status (2026-05-19):**

- [x] S0-1 `.env.example`  
- [x] S0-2 `tsconfig.json` (removed `.next/dev/types`)  
- [x] S0-3 `/privacy`, `/terms`  
- [x] S0-4 Footer guest-friendly (Explore + Account columns)  
- [x] S0-5 `.gitignore` pnpm store + `package-lock.json`  
- [x] S0-6 `zod` in `package.json` (run `pnpm install` locally)  
- [x] S0-7a ESLint batch 1 (safe) — 103 → 99 problems; **S0-7b** (deeper) in Sprint 1  
- [x] S2-3 Journal client → `src/components/journal/` (early)  
- [x] Sprint 1 partial: `.cursor/rules/*`, single `AGENTS.md` (merged from `CLAUDE.md`)  
- [x] Timer `cn` dedup — all timer components use `@/lib/utils`; removed `lib/pomo/utils/cn.ts`  
- [x] Terms: cycle/expert wellness disclaimer (QC pass 3)  
- [x] jcodemunch `/index` after rules (see Appendix A for latest counts)  

**Ready to commit:** Sprint 1 Zod + ESLint close-out (see §9 suggested commit).

**After pulling `.cursor/rules/` on another machine:** run **`/index`** (jcodemunch full reindex).

---

## 0. Executive Summary & Prioritization Framework

### Current state → target state

HealthHub is a **production-viable** Next.js 16 wellness super-app: recipes (alternatives + migration scripts), meal planner, groceries, routines, encrypted journal, cycle expert recommendations (Pelz/Sims), Learn hub, and a **production-grade PomoZen timer** (Web Worker + Comlink + Zustand + safe localStorage). Recent Super-App landing + public nav correctly position the product for discovery and AdSense.

**Target state (6–8 weeks):** AdSense/policy-ready public surface, zero lint blockers on CI, Zod on every Server Action, split maintainable action modules, mobile-friendly protected shell, legal pages, `.env.example`, project Cursor rules, basic test + CI gates, and honest premium/monetization UX.

### Prioritization principles

| Order | Principle | Rationale |
|-------|-----------|-----------|
| 1 | **Policy & revenue blockers** | Missing `/privacy` / `/terms` blocks AdSense and erodes trust |
| 2 | **Stability & DX** | `tsconfig`, lockfiles, ESLint, deps — prevent false confidence (`tsc` passes, `lint` fails) |
| 3 | **Architecture debt** | Zod, `any`, orphan imports, duplicate utilities — reduce regression risk |
| 4 | **Discoverability** | Caching/metadata on public routes |
| 5 | **Polish & features** | Mobile nav, timer widget, premium stub, observability |

### Legend

| Field | Values |
|-------|--------|
| **Priority** | P0 (this week) · P1 (1–2 weeks) · P2 (3–5 weeks) · P3 (backlog) |
| **Effort** | S (&lt;2h) · M (2–8h) · L (1–3 days) · XL (3+ days) |
| **Dependencies** | Task IDs that must complete first |

**Acceptance criteria** = verifiable “done” — not “looks good.”

---

## 1. Immediate Stabilizers (Sprint 0 — 1–2 days, P0)

| ID | Task | Files | Effort | Deps | Acceptance criteria |
|----|------|-------|--------|------|---------------------|
| S0-1 | **Add `.env.example`** | `.env.example` (new), `README.md` | S | — | Documents all required/optional env vars with comments; no secrets; README points to copy step |
| S0-2 | **Fix `tsconfig.json`** | `tsconfig.json` | S | — | Remove `.next/dev/types/**/*.ts` from `include`; keep `.next/types/**/*.ts` only if needed; `pnpm exec tsc --noEmit` still passes after `rm -rf .next` |
| S0-3 | **Legal pages (v1)** | `src/app/(public)/privacy/page.tsx`, `src/app/(public)/terms/page.tsx` | M | — | Routes return 200; footer links work; placeholders marked “requires legal review” |
| S0-4 | **Footer guest vs auth links** | `src/components/layout/footer.tsx` | S | S0-3 | Public footer does not link guests to protected-only routes without context; Privacy/Terms resolve |
| S0-5 | **Commit `.gitignore` pnpm store** | `.gitignore` | S | — | `.pnpm/`, `.pnpm-store/` ignored; Source Control clean of store artifacts |
| S0-6 | **Add direct `zod` dependency** | `package.json`, `pnpm-lock.yaml` | S | — | `"zod": "^4.x"` in `dependencies`; `pnpm install` succeeds |
| S0-7a | **ESLint batch 1 (safe only)** | See §1.1 | M | — | Unused vars, dead code, dialog/toast imports; **no** `cycle-actions.ts` or timer stores |
| S0-7b | **ESLint batch 2** | actions + cycle UI | L | S1-6 | `pnpm lint` exits 0 or &lt;10 documented suppressions |

### S0-1 — `.env.example` (copy-paste template)

```bash
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Better-Auth (required)
BETTER_AUTH_SECRET=""          # openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"

# Journal encryption (required in production; falls back to BETTER_AUTH_SECRET if unset)
ENCRYPTION_KEY=""

# OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
X_CLIENT_ID=""
X_CLIENT_SECRET=""

# Image upload (optional — Vercel Blob)
BLOB_READ_WRITE_TOKEN=""
USE_LOCAL_STORAGE="true"       # dev fallback when no blob token

# Seed script (optional)
ADMIN_EMAIL="admin@healthhub.com"
ADMIN_PASSWORD=""
ADMIN_NAME="Admin User"
```

**Verify:** New developer can copy `.env.example` → `.env` and run `pnpm install && pnpm db:push && pnpm dev`.

### S0-2 — `tsconfig.json` fix

**Change `include` to:**

```json
"include": [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  ".next/types/**/*.ts"
]
```

**Why:** `AGENTS.md` forbids `.next/dev/types/**`; including it causes TS “file not found” after `.next` clean.

**Verify:**

```bash
rm -rf .next && pnpm exec tsc --noEmit
```

### S0-3 — Legal pages

- Server Components; static content acceptable for v1.
- Sections: data collection, cookies, third-party ads (placeholder), contact email, last updated.
- Use `primary` / `wellness` tokens; `flex flex-col gap-*` for lists.
- Metadata: `title`, `description` per page.

**Verify:** `curl -I localhost:3000/privacy` → 200; footer links work.

### S0-4 — Footer (guest UX)

**Before:** Quick Links pointed guests at `/dashboard`, `/meal-planner`, `/routines` (proxy redirect to sign-in).  
**After:** **Explore** → `/timer`, `/recipes`, `/learn`; **Account** → sign-in/up + dashboard with note that planner/journal need auth.

### S1.1 — ESLint batch 1 (safe fixes only) — Sprint 0

**Do not** blind `eslint --fix` on `cycle-actions.ts` or timer stores.

| Category | Files | Safe action |
|----------|-------|-------------|
| Unused vars | `routines-client.tsx`, `routines-grid.tsx`, `dialog.tsx`, `toast.tsx`, `cycle-calculator.ts`, `hormone-math.ts`, `ingredient-alternatives.ts` | Remove or prefix `_` |
| Constant binary | `routines-client.tsx` ~L215 | Fix `true &&` dead code |
| Unused imports | Various UI | Remove |

**Verify:** `pnpm lint` — track error count down from **103** (94 errors, 9 warnings as of 2026-05-19).

---

## 2. Tooling, Hygiene & Cursor Rules (Sprint 1, P1)

| ID | Task | Priority | Effort | Deps |
|----|------|----------|--------|------|
| S1-1 | Create `.cursor/rules/server-actions.mdc` | P1 | S | S0-6 |
| S1-2 | Create `.cursor/rules/prisma-auth.mdc` | P1 | S | — |
| S1-3 | Create `.cursor/rules/timer-pomo.mdc` | P1 | S | — |
| S1-4 | Consolidate agent docs → single `AGENTS.md` | P1 | S | S1-1–3 | Done — removed redundant `CLAUDE.md` |
| S1-6 | Dependency hygiene | P1 | M | — |
| S1-7 | Single lockfile policy | P1 | S | — |
| S1-8 | Document `--webpack` in README | P1 | S | — |
| S1-9 | ESLint batch 2 (`any` in actions) | P1 | L | S0-7a |

### S1-1 — `server-actions.mdc`

```yaml
---
description: Server Action conventions — Zod, return shape, no API routes for CRUD
globs: src/actions/**/*.ts
alwaysApply: false
---
```

**Content (≤50 lines):** `'use server'`; Zod parse before DB; return `{ success, error?, data? }`; use `@/lib/auth` session helper; revalidatePath patterns; no `any`.

### S1-2 — `prisma-auth.mdc`

```yaml
---
description: Prisma schema, Better-Auth invariants, @@map, db push workflow
globs: prisma/**/*,src/lib/auth.ts,src/lib/db.ts,src/proxy.ts
alwaysApply: false
---
```

**Content:** `Session.token @unique`; `@@map` for lowercase tables; verify with `@postgres` MCP; `pnpm db:push` → `pnpm db:generate` → full dev restart.

### S1-3 — `timer-pomo.mdc`

```yaml
---
description: PomoZen timer — do not break worker/store contracts
globs: src/lib/pomo/**/*,src/lib/pomo-store/**/*,src/components/timer/**/*,src/workers/**/*
alwaysApply: false
---
```

**Content:** Local-first; import `cn` from `@/lib/utils` only; no server-side timer state without explicit sprint; Web Worker + Comlink invariants.

### S1-4 — Single agent manifest (done)

**Cursor May 2026:** Use **`AGENTS.md`** at repo root + **`.cursor/rules/*.mdc`** for scoped rules. Do **not** duplicate with `CLAUDE.md`.

Merged former `CLAUDE.md` content into `AGENTS.md`; deleted `CLAUDE.md`.

### S1-6 — Dependency hygiene

| Action | Package / file | Why |
|--------|----------------|-----|
| Bump | `eslint-config-next` → match Next 16 | Currently `15.1.0` vs `next@^16` |
| Remove (if unused) | `@prisma/adapter-neon`, `@neondatabase/serverless` | `src/lib/db.ts` uses `pg` + `@prisma/adapter-pg` only |
| Add | `zod` direct | Used in 6 action files; was transitive via better-auth |
| Align | `prisma` / `@prisma/client` versions | Reduce 7.1 vs 7.2 drift |

**Verify:**

```bash
pnpm install && pnpm lint && pnpm exec tsc --noEmit && pnpm build
```

### S1-7 — Single lockfile

**Current:** `pnpm-lock.yaml` + `package-lock.json` both present.

```bash
git rm --cached package-lock.json   # if tracked
echo "package-lock.json" >> .gitignore   # optional, if team uses pnpm only
```

**Acceptance:** One canonical lockfile (`pnpm-lock.yaml`); README says `pnpm` only.

### S1-8 — Document `--webpack`

In `README.md`:

> Dev/build use `--webpack` because `@ducanh2912/next-pwa` requires webpack. Turbopack is not the default for this repo.

---

## 3. Validation, Types & Code Quality (Sprint 2, P1)

| ID | Task | Priority | Effort | Deps |
|----|------|----------|--------|------|
| S2-1 | Zod on all actions | P1 | L | S0-6 |
| S2-2 | Replace `any` with Prisma types | P1 | L | S2-1 |
| S2-3 | Move journal client out of `(dashboard)` | P1 | S | — |
| S2-4 | Split large action files | P1 | XL | S2-1 |
| S2-5 | DRY: `cn`, `getSessionUser`, PageHeader | P1 | M | — |
| S2-6 | Public route caching strategy | P2 | M | S0-3 |

### S2-1 — Zod coverage matrix

| File | Has Zod today? | Sprint 2 action |
|------|----------------|-----------------|
| `recipe-actions.ts` | Yes | Tighten schemas; remove `any` in handlers |
| `meal-actions.ts` | Yes | Same |
| `journal-actions.ts` | Yes | Same |
| `profile-actions.ts` | Yes | Same |
| `household-actions.ts` | Yes | Same |
| `routine-actions.ts` | Yes | Same |
| `grocery-actions.ts` | **No** | Add input schemas per exported action |
| `cycle-actions.ts` | **No** | Add schemas; fix `(prisma as any)` |
| `education-actions.ts` | **No** | Add query/filter schemas |
| `image-upload.ts` | **No** | Add file/metadata schema |
| `ingredient-preference-actions.ts` | **No** | Add schemas (verified: no `zod` import) |

**Acceptance:** Every exported mutation validates with Zod; invalid input returns `{ success: false, error: string }`.

### S2-2 — `any` hotspots

| File | Approach |
|------|----------|
| `cycle-actions.ts` | `Prisma.PhaseRecommendationGetPayload`, `ExpertGetPayload`; ensure models in generated client |
| `recipe-actions.ts` | `Prisma.RecipeUpdateInput`, Zod-inferred types |
| `cycle-page-client.tsx` | Typed recommendation props from action return type |
| `meal-actions.ts` | Type `recipeWhere` as `Prisma.RecipeWhereInput` |
| Pomo stores | Typed `persist` migrate with `unknown` + type guards (not `any`) |

### S2-3 — Journal orphan

**Move:** `src/app/(dashboard)/journal/journal-page-client.tsx` → `src/components/journal/journal-page-client.tsx`

**Update import in:** `src/app/(protected)/journal/page.tsx`

**Delete:** empty `src/app/(dashboard)/` directory

**Verify:** `pnpm exec tsc --noEmit`; journal page loads.

### S2-4 — Split boundaries (suggested)

| Current file | LOC | Split into |
|--------------|-----|------------|
| `meal-actions.ts` | ~1038 | `meal-plan-queries.ts`, `meal-plan-mutations.ts`, `meal-auto-fill.ts` |
| `grocery-actions.ts` | ~842 | `grocery-aggregate.ts`, `grocery-list-mutations.ts` |
| `recipe-actions.ts` | ~760 | `recipe-queries.ts`, `recipe-mutations.ts` |
| `recipe-form.tsx` | ~1125 | `recipe-form-fields.tsx`, `recipe-ingredients-section.tsx`, `recipe-instructions-section.tsx` |

**Acceptance:** Reduce largest files below ~600 LOC where practical; barrel re-exports preserve imports. Files &gt;400 LOC need a brief justification comment if kept monolithic.

### S2-3 verify (journal path)

**Was:** `src/app/(dashboard)/journal/journal-page-client.tsx`  
**Now:** `src/components/journal/journal-page-client.tsx` — completed 2026-05-19

### S2-5 — Shared helpers

**Create `src/lib/session.ts`:**

```typescript
export async function getSessionUserId(): Promise<string | null> { /* auth.api.getSession + headers */ }
```

Refactor actions to use it (incremental, file per PR).

**Timer `cn`:** Done — all timer components import `@/lib/utils`; `lib/pomo/utils/cn.ts` removed.

### S2-6 — `force-dynamic` review

**Current public `force-dynamic`:**

- `src/app/(public)/recipes/page.tsx`
- `src/app/(public)/recipes/[id]/page.tsx`
- `src/app/(public)/learn/page.tsx`
- `src/app/(public)/learn/[id]/page.tsx`

**Recommendation:**

| Route | Strategy |
|-------|----------|
| Learn list | `unstable_cache` already used — try remove `force-dynamic`; use `revalidate` |
| Recipe list | ISR `revalidate: 3600` if data is mostly public/system |
| Detail pages | `generateStaticParams` for top N system items + dynamic fallback |

**Document decision** in each page file comment.

---

## 4. Legal, SEO, PWA & Compliance (Sprint 3, P1–P2)

| ID | Task | Priority | Effort | Deps |
|----|------|----------|--------|------|
| S3-1 | Legal content review | P1 | M | S0-3 |
| S3-2 | Footer + sitemap | P2 | S | S0-3 |
| S3-3 | PWA icons | P2 | S | — |
| S3-4 | Metadata / OG | P2 | M | S2-6 |
| S3-5 | JSON-LD (recipes) | P3 | M | S3-4 |

### S3-1 — Legal v2

- Lawyer review of Privacy + Terms.
- Cookie consent banner if AdSense + analytics added.
- GDPR/CCPA mention if EU/CA users expected.

### S3-2 — Sitemap ✅ (Sprint 5)

**File:** `src/app/sitemap.ts` — static public routes via `getMetadataBase()`: `/`, `/timer`, `/recipes`, `/learn`, `/privacy`, `/terms`, `/pro`, `/sign-in`, `/sign-up`. Dynamic recipe/learn IDs deferred until ISR strategy chosen.

### S3-3 — PWA icons ✅ (Sprint 2–3)

Committed `public/logo192.png` and `public/logo512.png` (`#2563eb` + “HH” mark). Manifest paths unchanged.

**Maintenance:** See `PWA_SETUP.md` for regeneration and verification (`pnpm build` → DevTools → Application → Manifest).

### S3-4 — Metadata ✅ (Sprint 4)

Shared helper: `src/lib/site-metadata.ts` (`createPageMetadata`, `metadataBase`, default OG `/logo512.png`).

| Route | Status |
|-------|--------|
| `/` | `createPageMetadata` on landing |
| `/timer` | OG + Twitter cards |
| `/recipes`, `/learn` | List page metadata + canonical |
| `/recipes/[id]`, `/learn/[id]` | `generateMetadata` per item |
| `/sign-in`, `/sign-up` | Auth layouts; `noIndex` |

Root `layout.tsx` sets `metadataBase` and title template.

---

## 5. UI/UX Polish & Mobile (Sprint 4, P2)

| ID | Task | Priority | Effort | Deps |
|----|------|----------|--------|------|
| S4-1 | Mobile nav (protected) | P2 | L | — |
| S4-2 | Timer dashboard widget | P2 | M | — |
| S4-3 | “Go Pro” → honest CTA | P2 | S | S5-4 stub |
| S4-4 | Accessibility audit | P2 | M | — |
| S4-5 | Empty / error states | P2 | M | — |

### S4-1 — Mobile protected nav ✅ (Sprint 4)

**Files:** `src/app/(protected)/layout.tsx`, `protected-nav-items.ts`, `protected-mobile-nav.tsx`

- Hamburger + slide-in drawer on `md:hidden`
- Reuses shared nav items; `min-h-[44px]` touch targets; `aria-current`, Esc to close, **Tab focus trap** in drawer
- Desktop sidebar unchanged

### S4-2 — Timer dashboard widget ✅ (Sprint 5)

**Files:** `src/components/dashboard/focus-goal-card.tsx`, `src/lib/pomo/utils/dashboard-timer-snapshot.ts`, `dashboard-client.tsx`

- Read `pomo-time-storage` / `pomo-settings-storage` from localStorage (read-only).
- Show today’s pomodoro count vs `dailyGoalPomodoros`; progress bar + link to `/timer`.
- **Do not** sync to DB in this sprint unless S7-2 approved.

### S4-4 — A11y checklist

- [x] Timer modals: focus trap, `aria-modal`, Esc close (existing); close button 44px touch target
- [ ] `recipe-form.tsx`: label/`htmlFor` on all fields
- [x] Public nav: `aria-current` on active route; `aria-label="Main"`
- [ ] Color contrast on landing hero text

---

## 6. Quality Gates & Testing (Sprint 5, P1–P2)

| ID | Task | Priority | Effort | Deps |
|----|------|----------|--------|------|
| S5-1 | GitHub Actions CI | P1 | M | S0-7, S1-6 |
| S5-2 | Unit tests (critical paths) | P2 | L | S5-1 |
| S5-3 | E2E smoke (Playwright) | P3 | L | S5-1 |

### S5-1 — CI workflow ✅ (Sprint 2–3)

**File:** `.github/workflows/ci.yml` — push/PR on `main`, `master`, `Feature/**`; concurrency group; placeholder env vars; steps: frozen `pnpm install`, `tsc --noEmit`, `lint`, **`pnpm test`**, `build` (webpack).

**Acceptance:** Workflow green on push/PR; local `pnpm lint`, `tsc --noEmit`, and `pnpm build` pass.

### S5-2 — Test matrix ✅ (Sprint 4 + Sprint 5 expand)

| Area | Tool | Status |
|------|------|--------|
| Cycle calculator | Vitest | `src/lib/cycle-calculator.test.ts` (phase boundaries) |
| Education + grocery + profile Zod | Vitest | `src/lib/validation/*.test.ts` |
| Grocery aggregate | Vitest | Deferred |
| Auth proxy | Integration | Deferred |
| Timer schedule | Vitest | `src/lib/pomo/utils/timerSchedule.test.ts` |
| Dashboard timer snapshot | Vitest | `src/lib/pomo/utils/dashboard-timer-snapshot.test.ts` |

**Scripts:** `pnpm test`, `pnpm test:watch`. Schemas extracted to `src/lib/validation/` for testability. **CI runs `pnpm test`** after lint.

---

## 7. Feature Completion & Future-Proofing (Sprint 6+, P2–P3)

| ID | Task | Priority | Effort | Notes |
|----|------|----------|--------|-------|
| S7-1 | AdSense integration plan | P3 | L | After S3-1 legal review |
| S7-2 | Timer optional DB sync (premium) | P3 | XL | New Prisma model `PomodoroDailyStat`; opt-in |
| S7-3 | Menu ↔ grocery deep link | P3 | L | Per `docs/legacy/food-heaven.md` |
| S7-4 | Expert cards → Learn | P3 | M | Link `PhaseRecommendation` to `EducationalResource` |
| S7-5 | Observability | P3 | M | Sentry or OpenTelemetry; structured server logs |
| S7-6 | Stripe / premium | P3 | XL | Wire `User.isPremium`; webhook |

### S7-4 — Premium stub ✅ (Sprint 2–3)

**Route:** `src/app/(public)/pro/page.tsx` — coming soon; **core tools stay free** + “always remain free” commitment section.

**Nav:** `public-nav.tsx` — **Sign Up** → `/sign-up`, **Go Pro** → `/pro`.

---

## 8. Cross-Cutting & Non-Functional

### Observability & error boundaries (Sprint 1 checklist)

- [x] Add structured `console.error` prefix in `src/proxy.ts` (`[HealthHub proxy]`)  
- [ ] Ensure feature routes use existing `ErrorBoundary` where client-heavy (timer modals already wrapped)  
- [ ] Evaluate Sentry (or similar) in Sprint 7 — not blocking Sprint 0  

### Recipe data scripts (reference)

Maintenance scripts in `scripts/` (`parse-recipe-alternatives.ts`, `fix-*.ts`) — document in README; not part of runtime app. Run manually after DB seed.

### Security checklist

| Item | Status | Action |
|------|--------|--------|
| `BETTER_AUTH_SECRET` required | OK | Document in `.env.example` |
| Journal `ENCRYPTION_KEY` | Partial | Document; warn if fallback to auth secret in prod |
| Proxy REST session | OK | `src/proxy.ts` — do not import Prisma in Edge |
| `BLOB_READ_WRITE_TOKEN` | Optional | Document local fallback |
| Auth API route | Required | `src/app/api/auth/[...all]/route.ts` — keep |

### Performance

- `experimental.optimizePackageImports: ['lucide-react']` — already in `next.config.ts`
- Consider dynamic import for `recharts` on cycle page only
- Timer worker — already off main thread

### Documentation

| Doc | Action |
|-----|--------|
| `README.md` | Super-App positioning, feature list, pnpm-only, env setup |
| `PWA_SETUP.md` | Keep; link from README |
| `CLINICAL_VALIDATION_REPORT.md` | Link from cycle feature docs |
| `docs/legacy/food-heaven.md` | Keep as migration reference |

### DRY / SOC / KISS grades (baseline)

| Principle | Grade | Sprint target |
|-----------|-------|---------------|
| DRY | B− | A− after S2-5 |
| SOC | B | A− after S2-4 |
| KISS | B+ | Maintain; resist new API routes for CRUD |

---

## 9. Execution Notes

### Progress tracking

- Use checkboxes in this file per sprint.
- Optional GitHub labels: `sprint-0`, `sprint-1`, … `P0`, `P1`.
- One PR per task ID where possible (e.g. `S0-3-legal-pages`).

### Suggested commit (Sprint 0 + scaffolding — QC approved)

```
chore: complete Sprint 0 stabilizers and Sprint 1 scaffolding

Add legal pages, env example, and guest-friendly footer. Fix tsconfig,
move journal client, add Cursor rules and agent docs. Add zod, bump
eslint-config-next, remove unused Neon adapter. Dedup timer cn helper.
ESLint 103 → 98 (safe batch). Update Docs/SprintList.md.
```

### Suggested commit (Sprint 1 Zod + ESLint — QC approved)

```
chore: add Zod to remaining actions and reduce ESLint debt

Validate grocery, cycle, education, image-upload, and ingredient-preference
server actions. Add src/types/cycle.ts; remove prisma any casts in cycle-actions.
ESLint 98 → 10 (0 errors). Document ESLint policy in AGENTS.md; keep tsconfig
S0-2 (.next/types only).
```

### Risk register

| Risk | Mitigation |
|------|------------|
| Timer refactor breaks worker | Follow `timer-pomo.mdc`; test manually; no logic changes in S0 |
| Large action split breaks imports | Barrel re-exports; one feature per PR |
| Prisma schema drift | `@postgres` MCP verify before `db push` |
| AdSense rejection | Legal review + substantive public content |
| ESLint autofix breaks behavior | Manual review; no autofix on `cycle-actions.ts` |
| `tsconfig.json` `.next/dev/types` regression | **Fixed** — include only `.next/types/**/*.ts` (S0-2); do not re-add dev types |
| `react-refresh` warnings (~10–11) | Accepted; documented in `AGENTS.md` § ESLint |
| CI placeholder env vars | Dummy `DATABASE_URL` + `BETTER_AUTH_*` only; no real secrets or DB in CI |
| PWA icon assets | Committed PNGs under `public/`; not hotlinked placeholders |
| `scripts/**` ESLint ignore | Maintenance scripts excluded from lint scope |
| `grocery-actions.ts` ~842 LOC | Boundary Zod only; file split deferred |

### Definition of Done (per sprint)

- [ ] All sprint task acceptance criteria met
- [ ] `pnpm lint` passes
- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm build` passes
- [ ] No secrets committed
- [ ] `Docs/SprintList.md` updated (checkboxes + date)
- [ ] After merge: run `/index` (jcodemunch)

### Post-change commands

```bash
pnpm install
pnpm db:push          # if schema changed
pnpm db:generate
# Stop dev server, rm -rf .next, restart:
pnpm dev
# Browser hard refresh after Server Action changes
```

### Cursor agent instructions

1. Read `AGENTS.md` + relevant `.cursor/rules/*.mdc`.
2. Schema work → `@postgres` MCP verify first.
3. Large merge → `/index` full reindex.
4. Commit → `/commit` (staged only).
5. Planning → this file.

---

## Next Immediate Actions

**Sprint 0–4 (CI, PWA, Pro stub, metadata, mobile nav, Vitest): complete.**

**Sprint 5 (Phase 5 — product polish): mostly complete — verify & merge**

- [x] **S4-2** — Timer dashboard widget (`FocusGoalCard`, read-only localStorage)
- [x] **S3-2** — Static sitemap (`src/app/sitemap.ts`)
- [x] **S5-2 expand** — Timer schedule + dashboard snapshot + profile schema tests
- [x] **S4-4 (partial)** — Public nav `aria-current`; timer modal close touch target
- [ ] **S4-4 (remainder)** — `recipe-form.tsx` labels, landing hero contrast
- [ ] **S3-5** — JSON-LD for recipes
- [ ] **S4-5** — Empty / error states
- [ ] **S5-3** — E2E smoke (Playwright) — defer until more unit coverage

**Phase 6+:** See [`Docs/SprintRoadmap.md`](./SprintRoadmap.md).

---

## Appendix A — Live codebase snapshot (2026-05-20, post Sprint 5 polish)

| Metric | Value |
|--------|-------|
| ESLint | **~18** problems (0 errors, warnings) — react-refresh on metadata pages |
| TypeScript | `tsc --noEmit` passes |
| Build | `pnpm build` passes |
| Tests | Vitest — **25+** tests in 4 files (`pnpm test`) |
| CI | `.github/workflows/ci.yml` — `quality` job: `tsc`, `lint`, **`test`**, `build` |
| Metadata | `src/lib/site-metadata.ts`; OG default `/logo512.png` |
| Mobile nav | Protected drawer on `< md` |
| PWA icons | `public/logo192.png`, `public/logo512.png` (committed PNGs) |
| jcodemunch | **179** files, **1057** symbols (post Sprint 4 `/index`) |
| Action files | 11 total; **11 with Zod** |
| Route groups | `(auth)`, `(protected)`, `(public)`, `(standalone)` |
| Timer route | `/timer` → `(standalone)/timer/page.tsx` |
| Journal client | `src/components/journal/journal-page-client.tsx` |
| Legal | `/privacy`, `/terms` live |
| Premium stub | `/pro` — coming soon; core features free |
| Lockfiles | `pnpm-lock.yaml` only (`package-lock.json` untracked) |
| `eslint-config-next` | 16.2.6 |

## Appendix B — Feature inventory

| Feature | Route(s) | Maturity |
|---------|----------|----------|
| Marketing landing | `/` | Good (post Super-App) |
| Focus timer (PomoZen) | `/timer` | Excellent (local-first) |
| Recipes | `/recipes` (public), edit/new (protected) | Strong |
| Learn | `/learn` | Good |
| Dashboard | `/dashboard` | Good |
| Meal planner | `/meal-planner`, templates | Strong |
| Groceries | `/groceries` | Strong (large actions) |
| Routines | `/routines` | Good |
| Journal (encrypted) | `/journal` | Good |
| Cycle + experts | `/cycle` | Strong |
| Profile / household | `/profile`, `/profile/household` | Good |
| Premium | `/pro` stub; `User.isPremium` in schema | Stub only |
| AdSense | — | Not implemented |
| Tests / CI | GitHub Actions + Vitest (`pnpm test` in CI) | 13 unit tests |

---

*End of master roadmap.*
