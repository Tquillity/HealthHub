# food-heaven → HealthHub

**Status:** Superseded. Do not port code from [Tquillity/food-heaven](https://github.com/Tquillity/food-heaven).

food-heaven was an Express + MongoDB prototype for cycle-synced nutrition and training hints. HealthHub reimplemented the same product ideas on **Next.js + Prisma + Neon/Postgres**.

## Feature parity

| food-heaven | HealthHub (current stack) | Action |
|-------------|---------------------------|--------|
| `Expert` + `Recommendation` (Mongo) | `Expert` + `PhaseRecommendation` (Prisma), `src/actions/cycle-actions.ts` | **Done** — no port |
| Expert seed (`server/scripts/seedData.js`) | `seedExperts()` in `src/db/seed.ts` (Mindy Pelz + Stacy Sims, enhanced sources) | **Done** — run `npm run db:seed` |
| `CycleChart.jsx` (hover phases) | `src/components/cycle/cycle-chart.tsx` (~29 KB) + full cycle UI | **Done** — HH chart is richer |
| Phase recommendations API | `getCycleDashboard()`, `getPhaseRecommendations()`, etc. | **Done** |
| `useCycle` dietary hints | `src/lib/cycle-calculator.ts`, `src/lib/dietary-recommendations.ts` | **Done** (ported, commented in source) |
| Express / Mongo stack | Next server actions + Prisma | **N/A** — intentional stack change |
| Menu / shopping stubs | `ShoppingListItem` in schema; meal plans elsewhere | **Not in food-heaven** — future HH product work only |

## Where to look in HealthHub

- **Schema:** `prisma/schema.prisma` — `User.focusPreference`, `Expert`, `PhaseRecommendation`
- **Data:** `src/db/seed.ts` → `seedExperts()`
- **Server:** `src/actions/cycle-actions.ts`
- **UI:** `src/components/cycle/*`, route under `(protected)/cycle`
- **Utils:** `src/lib/cycle-calculator.ts`, `src/lib/dietary-recommendations.ts`

## Repo hygiene

- Safe to **archive** the food-heaven GitHub repo after confirming production DB has been seeded (`db:seed`).
- Cycle work may still live on feature branches (`Feature/HormoneTracker`, `Feature/AutomaticGeneration`); merge into `main` as needed — that is branch integration, not a food-heaven import.

## Future ideas (not from food-heaven)

- Deeper **menu ↔ shopping list** flows (never implemented in food-heaven).
- Optional: link expert cards to **EducationalResource** / Learn content (HH-specific enhancement).
