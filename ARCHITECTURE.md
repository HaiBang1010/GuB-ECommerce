# GuB — System Architecture

E-commerce web app for **shoes & clothing**. Goal: **portfolio** (learning + a piece to show),
not a real business. Hard constraint throughout: **everything deploys on free tier ($0)**.

The concrete database schema is in [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma);
this document gives the system overview, the decision log, and the data model at a conceptual level.

---

## 1. System overview

```
Browser
   │  (HTTPS)
   ▼
Frontend — Next.js App Router  ── deploy ▸ Vercel
   │  (REST API, Supabase JWT in Authorization header)
   ▼
Backend  — NestJS modular monolith ── deploy ▸ Render / Koyeb
   │
   ├─▶ Neon (Postgres)               ── database (multiSchema, one schema per module)
   ├─▶ Supabase Auth                 ── identity (backend verifies JWT)
   ├─▶ Supabase Realtime             ── user ↔ admin chat
   ├─▶ Stripe (test mode)            ── payments + webhook
   ├─▶ Upstash QStash                ── notification queue
   ├─▶ Resend                        ── transactional email
   └─▶ Supabase Storage / Cloudinary ── product images

UptimeRobot ── pings GET /health every 5 min to keep Render awake
pg_cron (Supabase) / cron-job.org ── scheduled jobs (birthday vouchers, cart cleanup)
```

**Principle:** the browser never talks directly to the DB or Stripe — everything sensitive goes through the backend.

---

## 2. Architecture decisions (decision log)

