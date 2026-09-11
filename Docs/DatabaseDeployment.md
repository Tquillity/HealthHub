# Database deployment for the combined feature branches

The schema includes three additions needed before deploying this checkout:

- `educational_resource.tldr`, nullable JSONB. Existing articles without a value
  render the full article and a TLDR fallback.
- `pomo_state`, with one row per user and a cascading user foreign key.
- `stripe_webhook_event`, with a unique `event_id` for atomic webhook claims.

A read-only schema check on 2026-09-11 found these additions absent from the
connected database. No production schema or data was changed during validation.
All schema initialization and fixture writes used disposable local PostgreSQL 16.

This repository uses `prisma db push`; the SQL files in `prisma/migrations/` are
ad hoc scripts, not a complete Prisma Migrate history. Do not use
`prisma migrate deploy` as if it provisions the application schema.

Before deployment, inspect the target with the PostgreSQL MCP, review the schema
diff against `prisma/schema.prisma`, and apply the additive changes through the
existing database deployment process. Do not use `--accept-data-loss` or reset
an existing database. Then run `pnpm db:generate` and fully restart the server.

Production builds render database-backed routes on request and require only a
syntactically valid `DATABASE_URL`. Production requests still require the live,
updated database. A successful build does not establish deployment readiness
for a database with missing tables or columns.

Stripe Checkout now places the HealthHub user ID in subscription metadata.
Cancellation events from older checkouts recover the user ID from the original
Checkout Session. Failed user resolution or database writes return HTTP 500,
so Stripe retries instead of recording the event as processed. Verify the
configured endpoint receives `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, and `customer.subscription.deleted`
in the intended Stripe environment.
