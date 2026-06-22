# GuB

A web store for **shoes & clothing** — a **portfolio** project, deployed entirely on the **free tier ($0)**.

A monorepo with two apps: `frontend/` (Next.js → Vercel) and `backend/` (NestJS → Render/Koyeb),
using **npm workspaces**. Full architecture in [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Working rules for Claude Code in [`CLAUDE.md`](./CLAUDE.md).

---

## Structure

```
gub/
├── CLAUDE.md            # shared rules for Claude Code
├── ARCHITECTURE.md      # overall architecture, decision log, phases
├── .mcp.json            # MCP: Neon + Stripe
├── .claude/             # commands, agents, hooks, settings
├── .env.example         # lists every environment variable (do NOT commit the real .env)
├── frontend/            # Next.js App Router  (own CLAUDE.md · ARCHITECTURE.md · README.md)
└── backend/             # NestJS modular monolith (own CLAUDE.md · ARCHITECTURE.md · README.md)
```

## Tech stack (all free tier)

| Layer | Technology / service |
|---|---|
| Frontend | Next.js App Router · TypeScript · Tailwind · shadcn/ui · TanStack Query · Zustand · next-intl → **Vercel** |
| Backend | NestJS · Prisma · class-validator → **Render / Koyeb** |
| Database | **Neon** (Postgres) |
| Auth | **Supabase Auth** |
| Realtime | **Supabase Realtime** |
| Queue | **Upstash QStash** |
| Payments | **Stripe** (test mode) |
| Email | **Resend** |
| Images | **Supabase Storage** / **Cloudinary** |
| Keep-alive | **UptimeRobot** (ping `/health` every 5 minutes) |
| Cron jobs | **pg_cron** (Supabase) / cron-job.org |

## Quick start

```bash
# 1. Install dependencies for the whole workspace
npm install

# 2. Create .env from the template, then fill in real values (do NOT commit .env)
cp .env.example .env

# 3. Run the backend (terminal 1)
npm run dev --workspace backend     # → http://localhost:3001

# 4. Run the frontend (terminal 2)
npm run dev --workspace frontend    # → http://localhost:3000
```

Per-app details: [`backend/README.md`](./backend/README.md) · [`frontend/README.md`](./frontend/README.md).

## Environment variables (see `.env.example`)

`DATABASE_URL` (Neon) · `SUPABASE_URL` · `SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` ·
`STRIPE_TEST_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PUBLISHABLE_KEY` ·
`UPSTASH_QSTASH_TOKEN` · `RESEND_API_KEY` · `ADMIN_JOB_SECRET` (for cron to call admin endpoints).

## Deploy

- **Frontend → Vercel:** root directory = `frontend`. Set env vars in the dashboard.
- **Backend → Render/Koyeb:** root directory = `backend`. Set env vars in the dashboard. `DATABASE_URL` points at **Neon** (not Render's free Postgres — deleted after 30 days).
- **Keep-alive:** create an UptimeRobot monitor for `https://<backend>/health`, interval 5 minutes.
- **Cron:** enable `pg_cron` on Supabase, or configure UptimeRobot/cron-job.org to call `POST /admin/jobs/*` with the secret header.

## Phases

0 Foundation → 1 Catalog → 2 Cart+Auth+Checkout *(hardest)* → 3 Post-purchase →
4 Promotions & personalization → 5 Admin analytics → 6 Realtime chat → 7 Polish.

Principle: **build the purchase flow (Phase 0→2) first**, the engagement layer after. Details in `ARCHITECTURE.md §7`.
