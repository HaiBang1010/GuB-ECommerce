# GuB Frontend

Next.js **App Router** + TypeScript + Tailwind + shadcn/ui. Deploy: **Vercel** (root dir = `frontend`).

- Frontend architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Rules for Claude Code: [`CLAUDE.md`](./CLAUDE.md)

---

## Requirements
- Node.js LTS, npm
- A running backend (default `http://localhost:3001`)

## Install & run

```bash
# from the monorepo root
npm install

npm run dev --workspace frontend     # → http://localhost:3000
```

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run start` | run the build |
| `npm run lint` | lint |
| `npm run typecheck` | type-check |

## Environment variables

```
NEXT_PUBLIC_API_URL=                  # backend URL (e.g. http://localhost:3001)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # publishable key (NEVER use a secret on the client)
```

Only variables prefixed `NEXT_PUBLIC_` are exposed to the browser. The **secret** key is never on the frontend.

## Main stack

- UI: **shadcn/ui** · Forms: **react-hook-form + zod**
- Server state: **TanStack Query** · Client state: **Zustand** (guest cart)
- i18n: **next-intl** (vi/en) · Charts: **Recharts** · Analytics: **Vercel Web Analytics**
- **Light theme only** (no dark mode)

## Key reminders

- All data goes through the **backend API**; the browser does NOT talk directly to the DB/Stripe secret.
- The **guest cart** lives in Zustand (+localStorage); on login it is **merged** into the server cart.
- Admin lives in the `/admin` route group — UI is hidden by role, but the real protection is on the **backend**.
- Every UI string goes through next-intl; bilingual product content (`name_vi`/`name_en`) is chosen by locale.

## Deploy (Vercel)

- Root directory = `frontend`. Set the `NEXT_PUBLIC_*` variables in the dashboard.
- Enable Vercel Web Analytics for visitor metrics.
