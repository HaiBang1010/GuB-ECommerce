# GuB Backend — Architecture

NestJS **modular monolith** on Render/Koyeb. One deploy, many in-process modules.
For the system-wide picture see [`../ARCHITECTURE.md`](../ARCHITECTURE.md). The concrete
data model lives in [`prisma/schema.prisma`](./prisma/schema.prisma) and is documented in §5.

---

## 1. Core principles

- **One deploy, many modules.** Modules talk through **service interfaces**, called **in-process** — never over the network internally.
- **Schema-per-module.** Each module owns one Postgres schema (`product`, `ordering`, `payment`, …). **No cross-schema JOINs.** When a module needs another module's data, it calls that module's service.
- **Cross-module references are scalar IDs only.** A Prisma `@relation` exists only *within* a single module's schema. Across modules we store the foreign id as a plain `String` (e.g. `Order.userId`) and enforce integrity in application code. This is what keeps module boundaries real instead of degrading into a shared DB.
- **One async path:** `order` publishes an event to Upstash QStash → `notification` consumes it. Everything else is synchronous in-process.
- **Controllers orchestrate, services own business logic.** Controllers only validate DTOs and delegate.

## 2. Modules

```
src/modules/
├── iam/           Supabase JWT guards, User/Profile upsert, RoleGuard, addresses → schema: iam
├── product/       Category, Product, Variant, Image, Collection/Tag, search      → schema: product
├── cart/          Cart/CartItem, guest-cart merge                                → schema: cart
├── order/         Order, OrderItem, OrderStatusHistory, stock reserve/release    → schema: ordering
├── payment/       Stripe PaymentIntent + idempotent webhook, StripeEvent ledger  → schema: payment
├── notification/  queue consumer → in-app + email (Resend)                       → schema: notification
├── review/        review tied to orderItemId, admin reply                        → schema: review
├── chat/          Conversation/ChatMessage, push via Supabase Realtime           → schema: chat
└── voucher/       Voucher, UserVoucher (wallet), apply at checkout               → schema: voucher
                   ActivityLog (audit / analytics)                                → schema: activity
```

