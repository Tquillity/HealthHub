# AI Contribution Guidelines (HealthHub 2026)

**CRITICAL ARCHITECTURE WARNING:**  
This repository operates on the **Next.js 16 + PostgreSQL (Prisma)** stack.  

🛑 **DO NOT** generate code using Express, MongoDB, Mongoose, Vite (SPA), or Passport.js.  
🛑 **DO NOT** use `useEffect` for initial data fetching; use Server Components.

## 1. Technology Stack (The Truth Source)

| Layer          | Technology                  | Usage Rules                                                                 |
|----------------|-----------------------------|-----------------------------------------------------------------------------|
| Framework      | Next.js 16 (App Router)     | Use Server Components (RSC) by default. Use Client Components (`'use client'`) only for interactivity (hooks, event listeners). |
| Database       | PostgreSQL (Neon)           | Hosted on Neon Serverless. NO MongoDB.                                       |
| ORM            | Prisma 7                    | Use `prisma/schema.prisma` for modeling. Use `npx prisma db push` for dev sync. Use `@prisma/adapter-pg` with standard pg Pool. |
| Backend Logic  | Server Actions              | Place in `src/actions/`. MUST start with `'use server'`. MUST use Zod for input validation. |
| Auth           | Better-Auth                 | Use `auth.api.getSession()` for server-side checks. Use `useSession()` for client-side. |
| Styling        | Tailwind CSS v4             | No `tailwind.config.js`. Use CSS variables in `src/app/globals.css` for theming (e.g., `bg-primary-500`). |
| State          | Nuqs / Zustand              | Use nuqs for URL search params (filters/pagination). Use zustand for global UI state (modals/drawers). |

## 2. Directory Structure Standards

    src/
    ├── app/                  # Next.js App Router
    │   ├── (auth)/           # Route Group: Login, Register
    │   ├── (dashboard)/      # Route Group: Protected App (Layout with Sidebar)
    │   ├── layout.tsx        # Root Layout (ONLY place for globals.css import)
    │   └── globals.css       # Tailwind v4 theme variables
    ├── actions/              # Server Actions (Mutations & Data Fetching)
    ├── components/           # React Components
    │   ├── ui/               # shadcn/ui primitives (Button, Card, Input)
    │   └── [feature]/        # Feature-specific components (recipes, journal, etc.)
    ├── lib/                  # Singletons & Utilities
    │   ├── db.ts             # Prisma Client singleton
    │   ├── auth.ts           # Better-Auth configuration
    │   └── utils.ts          # cn() helper
    └── db/                   # Database related (schema.prisma, seed scripts)

## 3. Coding Rules for AI Agents

**Rule #1: Server Actions over API Routes**

- Do not create `src/app/api/route.ts` for internal CRUD operations.
- Do create `src/actions/[feature].ts` files containing exported async functions with `'use server'`.
- Do wrap Server Actions in try/catch blocks and return typed objects `{ success: boolean, error?: string, data?: T }`.

**Rule #2: Type Safety is Law**

- Do not use `any`.
- Do infer types from Prisma: `type Recipe = Prisma.RecipeGetPayload<{ include: { ingredients: true } }>`.
- Do validate all Action inputs using Zod before touching the database.

**Rule #3: Relational Data Integrity**

- We use PostgreSQL. Do not simulate joins in JavaScript loops.
- Do use Prisma's `include` or `select` to fetch related data in a single efficient query.

**Rule #4: Styling (Tailwind v4)**

- Do not use hardcoded HEX/RGB values in style tags.
- Always use Tailwind theme variables (e.g., `text-primary-500`, `bg-wellness-600`).
- Always use the `cn()` utility for conditional classes.

**Rule #5: Spacing & Layout Reliability**

- Never use `space-y-*` for containers holding interactive elements like Link or Label.
- Always use `flex flex-col gap-X`.
- **Reasoning:** Next.js Link components are inline by default; `space-y` margins are frequently ignored by browsers on non-block elements.

**Rule #6: Strict Accessibility (A11y)**

