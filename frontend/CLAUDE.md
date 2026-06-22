# GuB Frontend — Next.js App Router

> This file **supplements** `../CLAUDE.md` (does not override it). Full frontend architecture in `ARCHITECTURE.md` in this folder.

## Commands
- Dev:        `npm run dev`
- Build:      `npm run build`
- Lint:       `npm run lint`
- Typecheck:  `npm run typecheck`

## Stack & conventions
- **App Router** + TypeScript + Tailwind. UI: **shadcn/ui**.
- Forms: **react-hook-form + zod**. Server state: **TanStack Query**. Client state: **Zustand** (guest cart).
- i18n: **next-intl** (vi/en), set up from Phase 0; every UI string goes through the message catalog, never hardcode Vietnamese/English in a component.
- **Light theme only — NO dark mode.**
- Admin charts: **Recharts**. Visitor analytics: **Vercel Web Analytics**.

## Route structure
- Public storefront: browse products, detail, search, filter — **no login required**.
- Admin: route group **`/admin`** + role checks in the UI **and** the backend (don't just hide buttons — the backend is the real gate).
- Each locale has a `/(vi|en)` prefix via next-intl.

## Data & security
- Call the backend API (Render) for everything; **do NOT talk directly to the DB/Stripe** from the browser.
- Stripe: use only the publishable key + Stripe.js on the client; the secret key stays on the backend.
- Read/write through TanStack Query (cache, invalidate); don't scatter ad-hoc fetches across components.

## Guest cart (important)
- Store the guest cart in Zustand (+ persist to localStorage). When the user logs in → **merge** into the server cart (sum quantities, dedupe variants). Don't lose the cart on login.

## Bilingual content
- The admin product form must have **two inputs** for each content field (vi/en): name, description.
