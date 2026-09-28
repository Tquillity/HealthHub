# HealthHub — Design & UX Review (2026-09-28)

Static review by two design agents (visual system; UX/accessibility/mobile), read from the code on `main` @ `4eb3cd9`.
Contrast ratios are WCAG 2.x values computed from the token hex values. Layout-at-375px findings are predictions from the code and should be confirmed in a browser.

**Headline:** the product ideas are strong (phase-aware UI, local-first timer, plan → groceries loop), but the design system underneath is too thin: two colour ramps, no semantic/surface/radius/shadow/type tokens, no dark mode, and primitives that most screens bypass. The result is three visual identities (sky-blue marketing site, Tailwind-blue app shell, terracotta timer), failing contrast on the main button, and a first-run experience that dead-ends.

---

## 1. Top improvements (ranked by user impact)

### 1.1 Fix first run: a new account has no household
Nothing outside `src/db/seed.ts` creates an `Organization`/`Member`. A fresh sign-up lands on the dashboard's bare "No household assigned." (`dashboard/page.tsx:21-23`); the meal planner throws (`meal-plan-queries.ts:28`) into the default Next error page (no `error.tsx` exists); groceries links to `/profile/household`, which just says "No household found" (a loop).
**Proposal:** auto-create a personal household on sign-up (Better-Auth `databaseHooks.user.create.after`), add a "Create household / Join with code" empty state, add `error.tsx` / `loading.tsx` / `not-found.tsx`. See §4 for the onboarding flow.

### 1.2 The brand colour fails contrast on nearly every primary action
| Where | Colours | Ratio |
|---|---|---|
| `ui/button.tsx:17` default button, `public-nav.tsx:68` Go Pro | white on primary-500 `#0ea5e9` | **2.77:1** |
| Links everywhere (`text-primary-600`) | `#0284c7` on white | 4.10:1 |
| `dashboard-client.tsx:75` "Try Routine Lottery" | white on wellness-500 | **2.28:1** |
| `page.tsx:180-191` CTA band | white / primary-50 on wellness-600 | 3.09–3.30:1 |
| `cycle-page-client.tsx:349` + `phase-theme.ts` | white on amber/fuchsia/rose gradients | 2.15–3.67:1 |
| Timer short-break theme `#52a89a` | white | 2.83:1 |

**Proposal:** a semantic `--color-brand` = primary-700 `#0369a1` (5.9:1 with white), `brand-hover` primary-800, links primary-700, green fills wellness-700. Keep 400/500 steps for decoration only.

### 1.3 One brand, not three
Public pages use `primary-*` (Tailwind *sky*); the signed-in shell uses Tailwind *blue* (`(protected)/layout.tsx:95-126`, `nav-link.tsx:20`, `protected-mobile-nav.tsx:127-155`; 69 `blue-*` uses across 23 files); `themeColor` is a third blue (`layout.tsx:38`). The "HH" logo square is re-implemented in four places. The timer has its own palette, type scale, radii and 16 inline SVGs instead of lucide, and **no link back to the app**.
**Proposal:** codemod `blue-*` → brand tokens, one `<Logo>` component (ideally an SVG mark), timer mode colours derived from brand-family tokens (`#b4473f` / `#2f7d72` / `#2c5578`, all ≥4.9:1), plus a Logo/Home link in the timer header.

### 1.4 A real token layer + dark mode
There are zero `dark:` classes and no `prefers-color-scheme` block. `error-boundary.tsx:37,41` uses `destructive` colours that are **never defined**, so the error UI renders unstyled. No `next/font` is loaded, so there's no typographic identity.
**Proposal:** add the token set in §3 under `@theme`, redefine only those variables for dark mode, and rewrite the ~8 primitives to use them. Every screen that uses the primitives then gets dark mode for free.

