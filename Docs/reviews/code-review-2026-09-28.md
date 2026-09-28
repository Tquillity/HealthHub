# HealthHub — Full Code Review (2026-09-28)

**Baseline:** `main` @ `4eb3cd9`.
**Branch:** `feature/claude-full-review`.
**Method:** Five parallel read-only review agents, one per area: auth/billing/security; recipes/household/data; meal planner/groceries; cycle/journal/routines; focus timer. I then spot-checked the highest-severity findings against the code. Companion document: [`design-ux-review-2026-09-28.md`](./design-ux-review-2026-09-28.md).

**Confidence labels:**
- **confirmed**: traced in the code.
- **likely**: depends on library or runtime behaviour I did not execute.
- **spec**: speculative.

**✅ fixed** means fixed on this branch; every other item is open.

## Summary

| Area | Critical | High | Medium | Low |
|---|---|---|---|---|
| Auth, billing, security | – | 2 | 7 | 7 |
| Recipes, household, data layer | – | 3 (+1 dup) | 14 | 10 |
| Meal planner & groceries | 1 | 4 | 11 | 6 |
| Cycle, journal, routines | – | 4 | 9 | 7 |
| Focus timer (PomoZen) | – | 7 | 8 | 5 |

**Themes**

1. **Authorization is inconsistent across Server Actions.** Most actions scope by household. A handful do not; those are fixed on this branch. Server Actions can be POSTed to directly, so any action without a session check and a household scope is effectively a public API.
2. **Household model gaps block real users.** New sign-ups never get a household. Invitations cannot be accepted. The "current household" is picked by an unordered `findFirst`.
3. **Dates and timezones.** Date-only concepts (meal days, journal days, cycle days, "today" on the dashboard) are stored or compared as instants in the server's timezone. `User.timezone` exists but nothing reads it.
4. **The meal-plan data model fights the UI.** A new `MealPlan` row is created per viewed start date, so planned meals disappear from the board the next day while still counting on the grocery list.
5. **Premium/billing lifecycle is incomplete.** Handled: checkout, webhook signature and idempotency. Missing: `subscription.updated`, billing portal, a duplicate-subscription guard, and copy that matches reality.
6. **Timer cloud sync has several data-loss paths.** The local-first core is well built.

## What looks solid

- The Stripe webhook verifies the signature on the raw body. It claims idempotency atomically in the same transaction as the premium write, and re-fetches the subscription before activating.
- `role` and `isPremium` cannot be self-assigned. `updateProfile` maps fields explicitly.
- Journal access is keyed by `userId_date`, taken from the session. AES-256-GCM is used correctly (fresh IV, auth tag verified).
- The recipe visibility filter is resolved per request and included in `unstable_cache` keys, so cached private data cannot leak between users. The public SEO surfaces consistently restrict to `isSystem && !isSecret && !isPrivate`.
- Template actions, `clearAllMeals`, `getGroceryList`, `updateRoutine`/`deleteRoutine` and `removeMember` all scope correctly by organization.
- The timer's premium gate is re-read from the DB on every call. Payloads are Zod-validated. `SafeStorage` handles quota errors and blocked storage. Store migrations are versioned.
- Pure logic is well extracted (`grocery-aggregate`, `meal-auto-fill`, `cycle-calculator`, `timerSchedule`), which makes most fixes below easy to unit-test.

---

## Fixed on this branch

