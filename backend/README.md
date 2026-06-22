# GuB Backend

NestJS **modular monolith** + Prisma + PostgreSQL (Neon). Deploy: **Render / Koyeb** (root dir = `backend`).

- Backend architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Rules for Claude Code: [`CLAUDE.md`](./CLAUDE.md)

---

## Requirements
- Node.js LTS, npm
- A `DATABASE_URL` pointing at Neon (Postgres)

## Install & run

```bash
# from the monorepo root
npm install

# generate the Prisma client
npx prisma generate --schema backend/prisma/schema.prisma

# run a migration (dev)
npm run prisma:migrate --workspace backend   # or: cd backend && npx prisma migrate dev

# run the dev server
npm run dev --workspace backend               # → http://localhost:3001
```

## Common commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | dev server (watch) |
| `npm run test` | run tests |
| `npm run test -- <path>` | test a single file |
| `npm run lint` | lint |
| `npm run typecheck` | type-check |
| `npx prisma migrate dev --name <name>` | create a migration |
| `npx prisma generate` | generate the Prisma client |

## Environment variables

```
DATABASE_URL=                 # Neon
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_TEST_KEY=              # always test mode while developing
STRIPE_WEBHOOK_SECRET=
UPSTASH_QSTASH_TOKEN=
RESEND_API_KEY=
ADMIN_JOB_SECRET=            # secret for cron to call POST /admin/jobs/*
```

Do NOT commit `.env`. Reference `../.env.example`.

## Modules

`auth · product · cart · order · payment · notification · review · chat · voucher`.
Each module owns its own Postgres schema; they communicate through service interfaces, with **no cross-schema JOINs**.
Details & flows (checkout, webhook, stock) in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Health & keep-alive

- `GET /health` — lightweight, does NOT query the DB. UptimeRobot pings it every 5 minutes to keep Render awake.

## Cron / scheduled jobs

- Birthday vouchers, cart cleanup, expiring stock reservations.
- Use **pg_cron (Supabase)** or have **UptimeRobot/cron-job.org** call `POST /admin/jobs/*` with the secret header (`ADMIN_JOB_SECRET`). Every job must be **idempotent**.

## Deploy notes

- Root directory = `backend`. `DATABASE_URL` points at **Neon** (not Render's free Postgres).
- The Stripe webhook endpoint must be public + idempotent (store the processed `event_id`).
