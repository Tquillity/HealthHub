# End-to-end tests (Playwright)

## Public smoke (CI-safe)

Runs without credentials:

```bash
pnpm test:e2e:install
pnpm build && pnpm start   # separate terminal
pnpm test:e2e
```

Specs: `e2e/smoke.spec.ts` (landing, recipes, timer, learn, privacy, terms).

## Authenticated smoke (optional)

Requires a seeded test user and database:

```env
PLAYWRIGHT_TEST_EMAIL="test@example.com"
PLAYWRIGHT_TEST_PASSWORD="..."
DATABASE_URL="postgresql://..."
PLAYWRIGHT_BASE_URL="http://localhost:3000"
```

1. `e2e/auth.setup.ts` signs in and saves `e2e/.auth/user.json`.
2. `e2e/authenticated.spec.ts` runs with that storage state.

If env vars are missing, setup and specs **skip** with a clear message.

## CI policy

The `e2e` job in `.github/workflows/ci.yml` uses **`continue-on-error: true`** until a stable Neon test database and secrets exist. Do not block phase exit on auth E2E.

When CI DB is stable: remove `continue-on-error` and require green `e2e`.
