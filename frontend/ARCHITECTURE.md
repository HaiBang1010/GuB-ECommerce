# GuB Frontend — Architecture

Next.js **App Router** on Vercel. Overall system architecture: see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Foundational principles

- The frontend talks only to the **backend (Render)** over a REST API. It does **NOT** access the DB or Stripe secrets directly from the browser.
- The public storefront is browsable **without login**; login is required only at checkout.
- Every UI string goes through **next-intl** (vi/en) — never hardcode language in a component.
- **Light theme only.**

## 2. Directory structure (actual, Phase 3 — `features/` by domain)

Code is organised **by domain feature**, not by technical layer. Each domain owns its
`{components,hooks,api}/`; admin is kept **separate** from the storefront business domains
(an admin area is not a "domain"). Only genuinely shared leaves stay in `components/`, and
`lib/api/` holds infra only — domain fetchers live in `features/<domain>/api/`.

```
src/
├── app/[locale]/                 # next-intl: /vi, /en — route groups are URL-transparent
│   ├── (storefront)/             # home · products/[slug] · cart · checkout · orders/[id]{/pay,/confirmation} · auth + Header
│   ├── (admin)/admin/            # orders · users · users/[id] · reviews (admin shell)
│   └── providers.tsx, layout.tsx # QueryClient + Supabase session bridge + <Toaster>
├── features/                     # domain-owned UI; each is {components,hooks,api}/ as needed
│   ├── product/ cart/ checkout/  # storefront domains
│   ├── order/ review/            #   order (customer) + review (customer) — fetchers/hooks own the
│   │                             #   canonical core types (e.g. OrderStatus in order/api/orders.ts)
│   ├── notification/ auth/       #   notification bell + me.ts / is-admin
│   └── admin/                    # ADMIN — split by area, separate from storefront domains
│       ├── orders/ users/ reviews/  #   each {components,hooks,api}/; the admin halves of the
│       │                            #   split order/review fetchers + hooks live here
│       ├── components/           #   admin-shared: order-detail-dialog, pagination-bar
│       └── hooks/                #   admin-shared: use-debounce
├── components/                   # SHARED leaves only: header, order-status-badge, star-rating + ui/ (shadcn primitives)
├── lib/api/                      # infra ONLY: apiFetch client + committed schema.d.ts (NO fetchers here)
├── lib/                          # money, datetime, utils, stripe, supabase/ (browser/server/middleware clients)
├── stores/                       # Zustand: auth + cart (guest sessionId + display snapshots)
├── i18n/ · messages/             # routing/navigation helpers + vi.json / en.json
└── middleware.ts                 # i18n locale + Supabase session refresh + protect /checkout, /orders, /admin
```

The admin area lives in a `[locale]/(admin)/admin/` route group with its own shell; the storefront
`Header` sits in a sibling `[locale]/(storefront)/` group (route groups are URL-transparent, so
customer URLs are unchanged). See §10. There is no `app/api/` BFF layer; the browser calls the
NestJS backend directly (CORS-open in dev).

**Cross-feature edges (intentional, type-only or admin-embedded):** `OrderStatus` + core order types
are canonical in `features/order/api/orders.ts`; the shared `order-status-badge`, `features/admin/orders`
and `features/admin/users` type-import them. The admin review fetcher (`features/admin/reviews/api`)
type-imports `Review` from `features/review/api`. The admin reply form
(`features/admin/reviews/components/admin-reply-form`) is embedded (admin-gated) on the storefront
product page — one deliberate storefront→admin edge.

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
- **Durable payment page** `/[locale]/orders/[id]/pay` (its own URL, not an inline checkout step): on every mount it re-fetches the `clientSecret` from the order id via the idempotent `POST /payments/intent`, so a refresh / tab-switch / revisit lands back on a working card field instead of losing it. Shared by checkout (new order) and pay-again. Guards by order status (PAID → confirmation, CANCELLED → notice). The webhook is the source of truth; the confirmation page polls `useOrder` until the status flips.
- **Stock vs. payment at checkout:** a place-order **409** (`OUT_OF_STOCK`) is shown as a per-item "only N left" message and refreshes the cart — distinct from a real payment error; the cart blocks checkout while any line exceeds live stock (auto-capping over-stock lines).
- `apiFetch` **swallows request cancellations** (an `AbortError` from a query whose page navigated away) instead of surfacing them as runtime errors, while still reporting genuine network failures.

## 7. Performance & SEO

