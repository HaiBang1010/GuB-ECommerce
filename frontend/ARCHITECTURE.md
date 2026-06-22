# GuB Frontend — Architecture

Next.js **App Router** on Vercel. Overall system architecture: see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Foundational principles

- The frontend talks only to the **backend (Render)** over a REST API. It does **NOT** access the DB or Stripe secrets directly from the browser.
- The public storefront is browsable **without login**; login is required only at checkout.
- Every UI string goes through **next-intl** (vi/en) — never hardcode language in a component.
- **Light theme only.**

## 2. Directory structure (suggested)

```
src/
├── app/
│   ├── [locale]/                 # next-intl: /vi, /en
│   │   ├── (storefront)/         # public pages: home, list, product, cart, checkout
│   │   └── (admin)/admin/        # admin route group, behind a role guard
│   ├── api/                      # route handlers (thin BFF if proxying is needed)
│   └── layout.tsx
├── components/                   # shared UI (shadcn/ui)
├── features/                     # domain logic: product, cart, order, ...
├── lib/                          # api client, query client, utils
├── stores/                       # Zustand (guest cart)
├── messages/                     # vi.json, en.json (i18n catalog)
└── middleware.ts                 # next-intl locale + /admin protection
```

## 3. State management

- **Server state (data from the backend):** TanStack Query — cache, invalidate, retry. No scattered `fetch` calls inside components.
- **Client state:** Zustand for the **guest cart** (persisted to localStorage). When the user logs in → **merge** the guest cart into the server cart (sum quantities, dedupe identical variants); after the merge, the server cart is the source of truth.
- Forms: react-hook-form + **zod** schema (kept in sync with the backend DTO types where shareable).

## 4. i18n

- next-intl with a `[locale]` prefix. Catalog in `messages/vi.json` + `messages/en.json`.
- Bilingual product content comes from the backend (`name_vi`/`name_en`) — the frontend picks based on the current locale.
- The admin product form has **two inputs** for each content field (vi/en).

## 5. Admin & RBAC

- The `/admin` route group hides UI by role, **but** all real protection lives on the backend (role guard). The frontend is only a convenience layer.
- Middleware checks the session before entering `/admin`; the backend is still the real gatekeeper.

## 6. Payments

- Use `@stripe/stripe-js` + Elements with the **publishable key**. Get the `clientSecret` from the backend, confirm the payment on the client.
- The **secret** key is never on the frontend.

## 7. Performance & SEO

- Product pages: SSR/SSG for SEO (Phase 7). Images: use `next/image`, webp format.
- Visitor analytics: **Vercel Web Analytics** (not inferred from order data).
- Admin charts: Recharts, data from the backend's aggregate API.
