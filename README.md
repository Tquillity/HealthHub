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
    Copy `.env.example` to `.env` and add your keys:
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

## Development Workflow

*   **Logic**: Write Server Actions in `src/actions/`.
*   **Database**: Modify `prisma/schema.prisma`, then run `pnpm db:push`.
*   **Components**: Use `shadcn` compatible components in `src/components/ui`.
