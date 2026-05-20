# HealthHub — Sprint Roadmap (Living Document)

**Last updated:** 2026-05-20  
**Baseline:** `main` + Phase 5–6 on `feature/phase-6-ux-seo`  
**Companion doc:** [`SprintList.md`](./SprintList.md) (detailed task IDs, acceptance criteria, risk register)

---

## Current phase status

| | |
|---|---|
| **Active phase** | **7** (Phase 6 complete) |
| **Branch baseline** | `feature/phase-6-ux-seo` |
| **Health** | CI green — `tsc`, `lint`, **30 tests**, `build` |
| **Just shipped** | EmptyState UX, Recipe JSON-LD, dynamic sitemap, two-tier recipe caching, a11y fixes |
| **Up next (Phase 7)** | S2-5 session helper · optional action splits · grocery aggregate tests |
| **Explicitly deferred** | Action file splits (until Phase 7), timer store refactors, Stripe/AdSense, Playwright E2E |

---

## Executive summary

HealthHub on `main` is **production-viable** with:

- CI: `tsc` → `lint` → **`pnpm test`** → `build`
- Zod on all Server Actions, metadata/OG, mobile protected nav + focus trap
- PWA icons, `/pro` stub, Vitest foundation (**30** unit tests)

This roadmap prioritizes **user-visible value** and **low architectural risk**. High-churn refactors (large action splits, timer store typing) and revenue work (AdSense, Stripe) are explicitly deferred.

---

## What not to prioritize (next 4–6 weeks)

| Item | Why defer |
|------|-----------|
| **`grocery-actions.ts` / `meal-actions.ts` splits** | High churn, low user visibility; boundary Zod already in place |
| **Pomo store / worker refactors** | High regression risk per `timer-pomo.mdc` |
| **Real Stripe / `User.isPremium` wiring** | Needs legal + product decisions; `/pro` stub is sufficient |
| **AdSense integration** | Blocked on **S3-1** lawyer-reviewed legal copy |
| **Full Playwright E2E suite** | Expand unit tests first; E2E after smoke design |
| **Timer cloud sync (S7-2)** | Premium-tier XL; local-first timer works well today |
| **JSON-LD everywhere** | Recipes done (S3-5); learn articles deferred |

---

## Phase overview

| Phase | Focus | Duration | Risk | Success criteria |
|-------|--------|----------|------|------------------|
| **5** | Product polish + SEO basics | 1 week | **Low** | Dashboard timer widget, sitemap live, a11y pass on public nav + timer modals, 25+ unit tests |
| **6** | UX depth + SEO | 1–2 weeks | **Low–Med** | ✅ Empty states, JSON-LD, two-tier caching |
| **7** | Architecture (optional) | 2+ weeks | **Med–High** | Session helper, one action file split per PR max |
| **8** | Monetization prep | When ready | **Med** | Legal v2, AdSense plan, observability |

**CI note:** Tests in CI are **already enabled** on `main` (not a remaining task).

---

## Phase 5 — Product polish & quality ✅ (complete)

**Goal:** Visible dashboard value, discoverability, accessibility, test depth — without touching timer internals.

| ID | Task | Status | Implementation notes |
|----|------|--------|----------------------|
| S4-2 | Timer dashboard widget | ✅ | `FocusGoalCard` reads `pomo-*-storage` read-only; link to `/timer` |
| S3-2 | Sitemap | ✅ | `src/app/sitemap.ts` — static public routes via `getMetadataBase()` |
| S4-4 | Accessibility pass | ✅ | Completed in Phase 6 (recipe-form labels, landing contrast) |
| S5-2 | Expand Vitest | ✅ | `timerSchedule.test.ts`, `dashboard-timer-snapshot.test.ts`, profile schema tests (25 total) |
| — | Proxy structured logging | ✅ | `[HealthHub proxy]` prefix in `src/proxy.ts` |

### Phase 5 success criteria

- [x] Signed-in user sees today’s pomodoro progress on `/dashboard`
- [x] `/sitemap.xml` returns 200 with core public URLs
- [x] Public nav exposes `aria-current="page"` on active route
- [x] `pnpm test` ≥ 25 tests, CI green
- [x] No changes to timer worker / Zustand store contracts

### Carried to Phase 6 (done)

- ~~S4-4 remainder~~ ✅
- ~~Dynamic sitemap recipe URLs~~ ✅

