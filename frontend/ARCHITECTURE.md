# GuB Frontend — Architecture

Next.js **App Router** on Vercel. Overall system architecture: see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Foundational principles

- The frontend talks only to the **backend (Render)** over a REST API. It does **NOT** access the DB or Stripe secrets directly from the browser.
- The public storefront is browsable **without login**; login is required only at checkout.
- Every UI string goes through **next-intl** (vi/en) — never hardcode language in a component.
- **Light theme only.**

## 2. Directory structure (actual, Phase 4 — `features/` by domain)

Code is organised **by domain feature**, not by technical layer. Each domain owns its
`{components,hooks,api}/`; admin is kept **separate** from the storefront business domains
(an admin area is not a "domain"). Only genuinely shared leaves stay in `components/`, and
`lib/api/` holds infra only — domain fetchers live in `features/<domain>/api/`.

```
src/
├── app/[locale]/                 # next-intl: /vi, /en — route groups are URL-transparent
│   ├── (storefront)/             # home (banners · category grid · featured collections · product rows) · products/[slug] · collections/[slug] · cart · checkout · auth · account (orders/[id]{/pay,/confirmation} · vouchers · profile) + Header + Footer + floating ChatWidget
│   ├── (admin)/admin/            # orders · users · users/[id] · reviews · vouchers · sales · categories · collections · banners · analytics · chat (admin shell)
│   └── providers.tsx, layout.tsx # QueryClient + Supabase session bridge + <Toaster>
├── features/                     # domain-owned UI; each is {components,hooks,api}/ as needed
│   ├── product/ category/ collection/ cart/ checkout/ voucher/  # storefront domains (voucher = preview at checkout)
│   ├── order/ review/            #   order (customer) + review (customer) — fetchers/hooks own the
│   │                             #   canonical core types (e.g. OrderStatus in order/api/orders.ts)
│   ├── notification/ auth/ chat/ #   notification bell · me.ts / is-admin · customer chat widget (§18)
│   └── admin/                    # ADMIN — split by area, separate from storefront domains
│       ├── orders/ users/ reviews/ vouchers/ sales/ chat/  # each {components,hooks,api}/; the admin halves of
│       │                            #   the split order/review fetchers + hooks live here; vouchers + sales are admin-only
│       ├── components/           #   admin-shared: order-detail-dialog, pagination-bar
│       └── hooks/                #   admin-shared: use-debounce
├── components/                   # SHARED leaves only: header, footer, order-status-badge, star-rating + ui/ (shadcn primitives; sheet is a hand-built Radix Dialog wrapper)
├── lib/api/                      # infra ONLY: apiFetch client + committed schema.d.ts (NO fetchers here)
├── lib/                          # money, datetime, utils, stripe, supabase/ (browser/server/middleware clients)
├── stores/                       # Zustand: auth + cart (guest sessionId + display snapshots)
├── i18n/ · messages/             # routing/navigation helpers + vi.json / en.json
└── middleware.ts                 # i18n locale + Supabase session refresh + protect /checkout, /account, /admin
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
- **Durable payment page** `/[locale]/account/orders/[id]/pay` (its own URL, not an inline checkout step): on every mount it re-fetches the `clientSecret` from the order id via the idempotent `POST /payments/intent`, so a refresh / tab-switch / revisit lands back on a working card field instead of losing it. Shared by checkout (new order) and pay-again. Guards by order status (PAID → confirmation, CANCELLED → notice). The webhook is the source of truth; the confirmation page polls `useOrder` until the status flips.
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
block) ships for everyone; **admin reply input** now ships too — an inline `AdminReplyForm` shown to an
admin under each review without a reply (`POST /admin/reviews/:id/reply`), available **both** on the
storefront product page and on the dedicated `/admin/reviews` list-all page (§10).

## 9. Notifications (Phase 3)

A bell in the header (`features/notification/components/notification-bell.tsx`), shown for logged-in users only.
`useNotifications` (`features/notification/hooks/use-notifications.ts`) fetches the list + `unreadCount`, gated by the
auth store and polling every 60s (no realtime until Phase 6). The badge shows the unread count; the
shadcn `DropdownMenu` lists items, each rendering its text from the structured `type` + `payload.orderId`
via the `notification` i18n namespace — **never** a stored string — linking to `/account/orders/[id]` and
marking itself read on select (`useMarkNotificationRead`), plus a "mark all read" action
(`useMarkAllNotificationsRead`). Both mutations invalidate `['notifications']`. The backend is the
producer (the single async path, backend §4.8); the frontend only reads + acks.

## 10. Admin (Phase 3)

The admin area is a `[locale]/(admin)/admin/` route group with its own client `AdminLayout` (an admin
topbar + a sidebar: **Orders · Users · Reviews · Vouchers · Sales · Categories · Collections · Banners ·
Analytics** are all wired as of Phase 5, §17) — separate from the `[locale]/(storefront)/` group that
renders the storefront `Header`.
Route groups don't affect the URL, so every customer route is unchanged.

**Role is the single source of truth from the backend.** `Providers` calls `GET /me` (which returns
`iam.User.role`) on the initial session and on a **genuine `SIGNED_IN` (a new user id)**, storing `role`
in the auth store (cleared on `SIGNED_OUT`); there is **no** Supabase-metadata role sync. The
new-user-id guard matters: supabase-js **re-emits `SIGNED_IN` on every tab refocus**, and re-running the
role sync would flip `roleStatus` back to `loading` → the layout's `resolving` guard would unmount the
page mid-edit (an open Sheet/form is lost). The guard makes a same-user re-emit a no-op (it also skips a
redundant guest-cart merge). `isAdmin(role)` gates the Header's
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
change resets to page 1. Clicking an order id opens a shared **order-detail dialog** (`useAdminOrderDetail`
→ `GET /admin/orders/:id`: full items, shipping snapshot, status timeline, customer, and the advance-status
action). For a refundable order (`PAID`/`PROCESSING`/`SHIPPED`) the dialog also shows a destructive
**Refund** button (`useRefundOrder` → `POST /admin/orders/:id/refund`) behind a `window.confirm`; the
backend issues the Stripe refund, conditionally restocks, and flips the order to `REFUNDED` (ARCHITECTURE.md
§4.13). On success the list/detail/user queries invalidate and the status badge (which already maps
`REFUNDED`) updates. The customer cell links to the **user-detail page** at `/admin/users/[id]`.

**Users** (`/admin/users` + `/admin/users/[id]`): the list (`useAdminUsers` → `GET /admin/users`) is
paginated with a debounced name/email search; each row links to the detail page. The detail page
(`useAdminUser` → `GET /admin/users/:id`) is composed **in-process, never a cross-schema JOIN**: identity +
profile + address book from iam, **order stats + recent orders** from the order module (`OrderModule`
exports `OrderService`; iam imports it — acyclic). The stats card shows total orders, **total spent**
(only money actually collected — `PAID`/`PROCESSING`/`SHIPPED`/`DELIVERED`; `PENDING_PAYMENT`,
`CANCELLED` and `REFUNDED` are excluded), and a per-status breakdown (`byStatus` counts **every** status).
Recent orders open the same shared order-detail dialog.

**Reviews** (`/admin/reviews`): `useAdminReviews` (`GET /admin/reviews`) lists **every** review, paginated
and enriched with product name + reviewer identity, with an **all / unreplied / replied** filter. A review
with no reply shows an inline `AdminReplyForm` (`POST /admin/reviews/:id/reply`); the same form is **also**
embedded (admin-gated) on the storefront product detail (§8), so an admin can reply from either place.

**Vouchers** (`/admin/vouchers`): `useAdminVouchers` (`GET /admin/vouchers`) — paginated list with a
debounced code search. **New / Edit** open a right-side **Sheet** (`components/ui/sheet.tsx`, a hand-built
Radix Dialog wrapper) holding an RHF + zod form with the full field set, incl. the **two inputs per
content field** (`titleVi/En`, `descriptionVi/En`) and `PERCENT`/`FIXED` + public/wallet `<select>`s
(no shadcn Select primitive yet). Money inputs are integer cents. Archive is a soft delete. A **grant
panel** — shown **only for wallet-only vouchers** (`isPublic === false`; public ones need no grant) —
grants by **email** (`POST /admin/vouchers/:id/grant`) and lists the granted users with their used/unused
state (`GET /admin/vouchers/:id/grants`). The **user-detail page** (`/admin/users/[id]`) shows a
copy-to-clipboard **user id** for cross-referencing.

**Sales** (`/admin/sales`): a minimal sale-price manager (`features/admin/sales/`) — **not** a full
catalog CRUD. `useAdminProducts` (`GET /admin/products`) lists every product (incl. archived); a
client-side name search filters the (unpaginated, small) catalog. Each row shows base + current sale
price and an integer-cents input with **Save** / **Clear** → `useSetProductSale` (`PATCH
/admin/products/:id { salePriceCents }`, number sets / `null` clears). The backend re-validates
`sale < base` and the 400 message surfaces via a toast. The sale itself is applied at checkout by the
backend (ARCHITECTURE.md §4.11); this page is only the input surface.

**Categories** (`/admin/categories`): a full catalog-category manager (`features/admin/categories/`).
`useAdminCategories` (`GET /admin/categories`) lists every category (incl. archived) with active
product/sub-category **counts**, rendered as an **indented tree** (depth from the `parentId` chain) with a
client-side name/slug search. Each row has an **inline `sizeSystem` `<select>`** (PATCH on change — the
quick path to drive the size suggestion, §14) and **Archive/Restore** (the archive confirm **warns** the
counts it would hide; archive is a reversible soft-hide, never a delete). **New/Edit** open a right-side
**Sheet** (`category-form.tsx`, RHF+zod) with a **parent `<select>`** (self + descendants excluded to avoid
a cycle; the backend re-guards) and the `sizeSystem` picker. Any change invalidates `['admin','categories']`
+ `['size-suggestion']`. This wired **Categories** tab replaces the old "Catalog" placeholder.

## 11. Vouchers at checkout (Phase 4)

The storefront voucher lives inline in the checkout order summary (`features/voucher/` +
`features/checkout/components/checkout-view.tsx`) — no new route. A code input + **Apply** calls
`POST /vouchers/preview` (`useVoucherPreview`), which validates against the user's **live server cart**
and returns the discount; the summary then shows `subtotal / discount −X / total`, the applied voucher's
**title by locale** (fallback its code) and a **Remove** action. Placing the order passes the
`voucherCode` to `POST /orders`; the **backend re-validates + redeems** it (the preview is non-binding —
the discounted total is the backend's, ARCHITECTURE.md §4.10). A structured voucher error (`code` →
i18n message: not found / expired / min-order / used-up / user-limit / not-available) is rendered
distinctly from the out-of-stock 409 and a generic payment error, both at preview time and if the voucher
becomes invalid between preview and place-order. The customer **wallet** UI now ships at
`/account/vouchers` (§13). All strings go through the `voucher` (storefront) + `admin` (admin)
next-intl namespaces (vi/en).

## 12. Product discounts — storefront display (Phase 4)

The sale is computed on the **backend** (the effective price, ARCHITECTURE.md §4.11); the frontend
only renders it. The display is **sale-aware everywhere a price shows**:

- **Product card** (`features/product/components/product-card.tsx`) — shipped in Phase 1: `salePriceCents`
  vs struck-through `basePriceCents` + a red "Sale" badge.
- **Product detail** (`product-detail-view.tsx`) — now mirrors the backend rule: the shown price is
  `salePriceCents < variant.priceCents ? salePriceCents : variant.priceCents` (per selected variant, or
  the lowest across variants for the `From …` label), with the pre-sale price struck through + the badge
  when discounted.
- **Cart** (`cart-view.tsx`) — shows the backend's `unitPriceCents` (already the effective price) and
  strikes through `compareAtCents` (the pre-sale unit price, `null` when not on sale) sent on each cart
  line. No client-side price math.

The "Sale" badge label lives in the `product` + `Products` next-intl namespaces (vi/en).

## 13. Account section & wallet (Phase 4)

The customer's "my" pages live under a single `/account` route group inside `(storefront)`
(a URL-transparent group → a real `/account` URL segment):

- **Orders moved** `/orders/*` → `/account/orders/*` (`page` · `[id]` · `[id]/pay` ·
  `[id]/confirmation`, plain `git mv` of the thin route wrappers). Every customer reference was
  repointed: the locale-aware `Link`/`router` calls in `features/order/*` + `features/checkout`,
  the notification-bell deep-link (§9), the header "My orders" item, and — critically — the Stripe
  `confirmPayment` **`return_url`** in `order-payment.tsx` (the one absolute URL that hardcodes the
  `/${locale}` prefix → now `…/account/orders/[id]/confirmation`). Admin `/admin/orders` is a
  **different** route group and is unchanged.
- **Wallet** `/account/vouchers` (`features/voucher/hooks/use-wallet-vouchers` +
  `components/wallet-view.tsx`): an auth-gated `useQuery(['wallet-vouchers'])` (mirror of
  `useNotifications`, gated on the auth store, **no polling**) reads `GET /me/vouchers` and renders
  each grant as a card — locale title (fallback `code`), discount (PERCENT `value%` / FIXED money via
  `formatPriceCents`), min-order / max-discount / valid-until, the per-user **uses-left**
  (`perUserLimit − userUsedCount`, "Unlimited" when uncapped), and a **copy-code** button (mirror of
  the admin `CopyableId` — inline 1.5s feedback, swallows insecure-context clipboard failures).
  The **valid-until** deadline shows `deadline = v.expiresAt ?? v.validTo`: the per-user `expiresAt`
  (e.g. the birthday voucher = grant + 30d, backend §4.14) takes precedence over the voucher's own
  `validTo`. No "expired" badge — the backend already hides a grant once its `expiresAt` is past (mirrors
  `validTo`), so any shown deadline is still in the future. Read-only — applying a voucher still happens
  at checkout (§11).
- **Profile** `/account/profile` (`features/profile/`): an auth-gated `useProfile` (`GET /me/profile`)
  feeds an RHF+zod form (`profile-form.tsx`) — a **birthday** (native `<input type="date">`, `max`=today,
  round-tripped `YYYY-MM-DD` ↔ the backend ISO `DateTime`) + height/weight + body measurements
  (chest/waist/hip/footLength, all optional) saved via `PATCH /me/profile` (`useUpdateProfile` invalidates
  `['profile']` + `['size-suggestion']`). Measurements power the size suggestion (§14); the birthday powers
  the birthday-voucher cron (backend §4.14) — it's stored on `iam.User`, surfaced through the same
  `/me/profile` endpoint.
- **Landing** `/account` — a minimal index linking Orders + Vouchers + Profile.
- **Gate:** `middleware.ts` `PROTECTED` now matches `/account` (replacing `/orders`) so the whole
  `/account/*` subtree requires a session (guests → login).
- **i18n / header:** new `wallet` + `account` next-intl namespaces (vi/en); the header's "Vouchers"
  dropdown item (previously a disabled "coming soon") now links to `/account/vouchers`. A **Profile** item
  (`nav.profile`) was added beside it.

## 14. Size suggestion on the product page (Phase 4)

The product detail page shows a **rule-based suggested size** for logged-in users — the backend computes
it (ARCHITECTURE.md §4.12); the FE only renders. `features/product/api/size-suggestion.ts` +
`hooks/use-size-suggestion.ts` (an auth-gated `useQuery(['size-suggestion', slug])` that never fires for
guests) call `GET /products/:slug/size-suggestion`. In `product-detail-view.tsx` `DetailContent` (which
now also reads `useAuthStore`), a `<SuggestedSize/>` block sits by the size selector and renders by status:
- `SUGGESTED` → "Suggested for you: {size}" (+ a `SNUG`/`PERFECT`/`LOOSE` fit note) with a button that
  calls `setSelectedSize(size)`;
- `NO_PROFILE` → "Add your measurements", linking to `/account/profile`;
- `NO_CHART` / `NO_MATCH` / guest → renders nothing.
Suggestion strings live in the `product` namespace; the profile form/page strings in a new `profile`
namespace (vi/en).

## 15. Home banners & footer (Phase 4)

Closes the last Phase 4 item. The banner image is an **external URL** (admin pastes it, no upload);
the backend owns the data (`marketing` module, ARCHITECTURE.md §4.15) and the frontend only renders.

- **Home carousel** (`features/banner/` — `api/banners.ts` + `hooks/use-banners.ts` + `components/banner-carousel.tsx`).
  A **public** `useQuery(['banners'])` (NOT auth-gated, unlike wallet/notifications — guests see banners too)
  reads `GET /banners`. `BannerCarousel` renders inside a fixed **aspect-ratio frame** so the home region
  **never collapses or jumps** across states: loading → `Skeleton`; **empty (0 banners) → a placeholder**
  (gray box + icon); one banner → static hero; many → a **hand-built carousel** (no carousel lib — `useState`
  index + ~5s autoplay `setInterval` + prev/next + dot indicators). Each slide is a plain **`<img>`** (arbitrary
  external host → `next/image` can't whitelist it; `next.config.ts` has no `images` config) with an **`onError`
  fallback** to the same placeholder, wrapped in `<a href={linkUrl}>` only when a link is set. Rendered at the
  **top of the home page** (`(storefront)/page.tsx`), above the existing welcome content.
- **Admin banners** (`/admin/banners`, `features/admin/banners/`) — mirrors the vouchers page: `useAdminBanners`
  (`GET /admin/banners`, **unpaginated** like categories/sales), New/Edit in a right-side **Sheet**
  (`banner-form.tsx`, RHF+zod: `imageUrl` required-URL, `linkUrl`/`title`/`alt`, `sortOrder` int, `isActive`
  checkbox + a **live image preview**), list rows with a thumbnail, an **inline `isActive` checkbox**
  (immediate `PATCH`), Edit + Archive (confirm). Mutations invalidate **both** `['admin','banners']` and the
  public `['banners']`, so the home updates immediately. New sidebar tab **Banners** (`NAV_ITEMS`).
- **Static footer** (`components/footer.tsx`) — FE-only, no DB. Shop name + tagline, link columns (Products →
  `/products`; About / Contact → `#` placeholders), social placeholders (generic lucide icons — the package
  dropped brand icons — `href="#"`), and a dynamic copyright year. Rendered by the **storefront layout** only
  (after `{children}`), so it never appears in the `(admin)` group.
- **i18n:** new `banner` + `footer` storefront namespaces and banner keys in the existing `admin` namespace (vi/en).

## 16. Home sections & collections (Phase 4)

Commerce-style home: a **fixed section set with admin-curated content** — **no page builder** (the layout
is in code; admins drive only what fills it). The backend owns the data + ordering (ARCHITECTURE.md §4.16);
the frontend composes the sections and renders. **Every section self-hides when empty**, so the home never
shows a blank row.

- **Home composition** (`(storefront)/page.tsx`), top→bottom: `BannerCarousel` → **`CategoryGrid`** →
  **`FeaturedCollections`** → on-sale `ProductRow` → new-arrivals `ProductRow`. The two `ProductRow`s are the
  auto rules (`useProducts({ onSale, limit })` / `({ sort:'new', limit })`); admin-featured curation sits
  above them.
- **`features/category`** (storefront) — `api/categories.ts` (`getCategories` → `GET /categories`, the public
  tree) + `use-categories` + `components/category-grid.tsx`: active top-level categories as image tiles
  (locale name) linking to `/products?category=<slug>`. `/products` now reads that `?category=` param
  **server-side** (the page passes it to `ProductsView`, which filters via `useProducts({ category })`) — no
  `useSearchParams`, so no Suspense boundary needed.
- **`features/collection`** (storefront) — `api/collections.ts` (`getFeaturedCollections` → `?featured=true`;
  `getCollection(slug)`; `getCollectionProducts(slug)`) + hooks (all public, not auth-gated).
  `FeaturedCollections` renders one carousel per featured collection (in `homeSortOrder`, the backend's
  order), each a `CollectionRow` (title = locale name, **See more** → `/collections/<slug>`, reusing the
  shared `ProductCarousel`); a featured-but-empty collection self-hides.
- **`/collections/[slug]`** (`(storefront)/collections/[slug]/page.tsx` + `collection-view.tsx`) — the
  collection name as the heading (from `useCollection`) + its products via `useCollectionProducts`, laid out
  with the shared `ProductGrid`; skeleton / empty / error states reuse the `Products` namespace.
- **Shared `ProductGrid`** (`features/product/components/product-grid.tsx`) — the responsive card grid was
  **extracted** from `ProductsView` so the product list **and** the collection page lay out identically.
  `ProductsView` keeps its own query + loading/error/empty states and just renders `<ProductGrid>` for the
  loaded grid (the `?category=` filter is unchanged).
- **Product card images** — the backend's derived `primaryImageUrl` (§4.16) gave the previously text-only
  card its cover: `ProductCard` renders it in a fixed `aspect-square` box with a plain `<img>` + `onError`
  placeholder (arbitrary external host → `next/image` can't whitelist it), so a missing/broken image never
  breaks the grid. The shared `ProductCarousel` (`components/product-carousel.tsx`) is a scroll-snap row
  reused by the home product rows and the featured-collection rows.
- **Admin Collections** (`/admin/collections`, `features/admin/collections/`) — mirrors the vouchers/
  categories admin: `useAdminCollections` (`GET /admin/collections`, unpaginated), New/Edit in a right-side
  **Sheet** (`collection-form.tsx`, RHF+zod: nameVi/En, slug, **`imageUrl` + live preview**, validFrom/To
  `datetime-local`, **`featuredOnHome`** checkbox, **`homeSortOrder`**), archive/restore, and — in edit mode —
  a **product-membership** manager (`collection-members.tsx`: lists member products resolved against the
  active product list, add via a search picker / remove, through `GET/POST/DELETE
  /admin/collections/:id/products`). Mutations invalidate `['admin','collections']` + the public
  `['collections']` so the home updates. New sidebar tab **Collections** (`NAV_ITEMS`).
- **Images = pasted URLs (no upload)** — both the category and collection cover images are external URLs the
  admin pastes (like banners §15); a broken/empty URL degrades to a placeholder. Cloudinary upload stays a
  future option.
- **i18n:** new `Home.shopByCategory` + the `carousel` namespace (prev/next) and the admin `collection*` keys
  (vi/en); the category grid + collection rows reuse `Home.seeMore`, and the collection page reuses
  `Products.empty/error` — collection/category **titles come from the data**, so no new title keys.

## 17. Admin analytics dashboard (Phase 5)

The `/admin/analytics` dashboard (`features/admin/analytics/`) reads the backend's read-only aggregation
API (ARCHITECTURE.md §4.17); the frontend only composes + renders (Recharts). It mirrors the other admin
features: `api/analytics.ts` (typed off the OpenAPI `components['schemas']`), `hooks/use-analytics.ts`
(TanStack Query, **auth-gated** `enabled: !authLoading && !!user`, `keepPreviousData` so range/limit
changes don't flash), `components/analytics-view.tsx` + `analytics-charts.tsx`, and a thin route wrapper.
The sidebar **Analytics** tab is now wired (`NAV_ITEMS` href flipped from the old `null` "coming soon").

- **Sections.** Five KPI cards (net revenue · orders · AOV · units sold · new users) → a revenue **area
  chart** → new-users **line** + orders-by-status **bar** → top-products / top-spenders **tables** →
  sales-by-category **bar** + voucher-usage **table** → a low-stock **table**. Each section owns its
  loading (`Skeleton`) / error / empty state via a shared `Panel`; charts sit in `ResponsiveContainer`.
- **Date range.** 7/30/90-day preset buttons + two native `<input type="date">` (from/to); editing a date
  drops out of the preset. Default 30 days. The low-stock panel has its own **debounced** threshold input
  (`useDebounce`). Money is formatted with `formatPriceCents` (backend sends integer cents; no client math).
- **Charts.** Recharts, **light theme only**, a small fixed accent + categorical palette in
  `analytics-charts.tsx`. Product/category names pick the locale field (`nameVi`/`nameEn`); all labels go
  through the new **`analytics`** next-intl namespace (vi/en), incl. localized order-status labels.
- **Guarded like the rest.** The page lives in the `(admin)` group (client role guard + `middleware.ts`
  session), and every `/admin/analytics/*` call is gated by the backend **RoleGuard** (401/403) — the real
  gate. `apiFetch` attaches the Supabase JWT automatically.

### Vercel Web Analytics (visitor metrics)

`<Analytics/>` from `@vercel/analytics/next` is mounted once in the root `[locale]/layout.tsx` (§7). It
renders its own client boundary (the server layout stays a server component) and is a **no-op locally** —
it only collects data when **deployed on Vercel**, where the metrics live in the Vercel dashboard,
**independent** of the DB-backed `/admin/analytics` charts. **Verify on deploy.**

## 18. Realtime chat (Phase 6)

Customer ↔ admin support chat. **Persist-first:** send/read always go through REST (Neon is the source of
truth, backend §4.18); Realtime Broadcast is only a push layer, with polling as the fallback — so the UI is
correct even if the socket never connects.

### Customer chat widget (storefront)

- **`features/chat/`** — `api/chat.ts` (`getChatThread` `GET /me/chat` · `sendChatMessage`
  `POST /me/chat/messages` · `markChatRead` `POST /me/chat/read`, types from `schema.d.ts`),
  `hooks/use-chat.ts` (`useChatThread` — auth-gated `enabled: !authLoading && !!user`, `refetchInterval:
  60_000`; `useSendChatMessage` / `useMarkChatRead` invalidate `['chat','thread']`),
  `hooks/use-chat-realtime.ts`, and `components/chat-widget.tsx`. A `stores/chat-ui.store.ts` (Zustand
  `{ isOpen, open, close, toggle }`) holds the open/closed UI state.
- **`ChatWidget`** is mounted once in the **storefront** layout (`(storefront)/layout.tsx`) — never in the
  admin shell. It **self-gates**: `if (isLoading || !user || isAdmin(role)) return null`, so it renders only
  for a logged-in **customer** (guests and admins never see it). A floating bubble (`fixed right-5 bottom-5`)
  with an unread badge opens a panel (message list + `Textarea`, Enter-to-send / Shift+Enter newline,
  `maxLength={2000}`); opening the panel marks incoming admin messages read (stable-`mutate` effect, no loop).
  `BackToTop` was moved to `bottom-5 left-5` so the two don't overlap.
- **Realtime (`useChatRealtime`)** subscribes to the customer's **private** channel `chat:user:<userId>`
  (`{ config: { private: true } }`) after `supabase.realtime.setAuth(session.access_token)`; on a `broadcast`
  `message` event it just **invalidates `['chat','thread']`** (pulls the persisted truth via REST — a missed
  / duplicate / out-of-order event is harmless, the 60s poll also covers it) and removes the channel on
  cleanup. No-op for guests. Locally (no Supabase project + RLS policy) it degrades to the poll; the RLS
  SELECT policy that authorizes the channel is a **manual Supabase deploy step** (backend §4.18).
  `providers.tsx` also re-runs `setAuth` on `onAuthStateChange` so a token refresh keeps the socket
  authorized.
- **Notification tie-in.** An admin reply raises a `CHAT_REPLY` in-app notification; the **notification bell**
  renders it via the `notification.chatReply` message and, on click, **opens the chat widget**
  (`useChatUiStore().open()`) instead of an order deep-link.

### Admin inbox (`/admin/chat`) — poll-only, no realtime

- **`features/admin/chat/`** — `api/chat.ts`
  (`getAdminConversations` `GET /admin/chat/conversations?search&page&pageSize` · `getAdminConversation` ·
  `adminReplyToConversation` · `markAdminConversationRead`), `hooks/use-admin-chat.ts` (auth-gated +
  `keepPreviousData`; `useAdminConversations` `refetchInterval: 15_000`, `useAdminConversation`
  `refetchInterval: 8_000`, mutations invalidate the conversation + list keys), and
  `components/admin-chat-view.tsx`. A thin server wrapper at `(admin)/admin/chat/page.tsx` renders it; the
  **Chat** sidebar tab is wired in the admin layout `NAV_ITEMS`.
- **Split view** `grid md:grid-cols-[20rem_1fr]` (stacks on mobile): a left **conversation list** (debounced
  search, a customer name/email cell with a `userId` fallback, `lastMessageAt`, an unread badge,
  `PaginationBar`) and a right **thread panel** (history + a `Textarea` composer; opening a conversation with
  unread marks the customer→admin messages read).
- **Poll-only by design** — no Realtime channel on the admin side. The customer still gets live updates
  because an admin reply **broadcasts server-side** (backend §4.18). There is intentionally **no per-admin
  notification** for an incoming customer message; the admin sees new activity through the polled list's
  unread count. **RolesGuard on every `/admin/chat/*` call is the real gate** (plus the `(admin)` client
  shell + `middleware.ts`), not UI-only.
