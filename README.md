# HealthHub (HH)

A comprehensive household wellness application built with the **Next.js 16 + Postgres** stack.

## Tech Stack (2026 Standard)

*   **Framework**: Next.js 16 (App Router)
*   **Database**: PostgreSQL (Neon)
*   **ORM**: Prisma 7
*   **Auth**: Better-Auth
*   **Styling**: Tailwind CSS v4

## Getting Started

1.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in your keys (see comments in that file and
    [Environment variables](#environment-variables) below). The minimum for local development:
    ```bash
    DATABASE_URL="postgres://..."
    BETTER_AUTH_SECRET="..."   # openssl rand -base64 32
    BETTER_AUTH_URL="http://localhost:3000"
    NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
    ```

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Database** (applies every migration in `prisma/migrations/`):
    ```bash
    pnpm db:migrate:deploy
    ```

4.  **Seed Data**:
    ```bash
    pnpm db:seed
    ```
    Seeding (and `pnpm db:repair-admin`) only runs against a local database (`localhost`/`127.0.0.1`) by default.
    For a remote database such as Neon, set `ALLOW_PROD_SEED=1` and a strong `ADMIN_PASSWORD` (the default password is refused). See `.env.example`.
    System recipes come from `src/db/kitchen-manifest.json`, which is validated before anything is written (including the LEAN Kitchen `leanInfo` and `yield` blocks). Re-running the seed updates system recipes in place by name, so meal plans that use them keep working.

5.  **Run Dev Server**:
    ```bash
    pnpm dev
    ```
    Dev uses `--webpack` because the PWA plugin requires webpack (see `next.config.ts`).

## Environment variables

`.env.example` documents every variable the code reads, with how to generate each secret.
Variables starting with `NEXT_PUBLIC_` are inlined into the browser bundle at build time, so set
them before `pnpm build`.

| Variable | Needed | Used for |
|----------|--------|----------|
| `DATABASE_URL` | Always | PostgreSQL connection (app, Prisma CLI, scripts) |
| `BETTER_AUTH_SECRET` | Always | Session signing; journal encryption fallback while `ENCRYPTION_KEY` is empty |
| `BETTER_AUTH_URL` | Always | Auth base URL, proxy session lookup, Stripe return URLs. `https://` in production |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Always | Canonical, Open Graph and sitemap URLs. Same origin as `BETTER_AUTH_URL` |
| `ENCRYPTION_KEY` | Production | Journal field encryption (see the warning below) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional | Google sign-in (both required to enable it) |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | Optional | X sign-in (both required to enable it) |
| `BLOB_READ_WRITE_TOKEN` | For uploads | Recipe and routine images on Vercel Blob; uploads fail in production without it |
| `USE_LOCAL_STORAGE` | Dev only | `"true"` stores uploads in `public/uploads` when there is no Blob token |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO` | Optional | HealthHub Pro billing (`Docs/Stripe.md`) |
| `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_ENABLED`, `NEXT_PUBLIC_ADSENSE_SLOT_RECIPES`, `NEXT_PUBLIC_ADSENSE_SLOT_LEARN` | Optional | Ads, blocked until legal review (`Docs/AdSense.md`) |
| `LEGAL_REVIEW_APPROVED` | Optional | `"true"` hides the draft notice on Privacy and Terms |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ALLOW_PROD_SEED` | Scripts | `pnpm db:seed` and `pnpm db:repair-admin` |
| `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_SEEDED_DB` | E2E | Playwright (`Docs/E2E.md`) |

`NODE_ENV`, `NEXT_RUNTIME` and `CI` are set by Next.js and CI providers.

> **`ENCRYPTION_KEY` on an existing deployment:** set it to the **current** `BETTER_AUTH_SECRET`
> value, copied exactly. That keeps every saved journal entry readable and lets you rotate
> `BETTER_AUTH_SECRET` on its own afterwards. Do **not** set a newly generated key: entries
> encrypted with the old key would become unreadable (they show as scrambled text, and saving one
> overwrites the original). Only a fresh deployment with no journal entries may use a new random key
> (`openssl rand -base64 32`). Never change it once entries exist.

A production server logs a `[HealthHub config]` warning once at startup (`src/instrumentation.ts`)
when `ENCRYPTION_KEY` is empty or an auth URL uses `http://` for a non-localhost host. The warnings
never include the values.

## Agent & sprint docs

- **`AGENTS.md`** — agent instructions (stack, rules, workflow)
- **`Docs/SprintList.md`** — master roadmap (priorities, acceptance criteria)
- **`.cursor/rules/*.mdc`** — scoped rules (actions, Prisma/auth, timer)

## Database Verification

**Automated Verification:** The Postgres MCP is configured for automated schema verification. All database schema changes should be verified using the `@postgres` MCP tools before deployment.

**Schema changes** ship as migration files. See `Docs/DatabaseMigrations.md`,
including the one-time switch for an existing production database.

## Development Workflow

*   **Logic**: Write Server Actions in `src/actions/`.
*   **Database**: Modify `prisma/schema.prisma`, then run `pnpm db:migrate --name <change>` and commit the new migration folder.
*   **Components**: Use `shadcn` compatible components in `src/components/ui`.

## Maintenance scripts (`scripts/`)

Run manually after seeding when fixing recipe data (not part of the runtime app):

| Script | Purpose |
|--------|---------|
| `scripts/parse-recipe-alternatives.ts` | Parse ingredient alternative patterns |
| `scripts/fix-*.ts` | One-off recipe corrections |
| `scripts/set-all-recipes-unverified.ts` | Bulk verification flags |

Example: `pnpm exec tsx scripts/parse-recipe-alternatives.ts`

## Quality gates

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build
```

Optional E2E smoke (requires dev server + Playwright): see `Docs/Observability.md`.