| Question | Decision | Rationale |
|---|---|---|
| Microservices? | **No — modular monolith** | On free tier, sleeping services cause cold-start that breaks inter-service calls. Modules call each other in-process. Knowing when *not* to use microservices is a senior signal. |
| Separate admin app? | **No** — same app, `/admin` route group + role guard | One repo, one auth, one deploy. |
| Delete or archive? | **Archive (soft delete) everything** | Orders reference products → no hard delete. Archive cascades (archive a category → hide child products). |
| Category vs tag? | **Category** (one primary, hierarchical `parentId`) + **Collection/Tag** (n-n) | "Running gear", "winter" are cross-category groupings. |
| Realtime chat | **Supabase Realtime**, no self-hosted Socket.IO | Render sleeps → sockets drop; Supabase stays up. |
| Order status | **Timeline + history**; `DELIVERED` unlocks review | Reviews tie to delivered orders. |
| Theme | **Light only**, no dark mode | One fewer axis to maintain. |
| Language | **VN + EN**, i18n from Phase 0 | Avoid rework; product content is bilingual. |
| Money | **Integer cents**, no float | Avoid floating-point errors. |
| Variant model | `Product → ProductVariant` (size + color, **per-variant stock**) | Same shape for shoes (42) and clothing (M); images attach by color. |
| Stock reservation timing | **Reserve-early** — decrement stock when the order is placed (`PENDING_PAYMENT`), not at payment time | Hard oversell guarantee during checkout; the hold is reclaimed if the order goes unpaid. |
| Card decline → order | **Keep the order `PENDING_PAYMENT`** (only mark `Payment` FAILED); **no** cancel-on-fail | A transient decline ≠ abandonment; the durable pay page lets the buyer retry the same order. Stock is reclaimed by the 15-min TTL job or an explicit cancel. **(Reversed an earlier immediate cancel-on-fail — do not re-introduce it.)** |
| Payment UI | **Durable pay page** `/account/orders/[id]/pay` — `clientSecret` restored from the order id | Survives refresh / tab-switch; one page shared by checkout (new order) + pay-again. (Moved from `/orders/*` in Phase 4.) |
| Out-of-stock at place-order | **Structured 409** `OutOfStockErrorDto` `{code, items:[{variantId, available}]}` | Storefront names each short item, distinct from a payment error. |
| Cancel an unpaid order | **User endpoint** `POST /orders/:id/cancel` (owner-only, 409 if not pending) | Buyer releases their own held stock without waiting for the TTL job. |
| Voucher at checkout | **One voucher / order**; validate read-only (preview) then **redeem inside the checkout transaction** (atomic `usedCount` guards); snapshot `voucherCode` + `discountCents` onto the order | Backend is the source of truth for the discount (the FE preview is non-binding); a failed/oversold order rolls the redemption back, so a voucher is never consumed by a failed order. The Stripe PaymentIntent charges the discounted `totalCents`. |
| Public vs wallet voucher | **`Voucher.isPublic`** — PUBLIC = any code holder; **WALLET-ONLY** = needs a `UserVoucher` grant (e.g. birthday). Per-user cap tracked on `UserVoucher.usedCount` | One explicit flag instead of an ambiguous convention; the per-user ledger enforces `perUserLimit` without `voucher` ever calling back into `ordering` (no cycle). |
| Product sale price | **Product-level `Product.salePriceCents`** (one sale price, flat across the product's variants); the **effective** unit price applies the sale only when **`sale < variant.priceCents`** | Reuses the existing field — **no migration, no per-variant sale row**. The guard means a sale never *raises* a variant already cheaper than the sale. Computed in `ProductVariantService` where the product rows are **already loaded for visibility** (zero extra query); cart/order read it in-process. Sale + voucher **stack**: the voucher discount is computed on the already-sale-priced subtotal. |
| Size suggestion storage | **Code-constant size charts keyed by a `Category.sizeSystem` enum** (no `SizeChart` table/CRUD) | Rule-based (no ML) suffices at this scale; standard charts rarely change, so baking them into code avoids a table + admin CRUD. The enum lives on the category, so shoes-vs-clothing is resolved at the category level — no fragile slug-guessing. |

---

## 3. Tech stack (all free tier)

**Frontend (Vercel):** Next.js App Router · TypeScript · Tailwind · shadcn/ui · react-hook-form + zod · TanStack Query · Zustand (guest cart) · next-intl (vi/en) · Recharts · Vercel Web Analytics.

**Backend (Render/Koyeb):** NestJS · Prisma · PostgreSQL · class-validator + zod · Supabase JWT verification · Postgres full-text + `pg_trgm` · OpenAPI/Swagger (`/docs`, codegen-ready).

| Concern | Service | Free-tier note |
|---|---|---|
| Frontend host | **Vercel** | root dir = `frontend/` |
| Backend host | **Render / Koyeb** | **No Railway** (no permanent free tier); root dir = `backend/` |
| Database | **Neon** (Postgres) | Permanent, scale-to-zero. **Not Render's free Postgres** (deleted after 30 days). |
| Auth | **Supabase Auth** | 50K MAU |
| Realtime chat | **Supabase Realtime** | broadcast / postgres changes |
| Queue | **Upstash QStash** | serverless, pay-per-use |
| Payments | **Stripe** | free in test mode |
| Email | **Resend** | ~3,000 emails/month |
| Images | **Supabase Storage** / **Cloudinary** | 1GB / built-in transforms |
| **Keep-alive** | **UptimeRobot** | pings `/health` every 5 min (see §6) |
| Scheduled jobs | **pg_cron** (Supabase) / cron-job.org | Render free has no cron |

---

## 4. Data model (conceptual)

Per-module ownership; full Prisma definitions in `backend/prisma/schema.prisma`. Money is
integer cents; soft delete via `archivedAt`; cross-module references are **scalar ids** (no
DB foreign keys across module boundaries).

### 4.1 Modules → owned tables

| Module / schema | Tables |
|---|---|
| `product` | `Category`, `Product`, `ProductVariant`, `ProductImage`, `Collection`, `ProductCollection` |
| `iam` (auth) | `User`, `Profile`, `Address` |
| `cart` | `Cart`, `CartItem` |
| `ordering` (order) | `Order`, `OrderItem`, `OrderStatusHistory` |
| `payment` | `Payment`, `StripeEvent` |
| `review` | `Review` |
| `notification` | `Notification` |
| `chat` | `Conversation`, `ChatMessage` |
| `voucher` | `Voucher`, `UserVoucher` |
| `activity` | `ActivityLog` |

### 4.2 Relationship map (ERD-level)

```
Category ──┐ (self-ref parentId; archive cascades to children)
           └─< Product ──< ProductVariant   (size+color, per-variant priceCents+stockQty)
                  │                          (Product.salePriceCents = product-level sale, flat)
                  │     └─< ProductImage     (url, color, position)
                  └──< ProductCollection >── Collection   (n-n; season = validFrom/To)

User ──1─ Profile          (heightCm, weightKg, measurements → size suggestion)
User ──<  Address          (book; one isDefault)

Cart ──< CartItem          (variantId scalar → product.ProductVariant)

Order ──< OrderItem        (unitPriceCents + name/size/color SNAPSHOT)
   │   └─< OrderStatusHistory  (timeline; DELIVERED unlocks review)
   ├─ shippingAddress: Json   (address snapshot, not a FK)
   └─ userId / voucherId       (scalar → iam / voucher)

Payment ─ orderId (scalar)  ·  StripeEvent  (webhook idempotency ledger)

Review ─ userId + productId + orderItemId (all scalar; orderItemId = proof of purchase)
Notification ─ userId (scalar)  ·  channel: IN_APP / EMAIL / BOTH
Conversation ──< ChatMessage  (sender USER/ADMIN)
Voucher ──< UserVoucher       (wallet; granted per user, e.g. birthday)
ActivityLog ─ userId? (scalar; audit + analytics)
```

### 4.3 Why scalar cross-module references

Real Prisma `@relation`s exist only **within** a module's schema. Across modules we store the
foreign id as a plain `String` and resolve it through the owning module's **service**, never a
cross-schema JOIN. This is the mechanism that keeps the monolith *modular*: boundaries are
enforced at the data layer, so a future extraction into a separate service stays cheap.

### 4.4 Snapshots (immutability of historical records)

The live catalog changes; historical records must not. So:
- `OrderItem.unitPriceCents` + `productNameVi/En` + `size`/`color` are captured at purchase. `unitPriceCents` is the **effective** price (the sale price when on sale, else the variant price), so an order keeps its sale price after the sale ends.
- `Order.shippingAddress` is a JSON copy, and the voucher is snapshotted (`voucherCode`, `discountCents`).
Re-printing an old invoice always shows the original values.

---

## 5. Cross-cutting problems to solve (easy to miss)

1. **Stock race condition** — two buyers, last pair. Decrement **atomically** (`UPDATE … WHERE stockQty >= n`) or use a time-boxed reservation released on expiry.
2. **Guest-cart merge on login** — guests browse + add to cart first, log in only at checkout. Persist the guest cart (Zustand/localStorage), then **merge** into the user cart (sum quantities, dedupe variants).
3. **Price snapshot at order time** — store the **effective `unitPriceCents`** (the sale price when on sale, else the variant price); never reference the live price.
4. **Supabase Auth ↔ User sync** — upsert `User`/`Profile` on first login (in the JWT guard).
5. **Idempotent Stripe webhook** — verify signature, record `event_id` in `StripeEvent`; the backend may be asleep → Stripe retries, duplicates must be no-ops.
6. **Release held stock on cancellation or TTL expiry** — don't leak inventory. A single card decline does **not** release immediately: the order stays `PENDING_PAYMENT` so the buyer can retry; the 15-min `release-expired` job (or an explicit user/admin cancel) reclaims the stock.
7. **Cron on free tier** — see §6 (pg_cron / secured admin endpoint).
8. **Bilingual content entry** — `nameVi`/`nameEn`; admin form has two fields per content field.
9. **Visitors ≠ order data** — count visitors via Vercel Web Analytics; log user activity to `ActivityLog`.
10. **RBAC** — enforce admin endpoints in the backend, not just by hiding UI.
11. **Image optimization** — resize/compress/webp on upload (1GB free storage).
12. **Review/chat spam** — rate-limit writes.
13. **Order cancellation / refund** — at minimum allow cancel-before-ship + stock release; refund via Stripe if implemented.
14. **Backup** — Neon free has limited history; export periodically if needed.

---

## 6. Keep-alive & cron on free tier

Render free **sleeps after 15 min** idle (cold start ~50s).
- **Keep-alive → UptimeRobot**: an HTTP(s) monitor on `https://<backend>/health`, interval **5 min** (free-tier minimum, safely under 15). `/health` is lightweight and does **not** query the DB. Advantages over the old GitHub Actions cron: not tied to a public repo, not disabled after 60 idle days, no Actions minutes consumed.
- **Scheduled jobs** (stock-reservation expiry + birthday vouchers now; abandoned-cart cleanup later): the DB is **Neon, which has no `pg_cron`** (Supabase is Auth-only here), so the pg_cron-in-DB option does **not** apply — the scheduler must be **external**. **UptimeRobot → `POST /admin/jobs/*`** with a secret header (the `AdminGuard` `x-admin-secret` = `ADMIN_API_SECRET`). Phase 2 ships `POST /admin/jobs/release-expired`, which UptimeRobot calls **~every 5 min** to cancel unpaid orders past their TTL and release their stock; Phase 4 adds `POST /admin/jobs/grant-birthday-vouchers`, called **~daily** to drop the year-coded `BIRTHDAY-<year>` voucher (with a fair per-user `expiresAt = grant + 30d`) into the wallets of users whose birthday is in the **last 7 days** (the window means a missed daily run still catches it). All jobs must be **idempotent** (the birthday job via the `UserVoucher` unique constraint, which also never overwrites an existing grant's `expiresAt`).

Render free **750 instance-hours/month** → only enough to keep **one** service awake 24/7 (another reason for the monolith).

---

## 7. Phases

Principle: **get the purchase flow (Phase 0→2) working first**, layer engagement after. Every phase is deployable.

0. **Foundation** — **DONE** (CI skipped on purpose · deploy deferred). monorepo (npm workspaces), NestJS + Next.js skeleton, `GET /health`, Prisma **init migration applied on local Postgres (Docker)**, i18n (vi/en) scaffold. Deferred for later: Neon, Supabase Auth (→ Phase 2), keep-alive (UptimeRobot), and the "hello world" deploy.
1. **Catalog** — **DONE.** **Category · Product · ProductVariant · Collection · ProductImage** slices — admin CRUD + cascade/season-window archive, storefront reads, size×color variant matrix (per-variant `stockQty` + unique `sku`), n-n Collection membership with season window, by-color images via **Cloudinary signed direct upload** (delivery-time URL transforms, no backend image processing), and **full-text + fuzzy search** — generated `search_tsv` via a `simple`+`unaccent` text-search config (`product.gub_vn`), GIN index + `pg_trgm` typo tolerance, accent-insensitive `searchActive` on `GET /products?search=`. Temporary AdminGuard; jest specs throughout (incl. a DB-backed search integration spec). Cross-slice validation goes through in-process service calls (no cross-table queries). (No login required.)
2. **Cart + Auth + Checkout** *(hardest)* — **DONE**: backend verified end-to-end with Stripe test mode (idempotency + oversell proven via real requests) **and** the storefront purchase-flow frontend built across slices 0–10. Deploy + UptimeRobot cron wiring deferred.
   **Backend** (unit-tested + DI boot smoke test): Supabase JWT auth + first-login `User`/`Profile` upsert, real `RoleGuard` (catalog admin re-gated), address book, server-side cart (guest `sessionId` + user) with merge-on-login, checkout with **atomic stock decrement** + release, Stripe PaymentIntent + idempotent webhook (`StripeEvent` ledger), admin order-status timeline, the `release-expired` job endpoint, and **OpenAPI/Swagger docs at `GET /docs`** (codegen-ready via `/docs-json`). **Verified e2e** (real Supabase project + Stripe test mode): cart → order → atomic reservation (5→4) → PaymentIntent → confirm (`pm_card_visa`) → webhook → `PAID`; re-sent `succeeded` is a no-op (idempotent ledger, no duplicated timeline, stock unchanged); `quantity > stock` blocked, stock never negative; `RoleGuard` CUSTOMER→403 / ADMIN→200.
   **Backend hardening (later slices):** the **`payment_intent.payment_failed`** webhook marks the Payment FAILED but **keeps the order `PENDING_PAYMENT`** so the buyer can retry (stock reclaimed by the TTL job or an explicit cancel — *no* immediate cancel-on-fail; see §2 + backend §4.2); place-order returns a structured out-of-stock **409 `OutOfStockErrorDto`** (`{code, items:[{variantId, available}]}`); and a **user cancel** endpoint (`POST /orders/:id/cancel`, owner-only, 409 if not pending) shares one idempotent release core with the TTL job (backend §4.4).
   **Frontend (slices 0–10, gate = typecheck + lint + build):** infra (TanStack Query, shadcn/ui, typed API client + committed OpenAPI types, Zustand, RHF+zod); storefront product grid + detail; Supabase auth (email+password + magic link); server cart with guest merge-on-login + **cart stock-sync** (auto-cap over-stock, block checkout on a 0-stock line); checkout; a **durable Stripe payment page** `/orders/[id]/pay` that restores the `clientSecret` so refresh/tab-switch survive (shared by new-order + pay-again) and lets a buyer **retry after a decline on the same order**; active order cancel; my-orders list + detail + timeline. Light theme, i18n vi/en throughout, out-of-stock distinguished from payment errors.
   **Remaining / deferred:** deploy (Render/Vercel) not done; `release-expired` cron not yet wired on UptimeRobot (endpoint only triggered manually); admin storefront UI lands Phase 3+. **Deferred to Phase 4:** refund / admin-cancel of a PAID order.
3. **Post-purchase** — **DONE** (reviews · notifications · admin foundation; verified locally, deploy deferred). Order timeline already shipped in Phase 2.
   **Reviews backend — DONE** (slices R1–R4; gate = typecheck + lint + jest, full suite 216 tests green). Purchased-only: `POST /reviews` accepts a review only for an **owned, DELIVERED** order item — proof of purchase is verified in-process via `OrderService.getDeliveredOrderItemForUser` (**404** not owned/found, **409** not delivered), `productId` is taken from the order-item **snapshot** (never the client), and one review per `(user, product)` + per `orderItemId` is enforced (pre-check **409** with a Prisma **P2002** unique backstop). Owner edit `PATCH /reviews/:id`; public `GET /products/:productId/reviews` (reviews + rating aggregate, null average when none); admin reply `POST /admin/reviews/:id/reply` (RoleGuard ADMIN). A hand-written migration adds the `rating` **1..5 CHECK** (init scaffolded it as plain `INTEGER`). **Rate-limiting on review writes is deferred** — `@@unique([userId,productId])` + the DELIVERED gate already make create near-unspammable (TODO `@nestjs/throttler`, backend §8).
   **Reviews frontend — DONE** (slices F1–F3; gate = typecheck + lint + build). Storefront UI: a delivered order's detail page shows a **write/edit** review block **per distinct product** (backend allows one review per product; existing review detected by matching the user id against the product's public review list — the order payload has no review back-reference); the product detail page shows a **rating summary + review list** with a "Verified buyer" badge (the contract exposes only `userId`, no name) and a "Store reply" block when `adminReply` is set. Interactive star-rating (`components/star-rating.tsx`, lucide only) + a net-new `ui/textarea.tsx`; typed via regenerated `schema.d.ts`; i18n `reviews` namespace (vi/en).
   **Notifications — DONE** (slices N1–N3; the system's single async path). On a status change the order module publishes `{ orderId, userId, status }` **post-commit** (best-effort, never breaks the order flow) → **Upstash QStash** → a signature-verified, idempotent consumer `POST /notifications/consume` creates an in-app `Notification` and sends a **Resend** email (channel BOTH) for **PAID / SHIPPED / DELIVERED**. Idempotency: a `notification.QStashEvent` ledger keyed on the deterministic `"<orderId>:<status>"` dedup id (insert-first → **P2002** no-op), so a QStash redelivery or a double-emit collapses to one notification. The event carries `userId`, so the consumer needs no `OrderService` → no module cycle. **Degrades gracefully:** with no QStash/Resend env (local dev) the publisher handles the event **in-process** (in-app notification still appears) and email is skipped; QStash publish + Resend send use the **REST API via `fetch`** and the consumer verifies the `Upstash-Signature` JWT with `jose` — no `@upstash/qstash`/`resend` SDK (sidesteps the ESM/CJS risk). Notifications store **structured `payload`** (`{ orderId }`) + `type`, never localized strings; the frontend **bell + dropdown** (`components/notification-bell.tsx`) renders text via the `notification` i18n namespace and links to `/orders/[id]`. New env (all optional locally): `QSTASH_TOKEN` · `QSTASH_CURRENT/NEXT_SIGNING_KEY` · `QSTASH_CONSUMER_URL` · `RESEND_API_KEY` · `RESEND_FROM` · `APP_PUBLIC_URL`. **Not realtime:** the bell refetches (polls ~60s) — realtime is deferred to **Phase 6** (alongside Supabase Realtime for chat).
   **Admin — DONE** (foundation + orders/users/reviews management). A single `/admin` **route group** (`(admin)` vs `(storefront)`, URL-transparent so customer URLs are unchanged) with a client shell whose role comes from **`GET /me`** (reads `iam.User.role` from the DB — **no** Supabase-metadata sync), gated for real by `middleware.ts` (session required) + the backend **`RoleGuard`** (403 for non-admins). **Admin orders** (`GET /admin/orders`): customer info **enriched in-process via `UserService`** (no cross-schema JOIN, §4.3), a **multi-status filter**, a **unified search** (order id / customer name / email), and **server-side pagination** (`page`/`pageSize` + `total`). Also shipped: an **order-detail dialog** (`GET /admin/orders/:id`); an **admin users** list + **user-detail page** (`GET /admin/users` · `GET /admin/users/:id` — order stats + recent orders composed **in-process via `OrderService`**, total-spent counting only PAID/PROCESSING/SHIPPED/DELIVERED, no cross-schema JOIN); and an **admin reviews list-all** page (`GET /admin/reviews`, filter by reply state) — **review reply** (`POST /admin/reviews/:id/reply`) is available both there and inline on the product page.
   **Remaining / deferred:** **deploy** (Render/Vercel/Neon) not done — the DB is still local Postgres (Docker); **UptimeRobot keep-alive + the `release-expired` cron are not wired** (the endpoint is only triggered manually); **full QStash→email e2e** needs a public consumer URL + real keys (deferred with deploy — the in-process degrade proves the logic locally); **notification realtime** is deferred to **Phase 6**.
4. **Promotions & personalization** — *(in progress)*.
   **Vouchers — DONE** (validate/apply at checkout · admin CRUD · wallet · grant-by-email; verified locally, deploy deferred). `Voucher`/`UserVoucher` own the `voucher` schema; the order module calls `VoucherService` **in-process** (no cross-schema JOIN). `validate(code, userId, subtotalCents)` is read-only — backing both `POST /vouchers/preview` and the pre-transaction check at place-order; `redeem(tx, …)` runs **inside the same transaction as the atomic stock decrement**, with atomic guarded increments on `Voucher.usedCount` (global cap) and `UserVoucher.usedCount` (per-user cap), so a failed/oversold order rolls the redemption back — a voucher is never consumed by a failed order. The discount is **snapshotted** onto the order (`voucherCode` + `discountCents`; `total = subtotal − discount`) and the Stripe PaymentIntent charges that discounted `totalCents` (regression-tested). **PUBLIC vs WALLET-ONLY** via `Voucher.isPublic`: wallet-only vouchers require a `UserVoucher` grant — admin **grant-by-email** (`POST /admin/vouchers/:id/grant`, list via `GET /admin/vouchers/:id/grants`, email enriched in-process, no JOIN). Vouchers carry optional **bilingual title/description** (`titleVi/En`, `descriptionVi/En`). Frontend: a checkout voucher input (preview discount → place with `voucherCode`, structured per-code error messages), an `/admin/vouchers` page (paginated list + a right-side **Sheet** create/edit form + a grant panel shown only for wallet-only vouchers) and the **Vouchers** sidebar tab. i18n vi/en throughout. **Product discounts — DONE** (sale price applied at checkout · admin set sale; verified locally, deploy deferred). A product carries one product-level `salePriceCents` (null = not on sale); the **effective** unit price is `sale < variant.priceCents ? sale : variant.priceCents`, computed in `ProductVariantService.getPurchasableByIds` by reusing the product rows already loaded for the visibility check (**zero extra query**). The cart reads it via `ProductVariantService` **in-process** (no JOIN) — exposing `unitPriceCents` plus a display-only `compareAtCents` (the pre-sale price to strike through) — and the order **snapshots that effective price** (immutable, §4.4), so a past order keeps its sale price after the sale ends. **This fixed a money bug:** the sale was previously displayed but checkout charged the base variant price; now cart / order / snapshot use the effective price consistently (regression-tested). **Sale + voucher stack** — the voucher discount is computed on the already-sale-priced subtotal (sale at item level first, voucher at order level second). Admin sets/clears the sale **inline on `/admin/sales`** (`PATCH /admin/products/:id`, backend re-validates `sale < base`); the storefront product card (Phase 1), product-detail, and cart all render the sale-aware price (struck-through original + "Sale" badge). **Account & wallet — DONE** (frontend-only; verified via typecheck/lint/build, deploy deferred). The customer "my" pages are gathered under an `/account` route group: customer orders **moved** `/orders/*` → `/account/orders/*` (every internal link + the Stripe `return_url` repointed; admin `/admin/orders` unchanged), a **customer wallet** at `/account/vouchers` renders the user's still-usable grants from `GET /me/vouchers` (title/discount/conditions/per-user uses-left + copy-code), and a minimal `/account` landing (Orders + Vouchers, room for Profile); `/account/*` is session-gated in `middleware.ts` (frontend §13). **Profile & size suggestion — DONE** (rule-based, no ML; verified locally). The customer edits height/weight/body-measurements at `/account/profile` (`GET`/`PATCH /me/profile`, owner-only); product pages show a **suggested size** (`GET /products/:slug/size-suggestion`, auth) from `SizeSuggestionService` — it reads the product category's new **`Category.sizeSystem`** enum (`ALPHA_TOPS`/`ALPHA_BOTTOMS`/`EU_SHOES`) to pick a **code-constant** size chart, matches the user's measurement, and returns a size + fit or a structured `NO_PROFILE`/`NO_CHART`/`NO_MATCH` status. Composed in-process (measurements via the global `ProfileService`, no JOIN); shoes-vs-clothing is resolved at the **category** level, not by slug-guessing (backend §4.12). **Admin catalog (categories) — DONE**: a `/admin/categories` page wires the pre-existing admin CRUD (create/edit/archive/restore, parent hierarchy, **inline `sizeSystem`**), with active product/sub-category **counts** surfaced for an archive warning (archive = reversible hide via cascade-at-read — never orphans products); the header user menu now links **Profile**. **Refund of a PAID order — DONE** (closes the Phase 2 debt; verified locally via tests, deploy deferred). Admin full-refund at `POST /admin/orders/:id/refund` (RoleGuard ADMIN): issues an idempotency-keyed **Stripe refund**, marks the `Payment` + `Order` **REFUNDED**, **conditionally returns stock** — only `PAID`/`PROCESSING`, where the goods are still in the warehouse, **not** `SHIPPED` (releasing would phantom-oversell; a physical return is a separate future flow) — appends a timeline entry and emits an `ORDER_REFUNDED` notification. `DELIVERED`/`CANCELLED`/`PENDING_PAYMENT` → **409** (refund-after-delivery is a separate return flow). Orchestrated in `PaymentService.refundOrder` and delegated to `OrderService.markRefunded` (the `cancelAndReleaseTx` guarded-flip idempotency pattern); the route lives in the **payment** module so `order` never imports `payment` — no dependency cycle. Full refund only (no partial — a separate slice if ever needed). Frontend: a destructive **Refund** button on the admin order-detail dialog (status-gated, `window.confirm`). **Birthday-voucher cron — DONE** (verified locally incl. a live idempotency check, deploy deferred). `birthday` (already on `iam.User`) becomes user-editable at `/account/profile` (`/me/profile` exposes it via a controller compose of `ProfileService` + `UserService`; not-future validated); a secured cron `POST /admin/jobs/grant-birthday-vouchers` (`AdminGuard` `x-admin-secret`, machine-to-machine — mirrors `release-expired`, §6) grants the year-coded **`BIRTHDAY-<year>`** voucher (admin pre-creates it) to every user whose **day+month (UTC)** birthday falls in the **last 7 days** (a window so a single missed daily run still catches it; a **Feb 29** birthday is observed on **Mar 1** in non-leap years). **Idempotent without extra logic** — it rides the existing `UserVoucher @@unique([userId, voucherId])`: a re-run hits P2002 (counted `skipped`, never duplicated = one grant/user/year), and next year's `BIRTHDAY-<year+1>` is a fresh grant. **Fair per-user deadline:** each grant sets `UserVoucher.expiresAt = now + 30d` (measured from when the user receives it, not a single shared `validTo` that would favour early-in-the-year birthdays); the idempotent re-run never overwrites it. `validate` enforces it (`VOUCHER_EXPIRED` when past — in addition to the voucher's own window) and the wallet hides + carries it (FE shows `expiresAt ?? validTo`). Best-effort per user (a failure is logged + skipped, never aborts the run); returns `{ granted, skipped, total }`. Composed in-process (the iam birthday query lives in `UserService`; voucher never touches the iam schema). Granted vouchers show in the existing `/account/vouchers` wallet (backend §4.14). **Deferred (later Phase 4):** home banners.
5. **Admin analytics** — revenue charts (month/quarter/year), new users, top spenders, visitors, user-activity line chart.
6. **Realtime chat** — user ↔ admin via Supabase Realtime, history + offline notification.
7. **Polish** — complete VN/EN translations, product-page SEO (SSR/SSG), image optimization, UI polish.

---

## 8. Free-tier lessons learned

- Neon/Supabase keep free DBs **forever**; Render's free Postgres is **deleted after 30 days** → always use Neon, backend just points `DATABASE_URL` at it.
- UptimeRobot free: up to 50 monitors, 5-min minimum interval — enough for keep-alive.
- `pg_cron` runs inside Supabase, so it's independent of Render's awake/asleep state.
- Search/filter: Postgres full-text + `pg_trgm` (fuzzy match) is enough at this scale, $0.
- Size suggestion: rule-based from a size chart + user measurements — ML would be overkill.

> Every decision preserves the $0 constraint. Later upgrades (Render Starter $7 to stop sleeping, paid Cloudinary, …) are optional, not required to run.