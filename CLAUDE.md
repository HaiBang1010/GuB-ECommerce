# GuB — Modular Monolith (shoes & clothing web store)

> Portfolio project. Hard constraint throughout: **everything deploys on free tier ($0)**.
> This file is loaded every session — keep it SHORT. Layer-specific details live in `frontend/CLAUDE.md`
> and `backend/CLAUDE.md`. Full architecture in `ARCHITECTURE.md`.

## Communication

- **Talk to the user in Vietnamese** — the user speaks Vietnamese.
- **Write code comments in English.**
- **App UI labels** (buttons, nav, menu, placeholder, tooltip, headings): ENGLISH.
- **Error messages returned to the user** (HTTP responses, validation errors, toast): ENGLISH.

## Monorepo
- `frontend/` — Next.js App Router → deploy **Vercel** (root dir = frontend).
- `backend/`  — NestJS modular monolith → deploy **Render/Koyeb** (root dir = backend).
- Uses **npm workspaces**. The browser NEVER talks directly to the DB/Stripe — everything sensitive goes through the backend.

## Architecture (MANDATORY)
- **NestJS modular monolith — NO microservices.** One deploy, many modules.
- Modules: `auth · product · cart · order · payment · notification · review · chat · voucher · marketing`, plus a read-only `analytics` module (admin dashboard aggregations; owns no schema).
- Modules communicate THROUGH a service interface, called **in-process** — NO internal network calls.
- Each module owns its **own Postgres schema** (`product.*`, `order.*`, ...). **No cross-schema JOINs** — if you need another module's data, call its service.
- Exactly one async path: `order` pushes an event to the queue → `notification` consumes it.

## Conventions
- TypeScript **strict**, no `any`, no default exports.
- **Money stored as integer cents**, never float.
- **Soft delete / archive everything**, never hard-delete (orders reference products).
- **i18n VN/EN from Phase 0**; bilingual product content (two columns `name_vi` / `name_en`). NO dark mode.
- Validate every input (backend: class-validator/zod · frontend: zod + react-hook-form).
- Commit format: `feat/fix/chore(scope): short description`.

## Data safety
- NEVER commit `.env` or Stripe/Supabase/Neon keys. Stripe is always in **test mode** while developing.
- NEVER run destructive DB commands (`migrate reset`, `DROP`) without manual confirmation.
- Every admin endpoint must go through a **role guard on the backend** — don't just hide buttons on the frontend.

## Core problems to remember to solve (details in ARCHITECTURE.md §6)
Stock race condition (atomic decrement / time-boxed reservation) · guest-cart merge on login ·
price snapshot at order time (`unit_price_cents`) · idempotent Stripe webhook · release stock on payment failure.

## Working with Claude Code
- Large tasks: enable **plan mode** (`Shift+Tab`), review the plan before changing code.
- `/clear` between unrelated tasks. Start small — add a command/subagent when you notice repeated work.
