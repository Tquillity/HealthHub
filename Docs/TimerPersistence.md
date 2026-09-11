# PomoZen — Server persistence (S7-2)

**Status:** Phase 10 — premium users only.

## Model

| User | Storage |
|------|---------|
| Guest | `localStorage` (unchanged) |
| Signed-in, free | `localStorage` (unchanged) |
| **Premium signed-in** | **PostgreSQL** (`pomo_state.payload_json`) — authoritative |

There is **no offline-first sync** in v1. Premium users need network access to load and save timer state. Failures show retry UI; stale local data is not used as authority.

## Payload shape

Same Zod contract as export/import (`BackupFileSchema` in [`src/lib/pomo/validation/pomo-state-schema.ts`](../src/lib/pomo/validation/pomo-state-schema.ts):

- `timeStore` — history, mode, timeLeft, pomodorosCompleted (always saved with `isRunning: false`)
- `settingsStore` — durations, daily goal, presets, preferences
- `taskStore` — tasks, activeTaskId

## Server actions

| Action | Gate | Behavior |
|--------|------|----------|
| `getPomoState()` | Session + `User.isPremium` | Returns payload or empty defaults |
| `savePomoState(payload)` | Session + `User.isPremium` | Validates, normalizes paused, upserts row |

## Client lifecycle (premium)

1. Timer mount → `getPomoState` → apply to Zustand stores.
2. If DB empty but localStorage has data → one-time import offer, then clear local keys.
3. Debounced `savePomoState` on meaningful changes (pause, complete, settings, tasks).
4. `setCloudPersistenceActive(true)` routes Zustand persist to in-memory only (no localStorage fork).

## Dashboard

Premium users: [`FocusGoalCard`](../src/components/dashboard/focus-goal-card.tsx) receives server-computed progress from `getPomoState` in the dashboard page — no localStorage read.

Free/guest: existing [`dashboard-timer-snapshot.ts`](../src/lib/pomo/utils/dashboard-timer-snapshot.ts) path.

## Manual QA checklist

- [ ] Premium: complete pomodoro → refresh → count persists.
- [ ] Premium: second browser/profile shows same history after sign-in.
- [ ] Premium: dashboard progress matches timer without localStorage.
- [ ] Free/guest: no `pomo_state` API calls; local timer unchanged.
- [ ] Network offline (premium): save error visible; no silent local fallback.
- [ ] Worker tick, pause, tab sleep, presets, tasks — no regressions.

## Related

- [`Docs/SprintList.md`](./SprintList.md) — S7-2
- [`.cursor/rules/timer-pomo.mdc`](../.cursor/rules/timer-pomo.mdc) — worker/store invariants
