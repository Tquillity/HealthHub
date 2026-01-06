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

## 5. Database Verification via MCP

**CRITICAL:** Always use the `@postgres` MCP to verify schema changes or debug data persistence before suggesting code changes.

- Use `mcp_postgres_query` to verify table structures match `prisma/schema.prisma`
- Verify column types, especially array types (TEXT[] should appear as `_text` in PostgreSQL)
- Check for missing columns before suggesting Prisma operations
- Query actual data to debug persistence issues rather than assuming schema state

**Example MCP Verification:**
```sql
-- Verify JournalEntry array columns
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'journal_entry' 
AND column_name IN ('gratitudeEntries', 'goalsAchieved', 'symptomsPhysical');
```

## 6. Pre-Generation Checklist

Before providing code, verify:

1. **Imports:** Am I importing mongoose? → STOP. Use prisma from `@/lib/db`.
2. **Data Fetching:** Am I using `useEffect` to fetch data on mount? → STOP. Fetch data directly in the async function `Page()` (Server Component).
3. **Accessibility:** Does every Input have a unique ID matching a Label's `htmlFor`?
4. **Layout:** Did I use `flex flex-col gap-X` for vertical lists of interactive elements?
5. **PWA:** Is the ServiceWorkerCleanup component being respected in development mode?
6. **Database:** Have I verified the schema using Postgres MCP if making schema-related changes?

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