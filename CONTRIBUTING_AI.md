# AI Contribution Guidelines (HealthHub 2026)

> **CRITICAL ARCHITECTURE WARNING:**
> This repository operates on the **Next.js 16 + PostgreSQL (Prisma)** stack.
> 🛑 **DO NOT** generate code using Express, MongoDB, Mongoose, Vite (SPA), or Passport.js.
> 🛑 **DO NOT** use `useEffect` for initial data fetching; use **Server Components**.

## 1. Technology Stack (The Truth Source)

| Layer             | Technology                  | Usage Rules                                                                                                                            |
| :---------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**     | **Next.js 16 (App Router)** | Use **Server Components (RSC)** by default. Use Client Components (`'use client'`) _only_ for interactivity (hooks, event listeners).  |
| **Database**      | **PostgreSQL (Neon)**       | Hosted on Neon Serverless. **NO** MongoDB.                                                                                             |
| **ORM**           | **Prisma 7**                | Use `prisma/schema.prisma` for modeling. Use `npx prisma db push` for dev sync. Use `@prisma/adapter-pg` with standard `pg` Pool for database connections. |
| **Backend Logic** | **Server Actions**          | Place in `src/actions/`. MUST start with `'use server'`. MUST use **Zod** for input validation.                                        |
| **Auth**          | **Better-Auth**             | Use `auth.api.getSession()` for server-side checks. Use `useSession()` for client-side.                                                |
| **Styling**       | **Tailwind CSS v4**         | No `tailwind.config.js`. Use CSS variables in `src/app/globals.css` for theming.                                                       |
| **State**         | **Nuqs** / **Zustand**      | Use `nuqs` for URL search params (filters/pagination). Use `zustand` for global UI state (modals/drawers).                             |

## 2. Directory Structure Standards

The project follows a feature-grouped Monorepo-style structure within Next.js:

```text
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Route Group: Login, Register
│   ├── (dashboard)/      # Route Group: Protected App (Layout with Sidebar)
│   │   ├── recipes/      # Recipe Feature
│   │   ├── journal/      # Journal Feature
│   │   └── page.tsx      # Dashboard Home
│   ├── api/              # Route Handlers (ONLY for Webhooks/External Integration)
│   ├── layout.tsx        # Root Layout
│   └── globals.css       # Tailwind v4 imports
├── actions/              # Server Actions (Mutations & Data Fetching)
│   ├── recipe-actions.ts
│   └── auth-actions.ts
├── components/           # React Components
│   ├── ui/               # shadcn/ui primitives (Button, Card, Input)
│   ├── recipes/          # Recipe-specific components
│   └── layout/           # Navbar, Sidebar, Footer
├── lib/                  # Singletons & Utilities
│   ├── db.ts             # Prisma Client singleton
│   ├── auth.ts           # Better-Auth configuration
│   ├── auth-client.ts    # Better-Auth client hooks
│   └── utils.ts          # cn() helper
├── db/                   # Database related
│   └── schema.prisma     # The Single Source of Truth for Data
```

## 3. Coding Rules for AI Agents

### Rule #1: Server Actions over API Routes

- **Do not** create `src/app/api/route.ts` for internal CRUD operations.
- **Do** create `src/actions/[feature].ts` files containing exported async functions with `'use server'`.
- **Do** wrap Server Actions in `try/catch` blocks and return typed objects `{ success: boolean, error?: string, data?: T }`.

### Rule #2: Type Safety is Law

- **Do not** use `any`.
- **Do** infer types from Prisma: `type Recipe = Prisma.RecipeGetPayload<{ include: { ingredients: true } }>`.
- **Do** validate all Action inputs using **Zod** before touching the database.

### Rule #3: Relational Data Integrity

- We use PostgreSQL.
- **Do not** simulate joins in JavaScript loops (e.g., fetching a list of IDs and then looping to fetch details).
- **Do** use Prisma's `include` or `select` to fetch related data in a single efficient query.
  - _Example:_ `prisma.mealPlan.findFirst({ include: { recipes: true } })`

### Rule #4: Styling (Tailwind v4)

- Use Tailwind utility classes directly in JSX.
- **Do not** create `.module.css` files unless animating something complex.
- Use `clsx` and `tailwind-merge` (via the `cn()` helper) for conditional classes.
- Use CSS variables for colors (e.g., `bg-[var(--color-primary)]`) if not using standard Tailwind palette.

## 4. Pre-Generation Checklist

Before generating code, verify:

1.  **Imports:** Am I importing `mongoose`? -> **STOP.** Import `prisma` from `@/lib/db`.
2.  **Data Fetching:** Am I using `useEffect` to fetch data on mount? -> **STOP.** Fetch data directly in the `async function Page()` (Server Component).
3.  **Secrets:** Am I putting `process.env` secrets in a file with `'use client'`? -> **STOP.** Move logic to a Server Action.
4.  **Auth:** Am I checking `await auth.api.getSession()` in every protected Server Action?

## 5. Migration Reminders (If Refactoring)

- **Grocery Logic:** Convert `mealPlanService.ts` JS aggregation loops into SQL/Prisma `groupBy` queries.
- **Models:** Convert Mongoose Schemas to `schema.prisma` models. Use `@@index` for foreign keys.
- **Auth:** Replace `passport` strategies with Better-Auth plugins.

```

```
