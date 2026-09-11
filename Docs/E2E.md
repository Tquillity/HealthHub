# End-to-end checks

Use Node 22.13 or newer and the pnpm version pinned in `package.json`.
Playwright starts the production server automatically. Locally it can reuse an
already running server at `PLAYWRIGHT_BASE_URL`, which defaults to
`http://localhost:3000`.

## Run the complete suite locally

Create a disposable PostgreSQL database named `healthhub_e2e` on localhost.
Set `DATABASE_URL` explicitly to that database before running these commands.
The fixture script refuses remote hosts or a different database name.

```bash
export DATABASE_URL='postgresql://ci:ci@localhost:5432/healthhub_e2e?sslmode=disable'
export BETTER_AUTH_SECRET='ci-build-secret-minimum-32-characters-long-for-ci'
export BETTER_AUTH_URL='http://localhost:3000'
export NEXT_PUBLIC_BETTER_AUTH_URL='http://localhost:3000'
export PLAYWRIGHT_BASE_URL='http://localhost:3000'
export ADMIN_EMAIL='admin@healthhub.com'
export PLAYWRIGHT_TEST_EMAIL='admin@healthhub.com'
export PLAYWRIGHT_TEST_PASSWORD='Admin123!'
export PLAYWRIGHT_SEEDED_DB=1
pnpm install --frozen-lockfile
pnpm db:push
pnpm db:repair-admin -- --use-default
pnpm exec tsx scripts/seed-e2e.ts
pnpm exec vitest run src/lib/stripe-webhook.test.ts
pnpm exec playwright install --with-deps chromium
pnpm build
pnpm test:e2e
```

The credentials above are disposable fixtures. Do not run the repair or seed
commands against a real household database.

## Coverage and CI

The `quality` job runs TypeScript, lint, unit tests, and a production build
without a live database. The `e2e` job starts PostgreSQL 16, initializes the
checked-in Prisma schema, creates fixtures, and runs the Stripe transaction and
browser tests. Both jobs fail the workflow when a check fails.

Browser checks cover public page content, signed-in dashboard and groceries,
meal planning, public versus household/secret/private recipe access, recipe
structured data and noindex metadata, immediate privacy changes after warming
the guest cache, and TLDR navigation with valid, absent,
and invalid summaries. Authenticated specs run only in the authenticated
Playwright project, after its sign-in setup. Another regression test performs
110 session reads, verifies the dashboard remains accessible, and checks that
invalid sign-ins are still rate limited.

CI requires both credentials and `PLAYWRIGHT_SEEDED_DB=1`; missing configuration
fails immediately. Local runs can omit them to run only the public smoke tests.
CI treats tests that pass only on retry as failures. Failed runs upload
`test-results/`, including traces from the first failed attempt.

Repository branch protection must require the `quality` and `e2e` checks for
merges. The workflow covers both `Feature/**` and `feature/**` pushes and all
pull requests.
