# HealthHub — Sprint Roadmap (Living Document)

**Last updated:** 2026-05-20  
**Baseline:** `main` @ `ee8c96d` and later  
**Companion doc:** [`SprintList.md`](./SprintList.md) (detailed task IDs, acceptance criteria, risk register)

---

## Current phase status

| | |
|---|---|
| **Active phase** | **5 → 6** (Phase 5 deliverables done; remainder folded into Phase 6) |
| **Branch baseline** | `main` @ `ee8c96d` + Sprint 5 polish (uncommitted) |
| **Health** | CI green locally — `tsc`, `lint`, **25 tests**, `build` |
| **Just shipped** | Focus dashboard widget, sitemap, expanded Vitest, proxy logging, partial a11y |
| **Up next (Phase 6)** | S4-5 empty/error states · S3-5 JSON-LD recipes · S4-4 remainder (recipe-form labels, hero contrast) |
| **Explicitly deferred** | Action file splits, timer store refactors, Stripe/AdSense, Playwright E2E |

---

## Executive summary

HealthHub on `main` is **production-viable** with:

- CI: `tsc` → `lint` → **`pnpm test`** → `build`
- Zod on all Server Actions, metadata/OG, mobile protected nav + focus trap
- PWA icons, `/pro` stub, Vitest foundation (**25** unit tests)

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
| **JSON-LD everywhere** | Start with recipes (S3-5) after sitemap lands |

---

## Phase overview

| Phase | Focus | Duration | Risk | Success criteria |
|-------|--------|----------|------|------------------|
| **5** | Product polish + SEO basics | 1 week | **Low** | Dashboard timer widget, sitemap live, a11y pass on public nav + timer modals, 25+ unit tests |
| **6** | UX depth + SEO | 1–2 weeks | **Low–Med** | Empty/error states, JSON-LD recipes, caching review documented |
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
| S4-4 | Accessibility pass (partial) | 🔄 | Public nav `aria-current`; timer `Modal` 44px close; protected drawer done — remainder → Phase 6 |
| S5-2 | Expand Vitest | ✅ | `timerSchedule.test.ts`, `dashboard-timer-snapshot.test.ts`, profile schema tests (25 total) |
| — | Proxy structured logging | ✅ | `[HealthHub proxy]` prefix in `src/proxy.ts` |

### Phase 5 success criteria

- [x] Signed-in user sees today’s pomodoro progress on `/dashboard`
- [x] `/sitemap.xml` returns 200 with core public URLs
- [x] Public nav exposes `aria-current="page"` on active route
- [x] `pnpm test` ≥ 25 tests, CI green
- [x] No changes to timer worker / Zustand store contracts

### Carried to Phase 6

- S4-4: `recipe-form.tsx` label audit, landing hero contrast check
- Dynamic sitemap entries for `/recipes/[id]` when DB-backed ISR strategy is chosen

---

## Phase 6 — UX depth & SEO (current)

**Goal:** Polish empty states and structured data; improve public route performance where safe.

| ID | Task | Effort | Risk |
|----|------|--------|------|
| S4-5 | Empty / error states | M | Low |
| S3-5 | JSON-LD for recipes | M | Low |
| S2-6 | Public route caching review | M | Med |

### Phase 6 success criteria

- Groceries/routines/meal planner show helpful empty states with CTAs
- Recipe detail pages emit valid `Recipe` JSON-LD (Rich Results Test)
- Learn/recipe list caching decision documented per route

### Implementation hints

- **S4-5:** Shared empty-state component; reuse toast patterns for action errors
- **S3-5:** `src/lib/structured-data/recipe-jsonld.ts` + inject in `recipes/[id]/page.tsx`
- **S2-6:** Try removing `force-dynamic` on learn list (already cached); document in page comment

---

## Phase 7 — Architecture debt (when bandwidth allows)

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

## Recommended “Start Monday” sprint (Phase 6)

1. **S4-5** — Empty / error states (groceries, routines, meal planner)
2. **S3-5** — JSON-LD for recipe detail pages
3. **S4-4 (remainder)** — `recipe-form.tsx` labels, landing hero contrast
4. **S2-6** — Public route caching review (document decisions)

**Verify locally:**

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build
```

**Manual smoke:** empty grocery list, recipe Rich Results Test, form labels in recipe editor, `/learn` load time.

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