- Every form field must have a corresponding `<label>`.
- Always associate them using `htmlFor` on the label and a matching `id` on the input/select.
- Dynamic Lists: When mapping over items (e.g., ingredients, gratitude entries), you must generate unique IDs using the map index: `id={`ingredient-name-${index}`}`.

**Rule #7: PWA Touch Targets**

- Navigation items and interactive buttons must have a minimum height of 44px (Tailwind `min-h-[44px]`).
- High-risk actions (Delete, Reset, Logout) must have an increased separation (minimum `gap-6`) to prevent accidental triggers.

## 4. Response Protocol & File Separation

- **Dialogue vs. Artifacts:** Provide all Work Plans, Execution Prompts, Todo Lists, and Commit Summaries as **Markdown text in the chat dialogue only**.
- **Source Code Only:** Never generate or write `.md` files (e.g., `TODO.md`, `PLAN.md`) into the repository filesystem.
- **File Constraints:** The AI should only create or modify source code, configuration, or database files (`.ts`, `.tsx`, `.prisma`, `.css`, `.json`).
- **Internal Verification:** The checklist below is for internal reasoning. Do not output the checklist results as a file.

## 5. MCP Tools for Verification & Research

### 5.1 Database Verification via Postgres MCP

**CRITICAL:** Always use the `@postgres` MCP to verify schema changes or debug data persistence before suggesting code changes.

- Use `mcp_postgres_query` to verify table structures match `prisma/schema.prisma`
- Verify column types, especially array types (TEXT[] should appear as `_text` in PostgreSQL)
- Check for missing columns before suggesting Prisma operations
- Query actual data to debug persistence issues rather than assuming schema state

**Example Postgres MCP Verification:**
```sql
-- Verify JournalEntry array columns
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'journal_entry' 
AND column_name IN ('gratitudeEntries', 'goalsAchieved', 'symptomsPhysical');
```

**CRITICAL: PostgreSQL Case Sensitivity Issue**

🛑 **ALWAYS add `@@map("table_name")` to Prisma models when the database table name is lowercase.**

PostgreSQL stores unquoted table names in lowercase (e.g., `session`, `user`, `account`), but Prisma model names are PascalCase (e.g., `Session`, `User`, `Account`). Without explicit mapping, Prisma will look for `Session` (capitalized) but the database has `session` (lowercase), causing errors like:

```
The table `public.Session` does not exist in the current database.
```

**Fix:** Add `@@map("table_name")` to every model that corresponds to a lowercase database table:

```prisma
model Session {
  // ... fields
  @@map("session")  // Maps Prisma model "Session" to database table "session"
}

model User {
  // ... fields
  @@map("user")  // Maps Prisma model "User" to database table "user"
}
```

**When to add `@@map`:**
- Always check the actual database table names using Postgres MCP
- If the database table is lowercase and the Prisma model is PascalCase, add `@@map`
- This is especially critical for Better-Auth models (User, Session, Account, Verification)

**Common affected models:**
- `Session` → `@@map("session")`
- `User` → `@@map("user")`
- `Account` → `@@map("account")`
- `Verification` → `@@map("verification")`

### 5.2 Web Research via Brave Search MCP

### 5.3 Next.js 16: `middleware.ts` renamed to `proxy.ts` (Deprecated Convention)

Next.js 16.1+ deprecates the `middleware.ts` file convention and replaces it with `proxy.ts`. If you see warnings like:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**Fix:** rename `src/middleware.ts` → `src/proxy.ts` and export a `proxy()` function.

**Codemod:** run the official Next.js codemod:
- `npx @next/codemod@canary middleware-to-proxy .`

