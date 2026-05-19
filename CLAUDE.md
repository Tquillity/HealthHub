# CLAUDE.md — HealthHub Agent Rules

## Stack

- **Framework**: Next.js 16 (App Router) — Server Components by default
- **Database**: PostgreSQL on Neon Serverless
- **ORM**: Prisma 7 (`@prisma/adapter-pg` with standard `pg` Pool)
- **Auth**: Better-Auth (`auth.api.getSession()` server-side, `useSession()` client-side)
- **Styling**: Tailwind CSS v4 (no `tailwind.config.js`; theme via CSS variables in `globals.css`)
- **State**: nuqs for URL search params, Zustand for global UI state
- **Package manager**: pnpm

## Forbidden patterns

- No Express, MongoDB, Mongoose, Vite SPA, or Passport.js
- No `useEffect` for initial data fetching — use Server Components
- No `any` type — infer from Prisma (`Prisma.RecipeGetPayload<{…}>`) and validate inputs with Zod
- No API route files (`src/app/api/route.ts`) for internal CRUD — use Server Actions
- No hardcoded HEX/RGB in styles — use Tailwind theme tokens (`text-primary-500`, `bg-wellness-600`)
- No `space-y-*` on containers with interactive children — use `flex flex-col gap-X`
- Never include `.next/dev/types/**` in `tsconfig.json`

## Directory layout

```
src/
├── app/                  # App Router
│   ├── (auth)/           # Login, Register
│   ├── (protected)/      # Authenticated routes (sidebar layout)
│   ├── (public)/         # Public routes (recipes, learn, timer)
│   ├── layout.tsx        # Root layout (sole globals.css import)
│   └── globals.css       # Tailwind v4 theme variables
├── actions/              # Server Actions ('use server', Zod-validated)
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── [feature]/        # Feature-specific (recipes/, journal/, timer/, …)
├── lib/
│   ├── db.ts             # Prisma client singleton
│   ├── auth.ts           # Better-Auth config
│   └── utils.ts          # cn() helper
└── db/                   # seed scripts
```

## Server Actions

- Place in `src/actions/[feature].ts` with `'use server'` directive
- Validate all inputs with Zod before any database call
- Wrap in try/catch, return `{ success: boolean; error?: string; data?: T }`

## Styling & layout

- Use `cn()` for conditional classes
- Form fields must have `<label htmlFor>` matching `<input id>`
- Dynamic list IDs: `id={\`ingredient-name-${index}\`}`
- Touch targets: min 44px height (`min-h-[44px]`) on nav items and buttons
- Destructive actions (Delete, Reset, Logout): minimum `gap-6` separation

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

- Use Prisma `include`/`select` for relational data — no JS-loop joins
- After any schema change: `npx prisma db push` → `pnpm db:generate` → restart `next dev`
- PostgreSQL stores unquoted table names lowercase — add `@@map("table_name")` to Prisma models when needed (especially Better-Auth models: User, Session, Account, Verification)
- Verify schema with `@postgres` MCP before suggesting schema-related code changes

## Better-Auth invariants

- `Session.token` must be `@unique` (Better-Auth updates sessions by token)
- Auth models must include `createdAt @default(now())` / `updatedAt @updatedAt` if the DB columns exist
- After auth schema changes: push, generate, **full restart** (no Fast Refresh reliance)

## Next.js 16 specifics

- `middleware.ts` is deprecated → use `src/proxy.ts` with `proxy()` export
- "Failed to find Server Action" error → stop dev, delete `.next/`, restart, hard-refresh browser

## MCP tools

- **@postgres**: verify schema, check column types, debug data persistence
- **@brave-search**: current library versions, breaking changes, best practices (not for codebase questions)

## Common commands

```bash
pnpm install          # install deps
pnpm dev              # dev server
pnpm db:push          # sync Prisma schema to DB
pnpm db:generate      # regenerate Prisma client
pnpm db:seed          # seed data
```