---

## Phase 6 — UX depth & SEO ✅ (complete)

**Goal:** Polish empty states and structured data; improve public route performance where safe.

| ID | Task | Status | Notes |
|----|------|--------|-------|
| S4-4 | A11y remainder | ✅ | `recipe-form` fieldset/labels; landing `text-primary-50` |
| S4-5 | Empty / error states | ✅ | `EmptyState` component; `useUIStore().showToast` in groceries/routines/meals |
| S3-5 | JSON-LD recipes | ✅ | `recipe-jsonld.ts` + Rich Results–ready script on detail page |
| S3-2 ext | Dynamic sitemap | ✅ | Public system `/recipes/[id]` URLs in `sitemap.ts` |
| S2-6 | Route caching | ✅ | Two-tier `recipe-cache.ts`; learn `force-dynamic` removed |

### Phase 6 success criteria

- [x] Groceries/routines/meal planner show helpful empty states with CTAs
- [x] Recipe detail pages emit valid `Recipe` JSON-LD
- [x] Learn/recipe caching documented in page comments; `revalidateTag(..., 'max')` on mutations
- [x] `pnpm test` ≥ 30 tests, CI green

### Caching trade-off (documented)

- **Public tier** (`recipe-public-*`, `recipes-public`): high hit rate for guests / SEO
- **Viewer tier** (`recipe-{userId}-*`): correctness for org-scoped recipes; lower hit rate accepted

---

## Phase 7 — Architecture debt (current)

| ID | Task | Effort | Risk |
|----|------|--------|------|
| S2-5 | `getSessionUserId()` in `src/lib/session.ts` | M | Low |
| S2-4 | Split large action files (one per PR) | XL | Med |
| S5-2 | Grocery aggregate unit tests | M | Low |
| S5-2 | Pomo store typing (no `any`) | L | **High** — defer unless dedicated timer sprint |

### Phase 7 success criteria

- At least one action file split with barrel re-exports; no import breakage
- Session helper used in ≥3 action files
- Grocery merge/normalize logic covered by Vitest

---

## Phase 8 — Monetization & compliance

| ID | Task | Blocker |
|----|------|---------|
| S3-1 | Lawyer review of Privacy/Terms | External |
| S7-1 | AdSense integration plan | S3-1 |
| S7-6 | Stripe + `User.isPremium` | Product + legal |
| S7-2 | Timer cloud sync (premium) | S7-6 |

---

## Recommended “Start Monday” sprint (Phase 7)

1. **S2-5** — `getSessionUserId()` helper in `src/lib/session.ts`
2. **S5-2** — Grocery aggregate unit tests
3. **S2-4** — One action file split (single PR, barrel re-exports)

**Verify locally:**

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build
```

---

## Completed Phase 6 sprint ✅

1. **S4-4** — Recipe form labels + landing contrast ✅  
2. **S4-5** — `EmptyState` + toasts ✅  
3. **S3-5** — Recipe JSON-LD ✅  
4. **S3-2 ext** — Dynamic sitemap recipe URLs ✅  
5. **S2-6** — Two-tier caching ✅  

---

## Completed “Start Monday” sprint (Phase 5) ✅

1. **S4-2** — Timer dashboard widget ✅  
2. **S4-4** — Public nav + timer modal a11y (partial) ✅  
3. **S3-2** — Sitemap ✅  
4. **S5-2** — Timer schedule + snapshot tests ✅  

---

## Branch & PR discipline

1. Branch from `main`: `Feature/s4-2-timer-widget` (or phase name)  
2. Read `AGENTS.md` + relevant `.cursor/rules/*.mdc`  
3. One logical PR per phase or task ID  
4. Update `Docs/SprintList.md` + this file after merge  
5. Run `/index` after new shared modules under `src/lib/`

---

## Appendix — Completed on `main` (Sprints 0–4)

| Area | Deliverable |
|------|-------------|
| Stabilizers | Legal stubs, `.env.example`, tsconfig S0-2, Zod on all actions |
| CI | GitHub Actions + Vitest in pipeline |
| PWA | `logo192` / `logo512`, `PWA_SETUP.md` |
| Premium | `/pro` stub, honest nav copy |
| SEO | `site-metadata.ts`, OG on public routes |
| Mobile | Protected drawer + focus trap |
| Tests | Cycle calculator + validation schemas |

---

*End of sprint roadmap.*