| ID | What was wrong | Fix |
|---|---|---|
| DATA-3 / UX-1 (part, High) | New sign-ups never got a household (only `seed.ts` created one), so the dashboard, planner, groceries and routines dead-ended or threw. | `ensurePersonalHousehold()` (`src/lib/household.ts`) runs from a Better-Auth `databaseHooks.user.create.after` hook and, as a backfill for existing users, from the protected layout. It is idempotent: deterministic ids plus `skipDuplicates`. Invite accept flow and email are still open. |
| DATA-2 (part, High) | `/recipes/<id>` returned 500 for Blob-hosted images (no `images.remotePatterns`). | Allowlisted `*.public.blob.vercel-storage.com`. Arbitrary pasted URLs still need host validation. |
| MEAL-1 (Critical) | `addMealToPlan` / `removeMealFromPlan` had no session check, no Zod and no ownership check. Anyone could add items to or delete from any household's plan. Adding another org's private recipe to your own plan leaked its full contents through the board and grocery list. | Both require a session and validate with Zod. The plan is scoped to the caller's household and the recipe to `buildRecipeVisibilityFilter`. Delete uses a household-scoped `deleteMany`. |
| MEAL-2 (High) | `toggleShoppingItem` updated by `id` only, so it worked across households. | `updateMany` scoped by `organizationId`. A foreign id returns an error. |
| AUTH-1 / DATA-1 (High) | `uploadImage` had no session check (free public Blob hosting). The extension was taken from the client filename, so `USE_LOCAL_STORAGE` could write `.html`/`.svg` into `public/` (stored XSS). | Requires a session. Checks magic bytes. Derives the extension from the validated MIME type and uses a UUID filename. Local-disk uploads are disabled in production. |
| HEALTH-11 (Medium) | `getRoutine(id)` returned any routine by id (IDOR). | Zod-validated id. Scoped to system routines plus the caller's household. |
| MEAL-5 (High) | Auto-fill used `hasSome` for dietary restrictions, so a vegan + gluten-free user got recipes matching either one (allergy risk). | `hasEvery`, with duplicates removed. |
| MEAL-6 (Medium) | The planner sidebar and auto-fill ignored `isSecret`/`isPrivate`. | Both use `buildRecipeVisibilityFilter`. |
| MEAL-16 (part) | Applying a template ran delete-all then create outside a transaction. | Wrapped in `$transaction`. The confirm dialog is still open. |
| HEALTH-1 / AUTH-8 (part) | `scryptSync` (≈43 ms, blocking) ran on every encrypt/decrypt, and journal arrays were unbounded. `/journal` cost seconds, and one crafted save could block the event loop for minutes. | The derived key is cached per secret. The journal schema caps lists at 50 items × 500 chars and text at 10k. |
| HEALTH-3 (High) | Ovulation was clamped to day ≥14, so cycles under 28 days showed the fertile window about a week late. | Shared `getOvulationDay()` = `cycleLength − 14` (floor day 6). Tests cover 20/21/24/28/35/45-day cycles. |
| HEALTH-7 (Medium) | The chart's phase bands left gap days (day 11 and 15 on 28-day cycles). | Bands share edges and clamp on short cycles. |
| HEALTH-4 (High) | Chart day dots mapped to dates counted from `lastPeriodDate` (possibly months ago), and `toISOString()` shifted dates back one day east of UTC. | Dates are counted from the current cycle start and formatted as a local `yyyy-MM-dd`. |
| HEALTH-5 (Medium) | `/cycle?phase=foo` crashed the page (`theme` undefined). | `parseAsStringLiteral` for `phase` and `mode`. |
| HEALTH-13 (part) | The journal page kept `useState(initialEntries)`, so saves and deletes did not show until a hard reload. Rows were unordered. | Entries come from props. Query uses `orderBy: date`. Per-month loading is still open. |
| HEALTH-14 (Low) | Calendar "next" on the 31st skipped February. | `startOfMonth` + `addMonths`/`subMonths`. |
| TIMER-1 (High) | On upgrade to premium, local timer history was deleted before the "import local data" check ran, so it was never imported. | Local data is read first. Local keys are cleared only after a successful cloud save. |
| TIMER-4 (High) | `tick()` ignored `isRunning`, so a worker still running after an import or pause kept counting and recorded fake completions. | `tick` returns early when not running. |
| TIMER-7 (High, mobile) | A throwing listener (`new Notification()` on Android Chrome) aborted `timer:complete` before the session was recorded. | `events.emit` isolates each listener with try/catch. |
| TIMER-13 (Medium) | Shortcuts ignored modifier keys. Ctrl+Shift+R (which the app's own tooltip suggests) reset the running session; Ctrl+F toggled focus mode. | Modifier and repeat keys are ignored. |
| AUTH-10 (Medium) | There was no way to sign out, which matters for health data on shared devices. | Sign-out button in the sidebar and mobile drawer. It also clears PWA caches. |
| AUTH-9 (part) | No security headers. | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`. CSP and HSTS are still open (see below). |
| MEAL-11 (part) | Substring matching silently removed "watermelon", "vattenmelon" and "watercress" from grocery lists. | Excluded items match whole words, with regression tests. Staple matching is still substring-based (see open list). |

### Pre-commit review of the fix package (Fable)
- **Blocker:** `next build` had auto-added `.next/dev/types/**` to `tsconfig.json`, which violates AGENTS.md S0-2. Reverted and not committed.
- **Fixed after review:**
  - The household slug now equals the id, so case can never cause a slug collision.
  - The sign-out button only navigates when sign-out succeeds; otherwise it shows an error.
  - The unused `lastPeriodDate` chart prop was removed.
  - The day-detail panel now uses the shared `getPhaseForDay()`; previously it had hard-coded 28-day boundaries (the HEALTH-6 slice).
- **Left as is, deliberately:**
  - **Planner hides a household's own `isPrivate` recipes.** The planner and auto-fill now use `buildRecipeVisibilityFilter`, which already hides these everywhere else (DATA-26). Fix it centrally in the filter.
  - **One extra membership query per protected request.** `ensurePersonalHousehold` adds it; it's cheap and indexed. Gate or remove it once existing accounts are backfilled.

---

## Open findings (recommended order)

### Do next: high impact
| ID | Sev | Location | Issue | Suggested fix |
|---|---|---|---|---|
| DATA-3 / UX-3 (rest) | High | `household-actions.ts`, `invite-member-form.tsx` | Invitations cannot be accepted (no email sender, no accept page), yet the UI says "Invitation sent". | Add `sendInvitationEmail`, an `/invite/[id]` accept page, and a pending list with resend and cancel. Once users can belong to several households, switch to `activeOrganizationId` (DATA-13). |
| MEAL-3 | High | `meal-plan-queries.ts:36-40,78-101` | `getWeeklyPlan` finds or creates a `MealPlan` by `startDate == today`, so **a new plan every day**. Yesterday's meals vanish from the board but still count on the grocery list. No unique `(organizationId, startDate)`. | Query items by household and date range, or keep one plan per household/ISO week with `@@unique` + upsert. Store dates as `@db.Date`. |
| MEAL-4 | High | `meal-auto-fill.ts:54-87` | The generator writes into the *Monday* plan and only fills through Sunday. The board shows the *today* plan, so "Generated 15 meals" shows nothing. | Generate over the board's visible range into the same plan/range the board reads. |
| DATA-4 | High | `use-recipe-form.ts`, `recipe-mutations.ts:282-307` | **Editing a recipe deletes all its ingredient alternatives** (ingredients are deleted and recreated; alternatives cascade). | Round-trip `alternatives` in the form, or diff ingredients instead of replacing them. |
| DATA-2 (rest) | Medium | `recipe-mutations.ts`, `recipes/[id]/page.tsx` | A pasted image URL on a non-allowlisted host still makes `/recipes/<id>` return 500. | Validate `imageUrl` against the allowlist, or relative `/uploads/`. |
| AUTH-2 / DATA-9 | High | `admin-credentials.ts`, `seed.ts`, `repair-admin-auth.ts` | Seed and repair create or promote a `superadmin` with the committed default password `Admin123!`, with no production guard. They promote a *pre-existing* account with that email, reset the password on every run, print it, and re-create system recipes with new IDs (breaking indexed URLs). | Refuse non-local DBs unless `ALLOW_PROD_SEED=1` and `ADMIN_PASSWORD` are set. Never promote an existing user. Never log the password. Upsert recipes by slug. |
| AUTH-5 | Medium→High | `src/lib/auth.ts` | No email verification, while Google OAuth is enabled. This allows account pre-hijacking (register a victim's email, and Google later links to that account) and invitation takeover. | `emailVerification` + `requireEmailVerification`, `requireEmailVerificationOnInvitation`, and account-linking only to verified users. Also add a password-reset flow. |
| AUTH-3 / AUTH-4 | Medium | `api/stripe/**`, `stripe-webhook.ts` | `customer.subscription.updated` (past_due/unpaid) is ignored, so users stay premium forever. Checkout creates a new customer each time and can create duplicate subscriptions; cancelling one sets `isPremium=false` while the other still bills. | Store `stripeCustomerId`/`stripeSubscriptionId`. Derive premium from `status ∈ {active, trialing}`. Block checkout if already active. Add Billing Portal. |
| AUTH-7 / UX-15 | Medium | `pro/page.tsx`, `adsense-slot.tsx` | The page says "we will not charge until Pro launches" while live checkout appears whenever Stripe env vars exist. "Ad-free" is not enforced for premium users. | An explicit `PRO_LAUNCHED` flag with matching copy. Pass `isPremium` to the ad slot. |
| AUTH-6 | Medium (likely) | `sign-in/page.tsx:58-64` | Social buttons GET `/api/auth/sign-in/social/google`, but Better-Auth expects `POST /sign-in/social`. They are also shown when providers aren't configured. | `authClient.signIn.social({ provider })`, and hide unconfigured providers. |
| HEALTH-2 / AUTH-8 | High | `encryption.ts` | The key silently falls back to `BETTER_AUTH_SECRET`, and `decrypt()` returns ciphertext on failure. **Rotating the auth secret (or setting `ENCRYPTION_KEY` later) makes every entry show as `salt:iv:tag:data`, and the next save double-encrypts it, which is permanent loss.** | Require `ENCRYPTION_KEY` in production. Use a versioned format (`v1:`) with a keyring of old keys. Never write back a failed decrypt. Pass `userId+field` as AAD. |
| HEALTH-12 / UX-16 | Medium | `phase-deep-dive.tsx:46`, `insight-center.tsx`, `hormone-math.ts` | Health copy contradicts the disclaimer: "clinically precise" curves, a "Peak fertility window" with no "not contraception" caveat, and luteal carbs "low" against the clinical report. | Use one copy source, add the caveat, and label the curves as illustrative. |
| TIMER-2 / TIMER-5 | High | `timer.worker.ts:20-31`, `useTimeStore.ts:224-241` | The worker floors elapsed seconds and resets its baseline, so jitter drops whole seconds and the countdown runs slow. After sleep/wake, elapsed time can be subtracted twice, ending a session early. | Derive `timeLeft` from `sessionEndAt` every tick; make the worker a plain pulse. |
| TIMER-3 | High | `usePomoCloudPersistence.ts:37-45,113-147` | After one failed save, auto-save stops. **Retry** re-hydrates from the server and overwrites unsaved progress. | Keep subscriptions active in the error state. Make Retry push local state, with backoff. |
| TIMER-6 | High | `useTimeStore.ts:189-204` | `timer:complete` fires before the state update, so the completion save persists the pre-completion state. `startTimer` with `timeLeft 0` records an instant fake pomodoro. | Emit after `set(nextSessionState)`. Guard `startTimer` against `timeLeft <= 0`. |
| TIMER-8 | Medium-High | `pomo-state.ts:82-92` | Blind last-write-wins upsert across devices and tabs. | Precondition on `updatedAt`, then merge (history max per day, tasks by id). |

### Medium
| ID | Location | Issue → Fix |
|---|---|---|
| MEAL-7 / HEALTH-8 / HEALTH-9 / TIMER-14 | meal board, cycle calculator, journal actions, dashboard | Date-only values are handled as server-timezone instants: board columns shift west of UTC, journal delete fails with P2025 on non-UTC hosts, and the dashboard "today" uses server time. → Store `@db.Date` / `YYYY-MM-DD`; compute "today" with `User.timezone`. |
| MEAL-8 / MEAL-9 | `print-manager.tsx`, `groceries/page.tsx` | Print and groceries use the Mon–Sun week, while the board shows a rolling 7/14/30 days. → Pass the explicit range. |
| MEAL-10 / MEAL-11 (rest) | `grocery-aggregate.ts:251` | Staples are summed across units (1 tsp + 10 g salt = "14.9 ml"), and the test asserts this. Staple substring matching also misfires ("cauliflower" → flour, "peanut butter" → butter). → Per-unit subtotals; tokenised matching that still handles Swedish compounds (olivolja, rödlök). |
| MEAL-12 / MEAL-13 | `grocery-list-client.tsx` | Check-state keys are index-based and inconsistent; merged rows toggle only the first id; plan-derived checks are lost on refresh. → Stable aggregation keys and persisted checks. |
| MEAL-14 / DATA-15 | `grocery-queries.ts:196`, `ingredient-preference-actions.ts:93` | N+1 preference lookups. `resolveIngredientChoice` is an exported action that accepts an arbitrary `userId`. → Batch-load preferences; move the helper out of `'use server'`. |
| MEAL-15 / DATA-10 | `profile-actions.ts:33`, `meal-planner-settings.tsx` | A bare `YYYY-MM-DD` string is passed to a Prisma `DateTime`, so a custom start date fails to save. → `z.iso.date()` + `Date.UTC`. |
| MEAL-16 (rest) | `meal-plan-templates-client.tsx` | "Apply template" wipes the plan with no confirmation. → Confirm dialog + "fill empty slots" mode. |
| DATA-5 / HEALTH-10 | recipe form, journal actions | Cleared optional fields are sent as `undefined` and silently kept, including sensitive journal notes (privacy). → Send `null`; `.nullable()` schemas. |
| DATA-6 | `use-recipe-form.ts:227-234` | "Set as main image" drops another image (filters twice). |
| DATA-7 | `recipe-mutations.ts:223,345` | A plain `admin` can update or delete another household's recipes and secret recipes. → Load through the visibility filter. |
| DATA-8 | `schema.prisma:236,265` | A recipe that is used in any plan cannot be deleted (Restrict), and `seed.ts` crashes. → Cascade or soft-delete. |
| DATA-11 / DATA-12 / DATA-13 / AUTH-12 | household actions, `auth.ts` | The invite fallback bypasses Better-Auth checks. Default org-plugin permissions differ from the app's rules. Membership is resolved by unordered `findFirst`, and `Member` has no `@@unique`. → `requireHousehold()` helper using `activeOrganizationId`; configure the plugin. |
| DATA-14 | `education-actions.ts`, learn pages | `unstable_cache` caches failures for 1h. View counting runs on every metadata call and bumps `updatedAt`, which churns sitemap `lastmod`. |
| DATA-16 / DATA-17 | recipe list | No pagination; unbounded cache keys from `?q=`; `?dietaryTags=a,b` is parsed differently on server and client, so reloads show 0 results. |
| DATA-18 | `grocery-queries.ts:211` | A recipe without `servings` gets ×4 quantities on the grocery list. |
| DATA-19 | `schema.prisma` | Missing FK indexes (Ingredient/Instruction.recipeId, MealPlanItem.mealPlanId, ShoppingListItem.organizationId, Recipe.organizationId, …). |
| HEALTH-6 | chart tooltip, quick look, `hormone-math.ts` | Hard-coded 28-day phase boundaries disagree with the dynamic calculator on non-28-day cycles. → Use one `getPhaseForDay()` everywhere. |
| HEALTH-13 (rest) | journal page | Only the current month is loaded, so previous months look empty. |
| HEALTH-16 | cycle/journal/routine actions | Zod gaps; `drawLottery` passes client filters straight into the Prisma `where`. |
| TIMER-9 / TIMER-10 / TIMER-11 / TIMER-12 / TIMER-15 | timer | Re-hydrate on session object identity; completions after leaving `/timer` are not saved; a 60-char preset name makes every save fail; editing any duration resets the running session; two tabs overwrite each other. |
| AUTH-13 / UX-54 / UX-55 | pro page | A 401 on checkout is silent; there is no success banner and no way to cancel. |
| AUTH-14 | ads/consent | The ad gate skips the legal-approval flag. "Accept" enables ads that the banner says "may be added later". No Consent Mode v2 for EEA traffic. |
| AUTH-9 (rest) | `next.config.ts` | Add CSP (allowlist Stripe and AdSense) and HSTS. |

### Low (selection)
- **AUTH-11**: the proxy fetches the session from the `Host`-derived origin. Use `BETTER_AUTH_URL`.
- **AUTH-15**: the webhook's `update` on a deleted user throws P2025, which makes Stripe retry for 3 days. Use `updateMany`.
- **AUTH-16**: the checkout API route contradicts the AGENTS.md "Server Actions only" rule. Convert it or document an exception.
- **MEAL-17**: template share links 404 (`/meal-planner/templates/shared/[token]` does not exist).
- **MEAL-18 / UX-35**: drag-and-drop add/remove has no optimistic state and no error feedback, and the delete button is hover-only.
- **MEAL-19**: auto-fill picks with replacement (the same dinner 3–4×), and `healthGoals` is ignored.
- **MEAL-21**: grocery CSV export does not escape quotes (and allows formula injection). Quantities display as "0.0".
- **DATA-20 / DATA-21 / DATA-22**: ingredient order is unstable. Unit substring matching is wrong ("eggplant" → egg). Scaled quantities round to 0.
- **DATA-23**: Learn JSON-LD does not escape `<`. **DATA-24**: likes can be incremented without limit. **DATA-26**: `isPrivate` recipes are invisible even to their owner.
- **HEALTH-15**: routine edit/delete is unreachable in the UI. **HEALTH-17**: there is no "late period" state. **HEALTH-18**: Insight Center race conditions. **HEALTH-20**: arbitrary routine `imageUrl` allows a tracking pixel.
- **TIMER-16 / TIMER-17 / TIMER-18 / TIMER-19**: unbounded premium payload keys; the `beforeunload` save is unreliable; sign-out may persist premium state to localStorage; a Comlink proxy leaks per focus event.
- **Rule drift** (AGENTS.md):
  - Zod is missing on several actions.
  - `useEffect` is used for initial data (templates, timer cloud state, cycle insights).
  - `any` appears in the timer stores.
  - `space-y-*` is used on interactive containers.
  - There are hardcoded hex colours in cycle and printables.
  - "Offline First" copy, while `runtimeCaching: []`.

---

## Suggested roadmap
1. **Unblock real users (1–2 days):**
   - accept-invite page (household auto-create is done)
   - email verification and password reset
   - `error.tsx` / `not-found.tsx`
   - `remotePatterns`
2. **Data model correctness (2–4 days):**
   - calendar-date meal items per household
   - `@db.Date` for journal and meal dates
   - `User.timezone` wired end to end
   - one cycle model (`getPhaseForDay`)
   - recipe alternatives round-trip
   - FK indexes
3. **Billing lifecycle (1–2 days):**
   - subscription status sync
   - customer and subscription ids stored
   - Billing Portal
   - a launch flag with honest copy
4. **Timer sync hardening (2–3 days):**
   - `sessionEndAt`-derived time
   - versioned merge
   - Retry fix
   - an app-root persistence provider
5. **Security hardening (1 day):**
   - seed guards
   - CSP and HSTS
   - encryption keyring with a versioned format
   - Zod on every action
   - a shared `requireHousehold()`
6. **Design system (see the companion doc):**
   - tokens and dark mode
   - accessible Dialog
   - contrast fixes
   - first-run flow

## Needs a human decision or secret
- **`ENCRYPTION_KEY`:** set it in production **before** any future rotation of `BETTER_AUTH_SECRET`. Today the journal key falls back to the auth secret.
- **Pro launch:** decide whether Pro is launched (live checkout) or waitlist-only. The copy and the gating must agree.
- **Seed against production:** confirm whether `pnpm db:seed` / `db:repair-admin` has ever been run there. If so, rotate the `admin@healthhub.com` password.