### 1.5 Use the primitives
`Card` is imported in 3 files against ~149 ad-hoc cards; 107 raw `<button>`s; 7 hand-rolled `fixed inset-0` overlays alongside `Dialog`; badges re-typed in 5 colour families; `PageHeader` on 8 pages versus 12 hand-styled `<h1>`s; 18 `<Link><Button>` nestings (invalid interactive nesting, double tab stop).
**Proposal:** add `Badge`, `StatTile`, `Select`, `Textarea` and a 44px `IconButton`; give `Button` `secondary`/`subtle` variants and an `asChild`/`href` prop; migrate the overlays onto one accessible `Dialog`.

### 1.6 Accessible dialogs
`ui/dialog.tsx:36-58` has no `role="dialog"`, `aria-modal`, focus trap, Escape or focus return, and no side padding on phones. The same gaps repeat in `meal-plan-generator`, `journal-client` (unlabelled close X), `journal-entry-detail`, `routines-client`, `meal-planner-settings` and `phase-drawer`. The timer's `Modal.tsx` and `protected-mobile-nav.tsx` already do this correctly, so promote that logic.

### 1.7 Navigation dead-ends and no sign-out
- There is no sign-out anywhere. `signOut` is exported but never used. *(Fixed on this branch: a sign-out button was added to the sidebar and mobile drawer.)*
- `/recipes` and `/learn` drop signed-in users into the public layout, which shows "Sign In / Sign Up".
- `/timer` has no way back to the rest of the app.
- The protected footer shows auth links.

**Proposal:**
- Add an account menu with Profile, Household, Billing and Sign out.
- Make the public nav session-aware.
- Add a back link in the timer.

### 1.8 Meal planner on mobile and keyboard
- Drag-and-drop is the only way to add a meal.
- The board has `min-w-[800px]` on the scroll container (`meal-board.tsx:223`), so the whole page scrolls sideways at 375px.
- Remove-meal is a 12px icon that stays hidden until hover, which makes it unreachable on touch.
- The toolbar has 7 buttons, and the destructive "Clear All" sits `gap-2` from the others, which violates the AGENTS.md `gap-6` rule.

**Proposal:**
- Add a per-slot "+ Add" searchable picker; it also serves keyboard and screen-reader users.
- Show a day-by-day agenda below `md`.
- Keep a 44px remove button visible at all times, with an undo toast.
- Group the toolbar as: primary "Generate grocery list", a "Plan ▾" menu, and a separated "Clear".

### 1.9 Journal flow
- The "New Entry" tab shows only another "Log Today" button, even when a past date is selected.
- Saved entries don't appear until a hard reload (`useState(initialEntries)`).
- Other months look empty because only the current month is fetched.
- Calendar days are `<div>`s with no keyboard access.

**Proposal:**
- Render the form inline with a date field.
- Derive entries from props and fetch by month.
- Make the calendar a keyboard grid of buttons.
- Use segmented 1–5 controls for mood and energy.
- Add an unsaved-changes guard.

### 1.10 Cycle: trust and data controls
- Setup is a detour through the generic profile form.
- There is no "Period started today" action.
- Fertility copy ("Peak fertility window") has no "not contraception" caveat, and the disclaimer is `text-xs` at the bottom of the page.
- There is no consent step for special-category health data (GDPR Art. 9) and no in-app export or delete.
- "Private encrypted entries" is claimed unconditionally, while the privacy policy says "where configured".

**Proposal:**
- A 3-step inline setup on `/cycle` with a consent sheet.
- A prominent "Period started" button.
- An inline estimates caveat.
- Export and delete in Profile.
- Align the copy with the privacy policy.

---

## 2. Issue list

Severity: H = High, M = Medium, L = Low.

