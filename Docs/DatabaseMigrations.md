# Database migrations

Schema changes ship as Prisma Migrate files in `prisma/migrations/`. Each file is
reviewed in its pull request, tested in CI, and applied to production with
`prisma migrate deploy`, which runs each migration exactly once and records it in
the `_prisma_migrations` table.

This replaces `prisma db push` for shared databases. `db push` compares the schema
with the database and applies whatever it takes to make them match, with no record
and no review. It is also the reason for the deploy-order problems so far: nothing
told the deployment which columns the new code expected.

`prisma/migrations/0_init` is the **baseline**: the full schema as of the switch.
The two hand-written SQL files that used to sit in `prisma/migrations/` are kept for
history in `prisma/legacy-sql/`. Both are already part of the baseline.

## Changing the schema (developers)

1. Edit `prisma/schema.prisma`.
2. Create the migration against your local database:
   ```bash
   pnpm db:migrate --name short_description
   ```
   This writes `prisma/migrations/<timestamp>_short_description/migration.sql`,
   applies it locally, and regenerates the Prisma client.
3. Read the SQL. Prefer additive changes (new nullable columns, new tables, new
   indexes). Renames and drops need two releases: first stop using the column,
   then drop it.
4. Commit the migration folder with the schema change.

CI builds its test database with `pnpm db:migrate:deploy` and then runs
`pnpm db:migrate:check`, which fails when `schema.prisma` has changes that no
migration covers.

`pnpm db:push` still works for throwaway local databases. Never use it on a shared
or production database.

## One-time switch for an existing database (production)

An existing database already has the tables, so `prisma migrate deploy` refuses to
run (`P3005: The database schema is not empty`). Mark the baseline as already
applied instead. Do this once per existing database (production, staging).

Run these from a checkout of the commit that adds the baseline, with `DATABASE_URL`
pointing at the target database.

1. **Check that the database matches the baseline.** This only reads:
   ```bash
   pnpm db:migrate:check
   ```
   Exit code 0 means they match: go to step 3.
   Exit code 2 means the database differs (for example, columns added on a branch
   were never pushed).
2. **Only if step 1 reported differences**, see the SQL that would close the gap:
   ```bash
   pnpm exec prisma migrate diff --from-config-datasource \
     --to-schema prisma/schema.prisma --script > baseline-gap.sql
   ```
   Review it. Apply it only if it is purely additive (`CREATE TABLE`,
   `ADD COLUMN`, `CREATE INDEX`); never apply `DROP` statements without checking
   the data first. Take a backup, then:
   ```bash
   pnpm exec prisma db execute --file baseline-gap.sql
   ```
   Repeat step 1 until it exits with 0.
3. **Mark the baseline as applied** (writes one row to `_prisma_migrations`):
   ```bash
   pnpm exec prisma migrate resolve --applied 0_init
   ```
4. **Confirm:**
   ```bash
   pnpm db:migrate:status   # "Database schema is up to date!"
   ```

## Deploying

After the one-time switch, run this before each release starts serving traffic:

```bash
pnpm db:migrate:deploy
```

It applies only migrations the database has not seen yet, in order, and does
nothing when there are none. Keep migrations additive so the old release keeps
working while the new one rolls out. Then running migrations before the new code
is always safe.

Add it to the deployment's build or release step only after the one-time switch
has been done on that database. Before then it fails with `P3005`.