Reference: [Next.js “Renaming Middleware to Proxy”](https://nextjs.org/docs/messages/middleware-to-proxy)

### 5.4 Better-Auth + Prisma: Required Schema Invariants (Do Not Break)

These issues have caused repeated production-blocking crashes in this repo. If you change auth models, you MUST keep these invariants:

- **`Session.token` must be `@unique`**
  - Better-Auth updates sessions by `token` (e.g., `prisma.session.update({ where: { token } })`).
  - Prisma only allows that if `token` is part of `SessionWhereUniqueInput`.
  - **Rule:** keep `token String @unique` in the `Session` model and ensure the DB has a unique index.

- **Auth models MUST match DB columns**
  - If the database has `createdAt` / `updatedAt` (common on `session`, `account`, `expert`), the Prisma models must include them with `@default(now())` / `@updatedAt`.

- **After ANY Prisma schema change**
  - Run `npx prisma db push`
  - Run `npm run db:generate`
  - **Fully restart** `next dev` (do not rely on Fast Refresh)
  - If you renamed proxy/middleware files or see odd dev build state, also delete `.next/` before restarting.

### 5.5 TypeScript: Never Include `.next/dev/types/**` in `tsconfig.json`

Next’s `.next/dev/types/**` files are ephemeral and can disappear whenever `.next/` is cleared.
Including them causes TypeScript “File not found” errors.

- **Rule:** Do NOT include `.next/dev/types/**/*.ts` in `tsconfig.json`
- **Recommended:** Exclude `.next` entirely in `tsconfig.json` and keep only `.next/types/**/*.ts` if needed.

### 5.6 Next.js Dev: “Failed to find Server Action” (Stale Build/Client)

If you see:

```
Error: Failed to find Server Action "…". This request might be from an older or newer deployment.
```

This is typically a **stale dev build / old client bundle** after changes (especially Server Actions).

**Fix (dev):**
- Stop all running `next dev` processes
- Delete `.next/`
- Restart `npm run dev`
- Hard refresh the browser (Ctrl+Shift+R) / clear site data if needed

**Use `@brave-search` MCP for real-time information gathering and research.**

- Use `mcp_brave-search_brave_web_search` for general web searches, news, articles, and technical documentation
- Use `mcp_brave-search_brave_local_search` for local business searches (restaurants, services, places)
- Prefer Brave Search MCP over web_search tool when you need:
  - Up-to-date information about libraries, frameworks, or APIs
  - Recent technology updates or breaking changes
  - Current best practices or community discussions
  - Local business information for location-based features

**When to use Brave Search MCP:**
- Researching current versions of dependencies
- Finding recent examples or tutorials
- Checking for breaking changes in libraries
- Gathering information about external APIs or services
- Looking up local businesses or services for location features

**When NOT to use:**
- Information already in the codebase (use codebase_search instead)
- Schema verification (use Postgres MCP instead)
- Code analysis (use grep or codebase_search)

## 6. Pre-Generation Checklist

Before providing code, verify:

1. **Imports:** Am I importing mongoose? → STOP. Use prisma from `@/lib/db`.
2. **Data Fetching:** Am I using `useEffect` to fetch data on mount? → STOP. Fetch data directly in the async function `Page()` (Server Component).
3. **Accessibility:** Does every Input have a unique ID matching a Label's `htmlFor`?
4. **Layout:** Did I use `flex flex-col gap-X` for vertical lists of interactive elements?
5. **PWA:** Is the ServiceWorkerCleanup component being respected in development mode?
6. **Database:** Have I verified the schema using Postgres MCP if making schema-related changes?
7. **Research:** Have I used Brave Search MCP for current information instead of relying on potentially outdated knowledge?

## 7. Migration Reminders (If Refactoring)

- **Auth:** Replace passport or next-auth with Better-Auth.
- **Grocery Logic:** Convert JS aggregation loops into SQL/Prisma `groupBy` queries where possible.
- **Service Workers:** Ensure service workers are unregistered in development via the ServiceWorkerCleanup provider to prevent console log spam.

## The "HealthHub Pattern" for Dynamic Lists

```tsx
<div className="flex flex-col gap-4">
  {items.map((item, index) => (
    <div key={item.id} className="flex flex-col gap-1.5">
      <label htmlFor={`item-input-${index}`} className="text-sm font-medium">
        {item.label}
      </label>
      <Input 
        id={`item-input-${index}`} 
        value={item.value} 
        onChange={...} 
      />
    </div>
  ))}
</div>