### Visual system
| ID | Sev | Location | Issue → Fix |
|---|---|---|---|
| DESIGN-1 | H | `ui/button.tsx:17`, `public-nav.tsx:68` | White on primary-500 at 2.77:1 → brand token (primary-700) |
| DESIGN-2 | H | `dashboard-client.tsx:75` | White on wellness-500 at 2.28:1 → wellness-700 |
| DESIGN-3 | H | `page.tsx:180-191` | CTA band 3.09–3.30:1 → `from-primary-700 to-wellness-700` |
| DESIGN-4 | H | `cycle-page-client.tsx:349`, `phase-theme.ts:91,119,147` | White on phase gradients 2.15–3.67:1 → 600→700 gradient or dark text on amber |
| DESIGN-5 | H | `ui/error-boundary.tsx:37,41` | `destructive` colour undefined, so the error UI is unstyled → define `--color-danger` + alias |
| DESIGN-6 | H | `globals.css` | No dark mode, no semantic/surface/radius/shadow/font tokens → §3 |
| DESIGN-7 | H | protected shell, `layout.tsx:38` | Three different blues → one brand token + `<Logo>` |
| DESIGN-8 | H | `timer-shell.module.css:41,81`, `ScheduleMeter.tsx:71`, `TaskBoard.tsx:255` | Timer secondary text 1.7–2.2:1 at 9–11px → alpha ≥ /80, min 12px |
| DESIGN-9 | H | `useSettingsStore.ts:62` | Short-break `#52a89a` at 2.83:1 → `#2f7d72` |
| DESIGN-10 | H | `ui/dialog.tsx:50-57` | No dialog semantics; 7 duplicate overlays → one accessible Dialog |
| DESIGN-11 | M | `public-nav.tsx:39,54` | `min-h-[44px]` on inline `<a>` has no effect → `inline-flex items-center` |
| DESIGN-12 | M | `meal-board.tsx:97-100` | Hover-only 12px delete icon → visible 44px IconButton |
| DESIGN-13 | M | `meal-board.tsx:223` | `min-w-[800px]` causes horizontal page scroll → stacked day layout below `md` |
| DESIGN-14 | M | `meal-board.tsx:108-110` | Empty-slot labels at 1.41:1 → `fg-muted` |
| DESIGN-15 | M | 18 places | `<Link><Button>` nesting → `Button asChild`/`href` |
| DESIGN-16 | M | ~149 ad-hoc cards | Mixed radii and shadows → enforce `Card`/`StatTile` |
| DESIGN-17 | M | `recipes/[id]/page.tsx:186-222`, `recipe-card.tsx:43,48` | Hand-rolled badges → `Badge` primitive |
| DESIGN-18 | M | `dashboard-client.tsx:114,121` | gray-400 stat labels at 2.54:1 → gray-500+ |
| DESIGN-19 | M | `dashboard-client.tsx:69-87` | Four button colours with no hierarchy → one primary + secondary |
| DESIGN-20 | M | `cycle-chart.tsx`, `cycle-page-client.tsx:69-72`, `series-selector.tsx` | Chart hex values duplicated in 3 files → one `PHASE_COLORS`/`CHART_COLORS` export |
| DESIGN-21 | M | `cycle-chart.tsx:438` vs `:61` | Energy line is the same colour as the luteal band, so it disappears there → ink/teal |
| DESIGN-22 | M | `cycle-chart.tsx:533-547` | Infinite pulse and 1.5s animations ignore reduced motion |
| DESIGN-23 | M | `phase-theme.ts:95` | "rose-100" hex is actually pink-100 |
| DESIGN-24 | M | timer `Modal.tsx:125`, `PomodoroGuideModal.tsx` | `animate-in`/`fade-in` classes are dead (tw-animate-css not installed) |
| DESIGN-25 | M | `src/app/**` | No `loading.tsx`/`error.tsx`/`not-found.tsx` anywhere |
| DESIGN-26 | M | timer | No route back to the app; version chips disagree (v1 vs v2.0.0) |
| DESIGN-27 | M | timer | 16 inline SVGs, 0 lucide icons |
| DESIGN-28 | M | `journal-analytics.tsx` etc. | Emoji used as UI icons and trend arrows → lucide |
| DESIGN-29 | M | `journal-analytics.tsx:125` | `text-yellow-600` at ≈2.9:1 → amber-700 |
| DESIGN-30 | M | `ui/toast.tsx` | No `aria-live`; 16px close button; `min-w-[300px]` overflows 320px screens |
| DESIGN-31 | L | `ui/input.tsx:12` | Blue ring, 40px height, gray-300 border at 1.47:1 (below the 3:1 non-text minimum) |
| DESIGN-32 | L | `ui/button.tsx:15` | Focus ring has no colour token; no `secondary`/icon size |
| DESIGN-33 | L | `ui/card.tsx:56` | `CardTitle` at text-2xl → text-lg semibold |
| DESIGN-34 | L | `recipes/[id]/page.tsx:156` | Gallery `h3` renders before the `h1` |
| DESIGN-35 | L | `sign-in/page.tsx:50-53` | No logo or brand shell; `h2` instead of `h1` |
| DESIGN-36 | L | cycle | Name drift: "Cycle Tracker" / "Cycle Intelligence" / "Cycle" |
| DESIGN-37 | L | `pro/page.tsx:62-64` | Developer config text shown to users; page is 4 stacked alerts with no plan card |
| DESIGN-38 | L | `footer.tsx:96-135` | Placeholder social links; 20px targets |
| DESIGN-39 | L | `footer.tsx:7` | Different container gutters from the rest of the app |
| DESIGN-40 | L | `page.tsx:130,141,166` | `purple-*` is off-token → add an `accent` token |
| DESIGN-41 | L | various | Arbitrary hex/rgba in classes (rule violation) |
| DESIGN-42 | L | `globals.css:32,45` | Print CSS uses raw colours |
| DESIGN-43 | L | `nav-link.tsx:18` | Template-string classes; no `aria-current` on desktop |
| DESIGN-44 | L | `empty-state.tsx:55-56` | Icon at 1.41:1 |
| DESIGN-45 | L | type scale | 31 uses of 9–11px text; h1 sizes vary per page |