- Product pages: SSR/SSG for SEO (Phase 7). Images: use `next/image`, webp format.
- Visitor analytics: **Vercel Web Analytics** (not inferred from order data).
- Admin charts: Recharts, data from the backend's aggregate API.

## 8. Reviews (Phase 3)

Purchased-only reviews surface in two existing pages (no new route):
- **Order detail** (`features/order/components/order-detail-view.tsx`) — a `DELIVERED` order renders a
  write/edit review block **per distinct product** (the backend allows one review per product,
  not per line item). The user's existing review is found by matching their id against the
  product's public review list (`useProductReviews`), since the order payload carries no review
  back-reference. Interactive `StarRating` + `Textarea`; `useCreateReview` / `useUpdateReview`
  invalidate `['reviews', productId]`.
- **Product detail** (`features/product/components/product-detail-view.tsx`) — a public rating summary
  (half-star average + count) and review list, each with a **"Verified buyer"** badge (the API
  exposes only `userId`, no name) and a **"Store reply"** block when `adminReply` is present.

Data layer: the customer fetchers/hooks (`features/review/api/reviews.ts` + `features/review/hooks/use-reviews.ts`)
and the admin reply fetcher/hook (`features/admin/reviews/{api/reviews.ts,hooks/use-admin-reviews.ts}`);
the shared `components/star-rating.tsx` + `ui/textarea.tsx`, and the `reviews` i18n namespace. The reply *display* (the "Store reply"
block) ships for everyone; **admin reply input** now ships too — an inline box on product detail,
shown to an admin under each review without a reply (`POST /admin/reviews/:id/reply`). It lives on
the product page because there is no admin list-all-reviews endpoint. See §10.

## 9. Notifications (Phase 3)

A bell in the header (`features/notification/components/notification-bell.tsx`), shown for logged-in users only.
`useNotifications` (`features/notification/hooks/use-notifications.ts`) fetches the list + `unreadCount`, gated by the
auth store and polling every 60s (no realtime until Phase 6). The badge shows the unread count; the
shadcn `DropdownMenu` lists items, each rendering its text from the structured `type` + `payload.orderId`
via the `notification` i18n namespace — **never** a stored string — linking to `/orders/[id]` and
marking itself read on select (`useMarkNotificationRead`), plus a "mark all read" action
(`useMarkAllNotificationsRead`). Both mutations invalidate `['notifications']`. The backend is the
producer (the single async path, backend §4.8); the frontend only reads + acks.

## 10. Admin (Phase 3)

The admin area is a `[locale]/(admin)/admin/` route group with its own client `AdminLayout` (an admin
topbar + a sidebar: **Orders**, plus **Reviews/Catalog/Analytics** "coming soon" placeholders) —
separate from the `[locale]/(storefront)/` group that renders the storefront `Header`. Route groups
don't affect the URL, so every customer route is unchanged.

**Role is the single source of truth from the backend.** `Providers` calls `GET /me` (which returns
`iam.User.role`) on the initial session and on `SIGNED_IN`, storing `role` in the auth store (cleared
on `SIGNED_OUT`); there is **no** Supabase-metadata role sync. `isAdmin(role)` gates the Header's
Admin link and the layout. The client guard is a **convenience** — it waits for the auth store to
settle, then redirects a non-admin. The real protection is twofold: `middleware.ts` requires a
session to enter `/admin` (guests → login), and the backend **`RoleGuard`** rejects every `/admin/*`
API call from a non-admin (403). A wrong client-side guess can never bypass it.

**Orders** (`/admin/orders`): `useAdminOrders` fetches a **paginated** page (`GET /admin/orders`); each
row shows the order id, the **customer** (name + email, enriched server-side via `UserService` — a
service call, **no cross-module JOIN**), a status badge, the total, and a status-advance button
(PAID→PROCESSING→SHIPPED→DELIVERED via `POST /admin/orders/:id/status`; the frontend only picks the next
step, the backend enforces the legal transition). The toolbar adds a **multi-status checkbox filter**, a
**debounced unified search** (order id / customer name / email), and a **rows-per-page + windowed pager**
(`page`/`pageSize` + `total`, `keepPreviousData` so paging doesn't flash); any filter/search/page-size
change resets to page 1. The customer cell links to `/admin/users/[id]`, a **placeholder route (404 for
now)** — an admin user-detail page is a later slice.

**Review reply** is inline on product detail (§8), not a dedicated admin page, because the backend
exposes no admin list-all-reviews endpoint — only `POST /admin/reviews/:id/reply` (by review id).
