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
    Copy `.env.example` to `.env` and fill in your keys (see comments in that file):
    ```bash
    DATABASE_URL="postgres://..."
    BETTER_AUTH_SECRET="..."
    BETTER_AUTH_URL="http://localhost:3000"
    ```

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Database Sync**:
    ```bash
    pnpm db:push
    ```

4.  **Seed Data**:
    ```bash
    pnpm db:seed
    ```

5.  **Run Dev Server**:
    ```bash
    pnpm dev
    ```
    Dev uses `--webpack` because the PWA plugin requires webpack (see `next.config.ts`).

## Agent & sprint docs

- **`AGENTS.md`** — agent instructions (stack, rules, workflow)
- **`Docs/SprintList.md`** — master roadmap (priorities, acceptance criteria)
- **`.cursor/rules/*.mdc`** — scoped rules (actions, Prisma/auth, timer)

## Database Verification

**Automated Verification:** The Postgres MCP is configured for automated schema verification. All database schema changes should be verified using the `@postgres` MCP tools before deployment.

**Manual Sync (if needed):**
```bash
npx prisma db push
npx prisma generate
```

## Development Workflow

*   **Logic**: Write Server Actions in `src/actions/`.
*   **Database**: Modify `prisma/schema.prisma`, then run `pnpm db:push`.
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