### UX, accessibility and mobile
| ID | Sev | Location | Issue → Fix |
|---|---|---|---|
| UX-1 | H | `auth.ts:36-38` + dashboard/planner/routines/household | No household on sign-up → auto-create + create/join state |
| UX-2 | H | `src/app/**` | No error/loading/not-found boundaries |
| UX-3 | H | `invite-member-form.tsx:20-24` | "Invitation sent" but no email and no accept flow → email + `/invite/[id]` + pending list |
| UX-4 | H | — | No sign-out *(fixed on this branch)* |
| UX-5 | H | button/globals/dashboard/nav | Contrast (see DESIGN-1..3) |
| UX-6 | H | `ui/dialog.tsx` + 6 modals | Dialog accessibility |
| UX-7 | H | `journal-page-client.tsx:21`, `journal/page.tsx` | Calendar stale after save; other months look empty |
| UX-8 | H | `journal-page-client.tsx:115-124` | "New Entry" tab only shows another button |
| UX-9 | H | `journal-calendar.tsx:111-126` | Calendar days not keyboard-operable |
| UX-10 | H | `meal-board.tsx:34-53` | DnD-only add; no keyboard/touch path |
| UX-11 | H | `meal-board.tsx:223,199` | Horizontal page scroll on mobile |
| UX-12 | H | `grocery-list-client.tsx:141` | Plan-derived checks lost on refresh |
| UX-13 | H | `grocery-list-client.tsx:296-301` | Checkbox has no accessible name; 20px target → wrap row in `<label>` |
| UX-14 | H | recipes/learn/timer layouts, footer | Signed-in users fall out of the app shell |
| UX-15 | H | `pro/page.tsx`, `timer-page-client.tsx:208-211` | "We won't charge" next to a live checkout; no price or terms |
| UX-16 | H | `phase-deep-dive.tsx:46`, `cycle/page.tsx:146` | Fertility language without a contraception caveat |
| UX-17 | H | `profile-client.tsx:192-268`, `privacy/page.tsx` | No consent or data controls for cycle data |
| UX-18 | H | `recipes/new/page.tsx:23-25` | Non-admins silently redirected while copy says "manage your recipes" |
| UX-19 | M | nav | 10 flat items behind a hamburger → bottom tab bar + grouped sections |
| UX-20 | M | `nav-link.tsx`, `(protected)/layout.tsx:45` | No `aria-current` / nav `aria-label` on desktop |
| UX-21 | M | root layout | No skip link |
| UX-22 | M | `public-nav.tsx:34-64` | ~36px targets; likely overflow at 375px |
| UX-23 | M | many | `<Link><Button>` nesting |
| UX-24 | M | `ui/toast.tsx` | Not announced; no pause on hover/focus |
| UX-25 | M | sign-in/up | Errors not announced; no forgot-password; no password rules; no Terms line |
| UX-26 | M | `proxy.ts:52-54` | Redirect drops the requested URL → `?callbackURL=` |
| UX-27 | M | sign-up → dashboard | New users see "Welcome back" with vanity counts |
| UX-28 | M | `dashboard-client.tsx` | Dashboard shows nothing from today (meals, phase, journal, groceries) |
| UX-29 | M | `use-recipe-form.ts` | Validation errors not tied to fields |
| UX-30 | M | `recipe-form-basic-section.tsx:99-113` | `display:none` file inputs, so upload isn't reachable by keyboard |
| UX-31 | M | `recipe-form-basic-section.tsx` | ~20px icon-only image buttons |
| UX-32 | M | `recipe-form.tsx` | Long form ordered oddly; "Lean Role" jargon; no leave guard |
| UX-33 | M | `safe-delete-modal.tsx` | Type-the-name confirmation for *every* delete (e.g. typing a date to delete a journal entry) |
| UX-34 | M | several | Native `alert()`s |
| UX-35..39 | M | meal board / planner | Hidden remove button, silent failures, 7-button toolbar, generator chips lack `aria-pressed`, no week stepper |
| UX-40..43 | M | groceries | Add-item hidden on empty list, unlabelled inputs, duplicate headings, un-batched "check all" |
| UX-44..48 | M | cycle | SVG click targets not keyboard-accessible, incomplete tab pattern, label-in-name, hover-only behaviour, hardcoded hex |
| UX-49 | M | `timer-page-client.tsx:194` | `h-screen` on iOS Safari → `h-dvh` |
| UX-50 | M | `cookie-consent.tsx:63-71` | Permanent floating cookie button covers content on mobile |
| UX-51 | M | recipe detail, groceries | Swedish strings in an English UI ("Skafferi", "Vetenskapen Bakom Rätten") |
| UX-52..53 | M | profile | Free-text timezone; duplicate headings; cycle settings buried |
| UX-54..55 | M | pro | Silent checkout errors; no billing/cancel UI |
| UX-56..67 | L | various | Naming drift (Routine Lottery / Spin the Wheel), icon buttons without labels, emoji tab names, calendar chip overflow, missing `aria-pressed`, heading skips, placeholder socials, "No tracking" claim next to an AdSense slot, no global reduced-motion, over-broad print CSS, undefined `destructive` tokens, UTC-midnight period date |