Each module folder: `*.module.ts · *.controller.ts · *.service.ts · dto/ · *.service.spec.ts`.
A module with several entities groups them in **per-entity subfolders** with one `*.module.ts`
aggregator — e.g. `product/category/{category.service.ts, category.controller.ts,
category-admin.controller.ts, category.service.spec.ts, dto/}`. The aggregator **exports** each
service so sibling modules call it in-process (never touching another module's tables).

### 2.1 Product module — cross-slice service API

The catalog slices (`category · product · variant · collection · image`) share the **same**
`product` schema, but a slice still never queries another slice's table directly — it calls the
owning slice's service in-process. This keeps the scalar-id boundary (root §4.3) real even
*within* a module. The current cross-slice surface:

| Caller slice | Calls | For |
|---|---|---|
| product (write) | `CategoryService.assertActive(id)` | validate a product's `categoryId` |
| product (storefront) | `CategoryService.isCategoryVisible(id)` · `getVisibleCategoryIds()` | hide products under an archived category (cascade-at-read) |
| variant · image (write/sign) | `ProductService.assertExists(id)` | validate a single `productId` |
| collection (membership) | `ProductService.assertManyExist(ids)` | validate a batch of `productId`s before attaching |
| collection · image (storefront) | `ProductService.getActiveByIds(ids)` · `getActiveBySlug(slug)` | resolve active + category-visible products without touching the product table |
| variant (pricing) | `ProductService.getActiveByIds(ids)` | fold the product-level sale into each variant's **effective price** — reuses the rows already fetched for the visibility filter, so it costs **no extra query** (see §4.11) |

Each spec enforces the boundary structurally: the Prisma mock exposes **only the slice's own
delegate** (e.g. the variant spec has no `product` delegate), so a stray cross-table query throws.

## 3. Module dependency graph

```
order ──▶ product   (read price/stock, reserve & decrement stock via product.service)
order ──▶ cart      (convert cart → order, then clear cart)
order ──▶ voucher   (validate read-only, then redeem inside the checkout tx — increments usedCount)
order ──▶ iam       (admin order list: enrich customers + resolve search ids via user.service)
order ──(QStash)──▶ notification
payment ─▶ order    (createIntent reads the order; webhook markPaid; admin refund markRefunded + emit, §4.13)
voucher ─▶ cart     (preview reads the live cart subtotal server-side)
voucher ─▶ iam      (grant-by-email + wallet: resolve the user via user.service)
review ─▶ order     (verify the OrderItem belongs to user and order is DELIVERED)
chat  ──▶ (Supabase Realtime, out-of-process)
```

No dependency cycles. `payment → order` is a one-way **synchronous in-process** edge:
`payment` reads the order and transitions it (`markPaid` on the webhook, `markRefunded`
on an admin refund), but `order` **never** imports `payment` — which is exactly why the
admin refund route lives in the payment module (§4.13). `voucher` is one-way too — it
resolves users/carts via `iam`/`cart` but **never** calls `order`, so the per-user
redemption count lives on `UserVoucher` (in the `voucher` schema), not by querying
`ordering` (§4.10).

## 4. Key flows

### 4.1 Checkout (the hardest path)
1. `order.service` reads the cart and validates each line against `product.service` (active variant, enough stock).
2. **Reserve stock atomically** — see 4.3. Either decrement now inside a transaction, or create a time-boxed reservation that a cron releases on expiry.
3. **Snapshot** prices and product fields into `OrderItem` (`unitPriceCents` = the **effective** sale-aware price from the cart view, §4.11; `productNameVi/En`, `size`, `color`) and the address into `Order.shippingAddress`. Snapshot the voucher (`voucherCode`, `voucherId`, `discountCents`).
4. `payment.service` creates a Stripe PaymentIntent (`amount` = `order.totalCents`; **currency hard-locked to `usd`** — cents map 1:1 only for 2-decimal currencies, a zero-decimal one like VND/JPY would need conversion) with an `idempotencyKey`; order is `PENDING_PAYMENT`.
5. Return the `clientSecret` to the frontend; the browser confirms payment.
6. Stripe webhook `payment_intent.succeeded` → order becomes `PAID`, append `OrderStatusHistory`, emit a notification event.
7. On a card decline the order stays `PENDING_PAYMENT` for a retry; stock is released only on **order cancellation** (user/admin) or **reservation timeout** (§4.4).

> **Known gap (Phase 2):** `OrderService.createFromCart` snapshots the cart's *currently purchasable* lines and **silently skips** any line whose variant has since been archived / hidden, instead of failing the checkout. The frontend must **warn the user that an item was dropped** before they confirm. **TODO — frontend phase.**

### 4.2 Stripe webhook (must be idempotent)
- Verify the signature with `STRIPE_WEBHOOK_SECRET` (against the RAW body).
- In ONE transaction, **INSERT the event id into the `StripeEvent` ledger FIRST**, then apply the effect (Payment → SUCCEEDED, Order → PAID). The unique `id` is the idempotency guard: a duplicate delivery hits `P2002` and the whole transaction is skipped → `200` no-op. A genuine failure rolls back (event NOT recorded) and 5xx-s so Stripe retries.
- The backend may be asleep when the webhook arrives → Stripe retries; insert-first makes processing **exactly-once**.
- **`payment_intent.payment_failed`** only marks the `Payment` `FAILED` and **leaves the order `PENDING_PAYMENT`** so the buyer can retry another card on the same order. The Stripe intent stays `requires_payment_method`, and `createIntentForOrder` reuses it (re-querying a `REQUIRES_PAYMENT` **or** `FAILED` payment and `retrievePaymentIntent`-ing it) so a refresh of the durable pay page recovers the card field instead of creating a colliding new intent. Stock is reclaimed by the TTL `release-expired` job or an explicit cancel — **not** on a single decline. Idempotent via the `StripeEvent` ledger (a re-delivered failed event is a P2002 no-op). *(This deliberately reversed the earlier cancel-on-fail: a transient decline ≠ abandonment.)*
- **Verified e2e:** a re-sent `payment_intent.succeeded` left the order `PAID` once, no duplicated timeline, stock unchanged.

### 4.3 Atomic stock decrement
```sql
UPDATE product."ProductVariant"
SET    "stockQty" = "stockQty" - $qty
WHERE  "id" = $variantId AND "stockQty" >= $qty;
-- affected rows = 0  →  out of stock, abort the transaction
```
Never read-then-write in separate statements (race window). Wrap the whole checkout in one transaction.

> **Status (Phase 2): IMPLEMENTED.** Checkout decrements `stockQty` with the atomic `WHERE "stockQty" >= $qty` guard above, **inside the same transaction that creates the order** — `ProductVariantService.decrementForOrder(tx, …)` called from `OrderService.createFromCart`. It collects **every** insufficient line (not just the first) and throws a **structured 409** (`OutOfStockErrorDto`: `{ code: 'OUT_OF_STOCK', items: [{ variantId, available }] }`) so the storefront can name each short item; the whole order rolls back (no oversell, no orphaned decrement). Stock is returned by `releaseForOrder(tx, …)` on cancel / expiry (§4.4). The chosen model is **atomic decrement**, not a time-boxed reservation table — so **no schema change was needed**. **Verified e2e:** a real `quantity > stock` order was rejected and stock never went negative.

### 4.4 Stock release
Triggered by: order cancellation (user/admin) or reservation expiry (cron) — **not** a single payment decline (§4.2). Re-increment `stockQty` for each line. Make it idempotent (don't double-release).

> **Status (Phase 2): IMPLEMENTED — one shared core.** `OrderService.cancelAndReleaseTx(tx, order, note)` does the conditional `PENDING_PAYMENT → CANCELLED` flip + `releaseForOrder` + a history note, reused by both release triggers:
> - **user cancel** — `POST /orders/:id/cancel` (owner-only, idempotent on an already-cancelled order, **409** if not `PENDING_PAYMENT`, note `"Cancelled by user."`),
> - **TTL job** — `releaseExpired` (note `"Stock released."`, §6).
>
> A card decline does **not** release here — the `payment_intent.payment_failed` webhook only marks the Payment FAILED and leaves the order payable (§4.2). The conditional flip is the idempotency guard: only the caller that wins the `PENDING_PAYMENT → CANCELLED` transition restocks, so overlapping triggers (user + cron) never double-release.

### 4.5 Auth sync
`SupabaseJwtGuard` verifies the JWT. On first sight of a user id, **upsert** `User` (+ empty `Profile`). `User.id` equals the Supabase Auth UUID.

### 4.6 Product image upload (admin)
Images live on **Cloudinary** (free tier; delivery-time URL transforms replace any backend image
processing). The flow is a **signed direct upload** so file bytes never pass through the
sleep-prone backend:
1. `POST /admin/product-images/sign` → backend HMAC-signs the upload params with `CLOUDINARY_API_SECRET` (the secret stays backend-only; the browser only ever gets a per-upload signature).
2. The browser uploads the file **straight to Cloudinary** with the signed params.
3. `POST /admin/product-images` → persist `{ url (secure_url), publicId, color?, position? }`; the service rejects any `url` outside the account's Cloudinary host.

Resize / compress / webp happen at **delivery** via URL params (`f_auto,q_auto,w_`), not on upload
— this is how the "image optimization" cross-cutting concern is met at $0 with no backend CPU. On
delete: remove the Cloudinary asset by `publicId` **first**, then the row; a remote failure is
logged but the row is still removed (no stranded rows). Images attach by `color` (`null` = generic
/ shared); the storefront returns a color's images **plus** the generic ones.

### 4.7 Reviews (purchased-only) — Phase 3

A review is allowed only for an order item the caller **owns** whose order is **DELIVERED**. The
review module never queries the `ordering` tables: it calls
`OrderService.getDeliveredOrderItemForUser(userId, orderItemId)` in-process, which returns just
`{ id, productId }` (**404** when not owned/found, **409** when not yet delivered). `productId` is
taken from that order-item **snapshot**, never trusted from the client (anti-forge), and validated
via `ProductService.assertExists` (archived tolerated, so a review survives a later archive).
Uniqueness — `@@unique([userId, productId])` (one review per product per user) + unique
`orderItemId` — is pre-checked for a clean **409**, with a Prisma **P2002** catch as the race-safe
backstop. `rating` is bounded **1..5** in the DTO **and** by a hand-written CHECK constraint
(`20260625090000_add_review_rating_check`, applied with `migrate deploy`; the `init` migration
scaffolded the column as plain `INTEGER`). Surface: `POST /reviews` (create), `PATCH /reviews/:id`
(owner edit), public `GET /products/:productId/reviews` (reviews + `_avg`/`_count` aggregate, null
average when none), `POST /admin/reviews/:id/reply` (ADMIN). **Rate-limiting is deferred** — the
purchased-only + one-per-product gate already bounds review-create spam (§8).

### 4.8 Notifications (the one async path) — Phase 3

The **only** asynchronous path in the system. On an order status change the order
module publishes an event **after the transaction commits** (never inside it) and
**best-effort** — `OrderService.emitStatusEvent` swallows any failure so a queue
hiccup never breaks placing/paying/fulfilling. Producers: `updateStatus` (SHIPPED/
DELIVERED) and the payment webhook (PAID, only when `markPaid` actually flipped, and
not on the P2002 duplicate path).

```
order.service ──emitStatusEvent({orderId,userId,status})──▶ NotificationService.publishOrderStatus
   ├─ QStash configured → QStash.publish ──(HTTP + Upstash-Signature)──▶ POST /notifications/consume
   └─ not configured (local dev) → handleOrderStatusEvent IN-PROCESS  (in-app only, email skipped)
consume → verify signature (jose) → handleOrderStatusEvent → ledger insert → Notification(BOTH) → Resend email
```

- **Idempotent.** `handleOrderStatusEvent` inserts a `notification.QStashEvent` row
  **first** inside the transaction; the id is the **deterministic** dedup key
  `"<orderId>:<status>"`, so a QStash redelivery (or a double-emit) hits **P2002** and
  is a no-op — mirroring the StripeEvent ledger (§4.2). Email is sent **outside** the
  transaction (best-effort; a Resend failure won't roll back the in-app notification).
- **No cycle.** The event carries `userId`, so the consumer never calls `OrderService`
  → `NotificationModule` imports no `OrderModule` (only `OrderModule` → `NotificationModule`,
  one-way). The email address is resolved via the global `UserService.findById`.
- **Notify map.** `PAID` / `SHIPPED` / `DELIVERED` → `type` `ORDER_PAID|ORDER_SHIPPED|
  ORDER_DELIVERED`, channel BOTH. Other statuses are skipped (the producer short-circuits
  so QStash never gets a wasted message).
- **Structured, not localized.** `Notification.payload` (`{ orderId }`) + `type` are stored;
  `title`/`body` are nullable and unused for order events — the frontend renders text via
  i18n. Email subject/body are generated in English at send time, never stored.
- **No SDKs.** `QStashService` (publish + verify) and `ResendService` (send) use the
  providers' **REST APIs via `fetch`**, and the signature is a JWT verified with the
  existing `jose` dep — avoiding the ESM/CommonJS friction of `@upstash/qstash`/`resend`.
  Publish + email **degrade** (skip) when env is unset; the consumer's signature verify
  **fails closed**. The consumer route mirrors the Stripe webhook: raw body, no DTO, no
  guard, `@HttpCode(200)`, signature-or-400.
- **Env:** `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`,
  `QSTASH_CONSUMER_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `APP_PUBLIC_URL` — all optional
  locally. Full QStash→email e2e needs deployment (a public consumer URL) + real keys.

### 4.9 Admin order listing (enrich without a JOIN) — Phase 3

`GET /admin/orders` (RoleGuard ADMIN) returns a **paginated** page of orders enriched with customer
info **without ever JOINing across schemas** (§4.3). `OrderService.listForAdmin({ statuses?, search?,
page?, pageSize? })`:
- builds one `where` — status `in [...]` **AND** a search `OR` over the order id and a set of user ids;
- resolves the search term to user ids in-process via **`UserService.searchIdsByNameOrEmail(q)`** (name/
  email `contains`, capped at 200), so a customer-name/email search filters `ordering` rows by the scalar
  `userId` — never a cross-schema query;
- runs `count` + `findMany` (`skip`/`take`, `orderBy createdAt desc`) over the **same** `where`, so
  `total` is the filtered count, not the table size;
- batch-loads the page's customers with **`UserService.findManyByIds(ids)`** and attaches a
  `{ email, name } | null` `customer` to each row.

Shape: `PaginatedOrdersResponseDto { items: OrderAdminResponseDto[]; total; page; pageSize }` — **only**
the `list` route uses it; `getOne`/`updateStatus` keep `OrderResponseDto`. This is the order module's
only dependency on `iam` (§3), and it stays a service call. (Pagination query params arrive as strings —
the global `ValidationPipe` has no `enableImplicitConversion` — so the DTO `@Transform`s `page`/`pageSize`
to ints, mirroring the status-array transform.)

### 4.10 Vouchers (validate / redeem at checkout) — Phase 4

The `voucher` module owns `Voucher` + `UserVoucher` and exposes two in-process entry points the
order module calls at checkout (never a cross-schema JOIN, §4.3):

- **`validate(code, userId, subtotalCents)` — read-only.** Looks the code up (stored/looked-up
  UPPERCASE), checks the window (`validFrom`/`validTo`), `minOrderCents`, the global `usageLimit`,
  the per-user `perUserLimit` (via the `UserVoucher` ledger) and — for `isPublic === false`
  (wallet-only) — that a `UserVoucher` grant exists; then computes the discount. Failures throw a
  **structured 4xx** `{ statusCode, error, message, code, …meta }` whose `code` is a `VoucherErrorCode`
  (`VOUCHER_NOT_FOUND` · `…_EXPIRED` · `…_MIN_ORDER_NOT_MET` (+`minOrderCents`) · `…_USED_UP` ·
  `…_USER_LIMIT` · `…_NOT_AVAILABLE`), so the storefront maps each to its own i18n message — mirroring
  `OutOfStockErrorDto`. Discount math is pure integer cents: PERCENT → `floor(subtotal·value/100)`
  capped at `maxDiscountCents`, FIXED → `value`, then clamped to `≤ subtotal` (never a negative total).
  Used by both `POST /vouchers/preview` (FE preview — reads the caller's live cart subtotal via
  `CartService`, so the amount is never trusted from the client) and the pre-transaction check in
  `OrderService.createFromCart`.
- **`redeem(tx, voucher, userId)` — inside the checkout transaction.** Runs alongside the atomic stock
  decrement (§4.3) so the order + the redemption commit or roll back together — a failed/oversold order
  never consumes a voucher. Two **atomic guarded increments** (the same idiom as the stock guard): a
  global `updateMany` on `Voucher` guarded by `usedCount < usageLimit`, then a per-user `updateMany` on
  `UserVoucher` guarded by `usedCount < perUserLimit` (creating the ledger row on a PUBLIC voucher's
  first redemption; requiring an existing grant for wallet-only). The discount is **snapshotted** onto
  the order (`voucherCode` + `discountCents`; `total = subtotal − discount`) and the PaymentIntent
  charges that discounted `totalCents` (`payment.service.ts` reads `order.totalCents`, regression-tested).

**Public vs wallet-only** is the explicit `Voucher.isPublic` flag. **Admin** (`/admin/vouchers`,
RoleGuard ADMIN): paginated CRUD (archive, never hard-delete), **grant-by-email** (`POST
/admin/vouchers/:id/grant { email }` → `UserService.findByEmail`, 404 if unknown, idempotent on a repeat
grant) and **list grants** (`GET /admin/vouchers/:id/grants` — each `UserVoucher` enriched with the
grantee's email + `usedCount`/`usedAt` via `UserService.findManyByIds`, batch, no JOIN). Vouchers also
carry optional **bilingual** `titleVi/En` + `descriptionVi/En`. **Wallet:** `GET /me/vouchers` returns a
user's still-usable grants (customer wallet UI ships at frontend `/account/vouchers`, frontend §13).
**Cron** (birthday grants) is later-Phase-4 work;
**product discounts** ship in §4.11.

### 4.11 Product discounts (effective sale price) — Phase 4

A product carries one product-level `Product.salePriceCents` (null = not on sale; admin DTO validates
`sale < basePriceCents`). The price a customer is **charged** lives on the variant
(`ProductVariant.priceCents`), so the sale has to be folded in where the two meet:

- **`ProductVariantService.getPurchasableByIds`** already loads the owning `Product` rows for the
  visibility filter (via `ProductService.getActiveByIds`, §4.3). It reuses those rows to compute, per
  variant, an **`effectivePriceCents` = `sale < variant.priceCents ? sale : variant.priceCents`** — so
  the sale only ever **lowers** the price (a variant already cheaper than the sale keeps its price), at
  **zero extra query**. The method returns a `PurchasableVariant` (= `ProductVariant` + `effectivePriceCents`).
- **`CartService.buildView`** reads that field (never the product table — the cart resolves variants
  through `ProductVariantService` **in-process**, no JOIN): `unitPriceCents` = `effectivePriceCents`,
  plus a **display-only `compareAtCents`** (the pre-sale `variant.priceCents` when discounted, else
  `null`) so the storefront can strike through the original. `subtotalCents` sums the effective lines.
- **`OrderService.createFromCart` needs no change** — it already snapshots `item.unitPriceCents` from
  the cart view, which is now the effective price (immutable, §4.4 — a past order keeps its sale price).
  **Sale + voucher stack**: `validate(code, userId, subtotalCents)` runs against the sale-priced
  subtotal, so the voucher discount applies on top of the sale. **This closed a money bug** where the
  sale was shown but checkout charged the base price; cart/order/snapshot now agree
  (variant/cart/order specs cover it).

**Admin** sets/clears the sale via the existing `PATCH /admin/products/:id { salePriceCents }`
(number sets, `null` clears; RoleGuard ADMIN, re-validates `sale < base`). No new backend endpoint.

### 4.12 User profile + rule-based size suggestion — Phase 4

**Profile (iam).** The `Profile` row (1:1 with `User`, in-schema; a blank row is auto-created at first
login) gains a user-facing read/write: `GET`/`PATCH /me/profile` (`ProfileController`, `SupabaseAuthGuard`,
owner-scoped). `ProfileService.update` **upserts** keyed on `userId` (safe for rows that predate the
auto-create), writing only the provided fields; `measurements` (free-form `Json`, keys
`chest/waist/hip/footLength` in cm) is replaced wholesale when present. `UpdateProfileDto` validates
`heightCm`/`weightKg` (bounded ints) + a nested `MeasurementsDto` (positive numbers). `ProfileService` is
exported from the `@Global` IamModule so the size suggestion can read measurements in-process.

**Size suggestion (product).** `GET /products/:slug/size-suggestion` (`SupabaseAuthGuard` — reads the
caller's own measurements) → `SizeSuggestionService.suggest(slug, userId)`:
1. `ProductService.getActiveBySlug` → `categoryId`; `CategoryService.getSizeSystem(categoryId)`.
2. `sizeSystem === null` → **`NO_CHART`**. Else pick the **code-constant** chart
   (`product/size/size-charts.ts`: `SizeSystem → { measure, entries[min,max] }` in cm — `ALPHA_TOPS`→CHEST,
   `ALPHA_BOTTOMS`→WAIST, `EU_SHOES`→FOOT_LENGTH).
3. Read `ProfileService.getByUserId(userId).measurements[measureKey]`; missing → **`NO_PROFILE`** (carries
   the needed `measure` so the FE prompts for it).
4. Match the value to a size (half-open ranges so a shared boundary picks the larger size); intersect with
   the product's actual active variant sizes — offered → **`SUGGESTED`** (+ a simple `SNUG`/`PERFECT`/`LOOSE`
   fit), else **`NO_MATCH`**.

No ML (§8). Fully **in-process / no cross-schema JOIN**: product/variant/category from the own module,
measurements via the global `ProfileService`. `SizeSuggestionService` lives in `product` and injects
`ProfileService` (global) — no import cycle (`product` imports neither iam nor order).

**Category catalog admin.** `Category` gains a nullable **`SizeSystem` enum** (hand-written migration
`20260629000000_add_category_size_system` — never `migrate dev`, §5.5), settable on create + update. The
admin list `GET /admin/categories` is enriched with **active product / sub-category counts**: the controller
composes `ProductService.countActiveByCategory()` (a `groupBy`; ProductService owns the product table) with
`CategoryService.listForAdmin(counts)` (computes child counts in-memory) → `AdminCategoryResponseDto` — no
Category→Product service cycle (ProductService→CategoryService stays one-way). Archive stays **soft
(reversible hide)**: products under an archived category are hidden by the read-time cascade, never
orphaned — the counts drive a UI warning, not a block.

### 4.13 Admin refund of a captured order — Phase 4

Closes the Phase 2 debt (admin-cancel/refund of a PAID order). An admin full-refunds an order at
`POST /admin/orders/:id/refund` (RoleGuard ADMIN, `OrderStatus.REFUNDED` is full-refund — **no partial**).

- **Where it lives (no cycle).** `PaymentModule` already imports `OrderModule` (the webhook calls
  `OrderService.markPaid`), so `OrderModule` **must not** import `PaymentModule`. The refund needs Stripe,
  so the orchestration lives in **`PaymentService.refundOrder`** and the route in a payment-module
  controller (`PaymentAdminController`, declared under `admin/orders` for a RESTful/FE-consistent path).
  The order-side state change is delegated to a new **`OrderService.markRefunded(tx, …)`** — called
  in-process, mirroring `markPaid`. The dependency edge stays one-way (`payment → order`).
- **Flow.** `refundOrder` reads the order via `getForAdmin` (404 if missing); an already-`REFUNDED` order
  returns idempotently with **no** Stripe call; a non-refundable status → **409 before touching Stripe**.
  It then finds the `SUCCEEDED` `Payment`, issues the Stripe refund **first** (outside the tx,
  idempotency key `refund_<orderId>` — a retry returns the same Refund, never a second one), then in ONE
  transaction marks `Payment → REFUNDED` **and** `markRefunded(tx, orderId)`. The `ORDER_REFUNDED`
  notification is emitted **post-commit** (best-effort, §4.8).
- **`markRefunded` (the guarded flip).** Mirrors `cancelAndReleaseTx`: a conditional `updateMany`
  (`where: { id, status: <observed> }`) is the concurrency guard — only the winner flips and restocks, so
  two overlapping refunds never double-release. **Stock is returned only for `PAID`/`PROCESSING`** (goods
  still in the warehouse) via `releaseForOrder`; a **`SHIPPED`** order's goods have left, so releasing
  would phantom-oversell — a physical return is a separate future flow. Refundable set
  (`REFUNDABLE_STATUSES = [PAID, PROCESSING, SHIPPED]`) is exported from `order.service` and shared by
  `refundOrder`'s pre-check; `DELIVERED`/`CANCELLED`/`PENDING_PAYMENT` → 409.

The fulfillment `ADMIN_TRANSITIONS` map is unchanged (REFUNDED has no inbound transition via the status
route — it's driven by this refund flow, not `updateStatus`). No `charge.refunded` webhook handler: the
refund is driven synchronously and the Stripe idempotency key makes it safe; webhook reconciliation is
out of scope.

### 4.14 User birthday + birthday-voucher cron — Phase 4

Two ends of the birthday-voucher feature; the schema needed **no change** (`User.birthday DateTime?`
already existed).

**Birthday on the profile.** `birthday` lives on **`iam.User`** (not `Profile`). The customer reads/
writes it through `/me/profile` (`SupabaseAuthGuard`, owner-scoped): `UpdateProfileDto` /
`ProfileResponseDto` gain `birthday` (ISO date; `@MaxDate(() => new Date())` rejects a future date),
`UserService.setBirthday(userId, date)` writes the column, and `ProfileController` **composes** the two
iam tables — `ProfileService.getByUserId` (measurements) + `UserService.findById().birthday` — into the
response. `ProfileService` stays Profile-only, so the size suggestion's `getByUserId` is untouched; the
controller-level compose avoids any new service→service edge.

**Birthday cron.** `POST /admin/jobs/grant-birthday-vouchers` (`VoucherJobsController`, **`AdminGuard`**
`x-admin-secret` — machine-to-machine, mirrors `release-expired`, §6) grants the year's birthday voucher
to every user whose birthday is **today**. `VoucherService.grantBirthdayVouchers`:
- the "birthday voucher" is a **year-coded** voucher `code = 'BIRTHDAY-<UTC year>'` the admin pre-creates
  (no new flag, no migration); a missing/archived one → a logged `{0,0,0}` degrade;
- `UserService.findIdsWithBirthdayToday()` (iam owns the query — voucher never touches the iam schema)
  matches **day + month in UTC** (year ignored), fetching non-archived users with a birthday and
  filtering in Node;
- per user, the extracted idempotent `grantToUser(voucherId, userId)` creates the `UserVoucher` —
  **idempotency rides the existing `@@unique([userId, voucherId])`**: a repeat ping hits P2002 (counted
  `skipped`, never duplicated), so one grant per user per year, while next year's `BIRTHDAY-<year+1>` is a
  different voucher → a fresh grant. No year-check logic, no schema change;
- **best-effort per user** (a single failure is logged without PII and counted `skipped`, never aborting
  the run); returns `{ granted, skipped, total }`.

Local: trigger by hand (`curl -X POST … -H "x-admin-secret: …"`). On deploy, UptimeRobot pings it
**daily** (mirrors `release-expired`). Granted vouchers surface in the existing wallet
(`GET /me/vouchers`, `/account/vouchers`).

## 5. Data model (Prisma)

Full schema: [`prisma/schema.prisma`](./prisma/schema.prisma). It uses the `multiSchema`
preview feature; each model carries `@@schema("<module>")`.

### 5.1 Cross-cutting rules
- **Money = integer cents** (`Int`). Never float/Decimal for displayed prices.
- **Soft delete** via `archivedAt DateTime?` on every user-visible entity. Archiving a `Category` hides child `Product`s (filtered in queries), matching the "sell by season = archive pattern".
- **Snapshots** decouple historical records from live catalog: `OrderItem` snapshots price + name + size/color; `Order` snapshots the shipping address (as `Json`) and voucher.
- **Bilingual content** as two columns (`nameVi`/`nameEn`, `descriptionVi`/`descriptionEn`).
- **Reserved-word avoidance**: schema names are `ordering` (not `order`) and `iam` (not `user`/`auth`).

### 5.2 Schema → models map

| Postgres schema | Models |
|---|---|
| `product` | `Category`, `Product`, `ProductVariant`, `ProductImage`, `Collection`, `ProductCollection`, enum `SizeSystem` |
| `iam` | `User`, `Profile`, `Address`, enum `Role` |
| `cart` | `Cart`, `CartItem` |
| `ordering` | `Order`, `OrderItem`, `OrderStatusHistory`, enum `OrderStatus` |
| `payment` | `Payment`, `StripeEvent`, enum `PaymentStatus` |
| `review` | `Review` |
| `notification` | `Notification`, enum `Channel` |
| `chat` | `Conversation`, `ChatMessage`, enum `Sender` |
| `voucher` | `Voucher`, `UserVoucher`, enum `VoucherType` |
| `activity` | `ActivityLog` |

### 5.3 Relations vs. scalar references

| Edge | Kind | Why |
|---|---|---|
| `Product → ProductVariant`, `Product → ProductImage`, `Category → Category` | real `@relation` | same `product` schema |
| `Order → OrderItem → ( )`, `Order → OrderStatusHistory` | real `@relation` | same `ordering` schema |
| `Cart → CartItem` | real `@relation` | same `cart` schema |
| `Order.userId → User`, `OrderItem.variantId → ProductVariant`, `Review.productId → Product`, `Payment.orderId → Order`, `Notification.userId → User`, … | **scalar id, no relation** | crosses module boundary → resolved via service calls, integrity enforced in code |

### 5.4 Notable constraints
- `ProductVariant`: `@@unique([productId, size, color])` and unique `sku`. `stockQty` is the per-variant inventory, guarded by an **atomic decrement at checkout** (Phase 2 — see §4.3).
- `ProductImage`: unique `publicId` (Cloudinary asset id), added by migration `20260623151010_add_product_image_public_id`; the row stores both the delivery `url` and the `publicId` used to delete the remote asset. Nullable `color` ties an image to a variant color (`null` = generic).
- `Category`: self-referencing `parentId` (hierarchy; archive cascades at read time). Nullable `sizeSystem` enum (`ALPHA_TOPS`/`ALPHA_BOTTOMS`/`EU_SHOES`) drives the rule-based size suggestion (§4.12); added by the hand-written migration `20260629000000_add_category_size_system`.
- `Profile`: 1:1 `User` (`userId @unique`). `measurements Json?` (free-form `{chest,waist,hip,footLength}` cm) + `heightCm`/`weightKg`; user-edited via `PATCH /me/profile` (§4.12).
- `Review`: `@@unique([userId, productId])` (one review per product per user) + unique `orderItemId` (proof of purchase). The "order must be `DELIVERED`" rule is enforced in the service.
- `Payment`: unique `idempotencyKey` (no duplicate PaymentIntent) and unique `stripePaymentIntentId`.
- `StripeEvent.id` = the Stripe event id → webhook idempotency ledger.
- `Cart`: at most one of `userId` / `sessionId` (both `@unique`).
- `Voucher`: unique `code` (stored UPPERCASE). `isPublic` flags PUBLIC vs wallet-only; `usedCount` is the global redemption counter (atomic-guarded vs `usageLimit` at redeem, §4.10). Money fields (`value` for FIXED, `minOrderCents`, `maxDiscountCents`) are integer cents; optional bilingual `titleVi/En` + `descriptionVi/En`. `isPublic` + the title/description columns were added by hand-written migrations (`20260627000000_add_voucher_public_and_per_user_count`, `20260627120000_add_voucher_title_description`).
- `UserVoucher`: `@@unique([userId, voucherId])` — the per-user redemption **ledger** (`usedCount` enforces `perUserLimit`, `usedAt` = last redeemed). A wallet grant pre-creates a row (`usedCount = 0`); a PUBLIC redemption creates it lazily.

### 5.5 Full-text + fuzzy search
`Product` has a **generated** `search_tsv tsvector` column (weighted name=A, brand=B,
description=C) with a GIN index, plus two `pg_trgm` GIN indexes on **accent-folded** names
(`f_unaccent("nameVi"/"nameEn")`) for typo tolerance. All added by the hand-written migration
`20260623113838_add_product_search`.

- **Accent-insensitive VN search.** A custom text-search config `product.gub_vn` (`COPY = simple`
  — NO language stemming; `english` would corrupt Vietnamese — with the `unaccent` dictionary in
  its mapping) folds accents on **both** sides: the stored `tsvector` and the query
  (`websearch_to_tsquery('product.gub_vn', q)`), so `"ao thun"` finds `"Áo thun"`.
- **Why generated, not a trigger.** Pushing `unaccent` into the config's *dictionary* means the
  column expression only calls the IMMUTABLE `to_tsvector(regconfig, text)` — never the STABLE
  `unaccent()` function — so Postgres accepts a `GENERATED ALWAYS … STORED` column with no trigger.
  The IMMUTABLE wrapper `product.f_unaccent(text)` exists **only** for the trgm functional indexes
  (which must call unaccent on raw text in the index expression).
- **Service.** `ProductService.searchActive(query, categorySlug?)` runs the raw SQL (FTS OR trgm
  fallback, ranked `ts_rank` then `similarity`), re-fetches typed rows, then applies the category
  archive-cascade in-process (`getVisibleCategoryIds`) — no cross-schema join. Exposed at
  `GET /products?search=` (combinable with `?category=`). Accent/typo behaviour is covered by a
  DB-backed integration spec (`product.search.spec.ts`). No Elasticsearch/Algolia.
- **⚠ Prisma drift caveat.** The config `product.gub_vn`, the `f_unaccent` function, and the trgm/
  tsv indexes live **outside Prisma's model** (the column is declared `Unsupported("tsvector")`
  only so Prisma won't drop it). A later `prisma migrate dev` may propose `DROP`ing these objects.
  **Always apply with `prisma migrate deploy`;** if you must run `migrate dev`, delete any
  unintended `DROP` lines from the generated SQL.

## 6. Cron / scheduled jobs

Jobs: stock-reservation expiry (Phase 2, live); birthday vouchers (Phase 4, live); abandoned-cart cleanup (later).
- **The DB is Neon, which has no `pg_cron`** (Supabase is Auth-only here) → the pg_cron-in-DB option does **not** apply; scheduling is **external**.
- **UptimeRobot → `POST /admin/jobs/*`**, guarded by `AdminGuard` (`x-admin-secret` header = `ADMIN_API_SECRET`). Phase 2 ships `POST /admin/jobs/release-expired` (cancel unpaid orders past TTL + release stock); UptimeRobot calls it **~every 5 min**.
- Phase 4 adds `POST /admin/jobs/grant-birthday-vouchers` (grant the year-coded `BIRTHDAY-<year>` voucher to today's birthday users, §4.14); UptimeRobot calls it **~daily**.
- Every job must be **idempotent** (cron can fire late or twice) — `release-expired` flips status conditionally so a double-fire never double-restocks; `grant-birthday-vouchers` relies on the `UserVoucher @@unique([userId, voucherId])` constraint so a re-run never double-grants.

## 7. Health & keep-alive

`GET /health` is lightweight and **does not query the DB**. UptimeRobot pings it every 5
minutes to keep the Render instance awake. (Keep-alive is UptimeRobot, **not** GitHub Actions cron.)

## 8. Security

- All `/admin/*` endpoints are backend-enforced, not just hidden in the UI. Two guards, by caller type:
  - **Humans → `RoleGuard`** (Phase 2): `SupabaseAuthGuard` (verify JWT, upsert user) then `RolesGuard` + `@Roles(Role.ADMIN)`. Gates the catalog admin controllers and `/admin/orders`.
  - **Machines / cron → `AdminGuard`** (`common/guards/admin.guard.ts`): constant-time `x-admin-secret` vs `ADMIN_API_SECRET`, **fails closed** (500 if unset). Used for `/admin/jobs/*` (no Supabase session). **Retained on purpose — not dead code.**
- Stripe secret key, Supabase service-role key, `ADMIN_API_SECRET`, `CLOUDINARY_API_SECRET`, and `DATABASE_URL` live only in backend env — never sent to the browser. Image uploads are signed server-side so the Cloudinary secret never reaches the client (§4.6).
- Rate-limit review and chat write endpoints to mitigate spam. **(Phase 3: deferred for reviews — the purchased-only + `@@unique([userId,productId])` gate already bounds review-create spam; revisit with `@nestjs/throttler` when chat lands.)**
- Never log card data or secrets.

## 9. API documentation (OpenAPI)

- **Swagger UI** at `GET /docs`, raw document at `GET /docs-json`. Set up in
  `main.ts` after CORS + ValidationPipe; documents only — it does **not** alter
  the webhook's raw-body parsing. Gated: enabled unless `NODE_ENV==='production'`,
  or forced on with `SWAGGER_ENABLED=true` (off in prod by default; flip it for a
  portfolio demo).
- **Auth schemes:** `bearer` (Supabase JWT, most routes) + the `admin-secret`
  api-key (`x-admin-secret`, for `/admin/jobs/*`). The Authorize box drives both.
- **No `@nestjs/swagger` CLI plugin** (keeps the build unchanged) → schemas come
  from EXPLICIT decorators: controllers carry `@ApiTags`/`@ApiOperation`/
  `@ApiResponse` (`@ApiOkResponse`/`@ApiCreatedResponse` + 400/401/403/404/204);
  request DTOs carry `@ApiProperty`/`@ApiPropertyOptional` with realistic
  examples; every entity has a `*-response.dto.ts` so each endpoint returns a real
  type, never `any`. Money examples are USD cents (`1200` = $12.00).
- **Codegen-ready:** `npx openapi-typescript <…>/docs-json` yields typed clients
  (verified: 0 `any`, enums as unions). Annotate every new endpoint the same way
  so the contract stays complete.