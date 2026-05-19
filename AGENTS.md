# HealthHub — Agent Instructions

Single source of truth for AI agents in this repo (Cursor, Codex, etc.).  
Scoped rules: **`.cursor/rules/*.mdc`**. Roadmap: **`Docs/SprintList.md`**.

## Workflow

1. Read this file + any matching `.cursor/rules/*.mdc` for the files you touch.
2. After large merges or new rules: run **`/index`** (jcodemunch full reindex).
3. Schema changes: verify with **`@postgres`** MCP before `db push`.
4. Commits: **`/commit`** (staged changes only).

## Route groups

| Group | Purpose |
|-------|---------|
| `(auth)` | Sign in / sign up |
| `(protected)` | Authenticated app (sidebar) |
| `(public)` | Guest recipes, learn, legal |
| `(standalone)` | Full-screen timer at `/timer` |

## Stack

- **Framework**: Next.js 16 (App Router) — Server Components by default
- **Database**: PostgreSQL on Neon Serverless
- **ORM**: Prisma 7 (`@prisma/adapter-pg` with standard `pg` Pool)
- **Auth**: Better-Auth (`auth.api.getSession()` server-side, `useSession()` client-side)
- **Styling**: Tailwind CSS v4 (no `tailwind.config.js`; theme via CSS variables in `globals.css`)
- **State**: nuqs for URL search params, Zustand for global UI state
- **Package manager**: pnpm (commit `pnpm-lock.yaml` only; ignore `package-lock.json`)
- **Validation**: `zod` (direct dependency — required for Server Actions)

## Forbidden patterns

- No Express, MongoDB, Mongoose, Vite SPA, or Passport.js
- No `useEffect` for initial data fetching — use Server Components
- No `any` type — infer from Prisma (`Prisma.RecipeGetPayload<{…}>`) and validate inputs with Zod
- No API route files (`src/app/api/route.ts`) for internal CRUD — use Server Actions (auth API excepted)
- No hardcoded HEX/RGB in styles — use Tailwind theme tokens (`text-primary-500`, `bg-wellness-600`)
- No `space-y-*` on containers with interactive children — use `flex flex-col gap-X`
- Never include `.next/dev/types/**` in `tsconfig.json`

## Directory layout

```
src/
├── app/
│   ├── (auth)/           # Login, Register
│   ├── (protected)/      # Authenticated routes (sidebar layout)
│   ├── (public)/         # Public routes (recipes, learn, legal)
│   ├── (standalone)/     # Full-screen timer at /timer
│   ├── layout.tsx        # Root layout (sole globals.css import)
│   └── globals.css
├── actions/              # Server Actions ('use server', Zod-validated)
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── [feature]/        # recipes/, journal/, timer/, …
├── lib/                  # db, auth, utils
└── db/                   # seed scripts
```

## Server Actions

- Place in `src/actions/[feature].ts` with `'use server'`
- Validate all inputs with Zod before any database call
- Wrap in try/catch, return `{ success: boolean; error?: string; data?: T }`
- Details: `.cursor/rules/server-actions.mdc`

## Styling & layout

- Use `cn()` from `@/lib/utils` for conditional classes
- Form fields: `<label htmlFor>` matching `<input id>`
- Dynamic list IDs: `` id={`item-input-${index}`} ``
- Touch targets: `min-h-[44px]` on nav items and buttons
- Destructive actions: minimum `gap-6` separation

## Dynamic list pattern

```tsx
<div className="flex flex-col gap-4">
  {items.map((item, index) => (
    <div key={item.id} className="flex flex-col gap-1.5">
      <label htmlFor={`item-input-${index}`} className="text-sm font-medium">
        {item.label}
      </label>
      <Input id={`item-input-${index}`} value={item.value} onChange={…} />
    </div>
  ))}
</div>
```


## Database & Prisma

- Use Prisma `include`/`select` — no JS-loop joins
- After schema change: `pnpm db:push` → `pnpm db:generate` → restart `next dev`
- Add `@@map("table_name")` when DB tables are lowercase (Better-Auth models)
- Verify with `@postgres` MCP before schema-related code changes
- Details: `.cursor/rules/prisma-auth.mdc`

## Better-Auth invariants

- `Session.token` must be `@unique`
- Auth models need `createdAt` / `updatedAt` when DB columns exist
- After auth schema changes: push, generate, **full restart** (no Fast Refresh only)

## Next.js 16 specifics

- `middleware.ts` is deprecated → use `src/proxy.ts` with `proxy()` export
- "Failed to find Server Action" → stop dev, delete `.next/`, restart, hard-refresh browser
- Dev/build use `--webpack` for PWA plugin (`next.config.ts`)

## Timer (PomoZen)

- Local-first (Zustand + localStorage); do not change store/worker contracts casually
- `cn` from `@/lib/utils` only
- Details: `.cursor/rules/timer-pomo.mdc`

## MCP tools

- **@postgres**: schema verification, column types, persistence debugging
- **@brave-search**: library versions and breaking changes (not codebase search)

## Common commands

```bash
pnpm install
pnpm dev              # webpack mode (PWA)
pnpm db:push
pnpm db:generate
pnpm db:seed
pnpm lint
pnpm exec tsc --noEmit
```