---

## 3. Proposed design tokens (`@theme` in `globals.css`)

### Colours
| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-bg` | #f8fafc | #0b1220 | page |
| `--color-surface` | #ffffff | #111a2b | cards, dialogs |
| `--color-surface-muted` | #f1f5f9 | #172236 | wells, empty states |
| `--color-fg` | #0f172a | #e6edf6 | body/headings (≈17:1) |
| `--color-fg-muted` | #475569 | #9fb0c6 | secondary text (7.6:1) |
| `--color-fg-subtle` | #64748b | #7d8da3 | captions (4.8:1) |
| `--color-border` | #e2e8f0 | #243049 | dividers |
| `--color-border-strong` | #94a3b8 | #3a4a66 | inputs (≥3:1) |
| `--color-brand` | #0369a1 | #38bdf8 | CTA, links (5.9:1) |
| `--color-brand-hover` | #075985 | #7dd3fc | |
| `--color-brand-subtle` | #e0f2fe | #0c2a40 | active nav, chips |
| `--color-on-brand` | #ffffff | #04121d | text on brand |
| `--color-ring` | #0284c7 | #7dd3fc | focus |
| `--color-success` | #15803d | #4ade80 | |
| `--color-warning` | #b45309 | #fbbf24 | |
| `--color-danger` (+ `destructive` alias) | #b91c1c | #f87171 | |
| `--color-phase-{menstrual,follicular,ovulation,luteal}` | #e11d48 / #c026d3 / #d97706 / #4f46e5 | 400 steps | use 700 steps under white text |
| `--color-chart-1…6` | #1f2937, #0891b2, #7c3aed, #16a34a, #64748b, #ea580c | lighter | series distinct from phase bands |
| Timer modes | #b4473f / #2f7d72 / #2c5578 | same | all ≥4.9:1 with white |

### Type
Use Inter (`next/font`) as the UI font, and Fraunces or DM Serif Display for display headings only.

| Step | Size / line-height | Weight |
|---|---|---|
| display | clamp(2.25rem, …, 3.75rem) / 1.1 | 700 |
| h1 | 1.875rem / 1.2, tracking-tight | 700 |
| h2 | 1.25rem / 1.35 | 600 |
| h3 | 1.0625rem / 1.4 | 600 |
| body | 1rem / 1.6 | 400 |
| small | 0.875rem / 1.5 | 400/500 |
| caption | 0.75rem / 1.4 | 500 |

Minimum text size is 12px; retire the 9–11px sizes.

### Radii, elevation and motion
- **Radius:** sm 6px (badges), md 10px (buttons, inputs), lg 14px (cards, dialogs), xl 20px (hero cards, timer panels), full.
- **Shadow:**
  - xs `0 1px 2px rgb(15 23 42/.06)`
  - sm `0 2px 6px -1px rgb(15 23 42/.08)`
  - md `0 8px 24px -6px rgb(15 23 42/.12)`
  - lg `0 24px 60px -12px rgb(15 23 42/.25)`
  - In dark mode, use borders and surface lift instead of shadows.
- **Motion:** ease-out `cubic-bezier(.2,.8,.2,1)`; 120 / 200 / 320ms; a global `prefers-reduced-motion` rule.
- **Spacing rhythm:** page `gap-8`, section `gap-6`, card `p-6` (compact `p-4`).

---

## 4. Suggested first-run flow
1. **Sign-up.** Show password rules and a Terms/Privacy line. Offer Google or X. Accept `?invite=<id>`.
2. **Household.** Create "<Name>'s household" silently. Offer an optional "Invite someone now".
3. **"What do you want HealthHub for?"** Multi-select: meals & groceries, journal, cycle, focus. The choice decides which dashboard cards and nav items come first.
4. **Mini-setup per choice.** Each is one skippable screen:
   - Meals: diet chips, household size, "Generate my first week".
   - Cycle: consent sheet, then last period date and typical length.
   - Journal: pick check-in fields and set a reminder.
5. **"Getting started" checklist** on the dashboard: plan 3 meals → grocery list → first journal entry → log period → invite a member → first focus session.
6. **"Today" dashboard:** today's meals, grocery progress, one-tap mood check-in, cycle day and one tip, focus goal.

---

## 5. What already works well
- `protected-mobile-nav.tsx` is a model drawer: focus trap, Escape, focus return, `aria-current`, scroll lock and 44px targets. Reuse it for `Dialog`.
- Timer accessibility: `role="timer"`, a proper modal trap, `aria-pressed` mode switcher and reduced-motion handling. Its internal CSS-variable system is a good template for the global token layer.
- Phase-theme immersion is a genuine product differentiator; it only needs to feed the charts too.
- `EmptyState`, `PageHeader`, `AppErrorBoundary` and `SafeDeleteModal` exist. Screens that use them look consistent.
- Touch-target discipline (`min-h-[44px]`) is mostly followed. Forms mostly follow the `htmlFor`/`id` rule.
- The cycle disclaimer content itself is balanced and evidence-based. The chart legend uses dashes as a second encoding channel.
- The landing page has a clear value proposition and a timer you can try before signing up.
