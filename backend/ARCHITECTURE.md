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

Each spec enforces the boundary structurally: the Prisma mock exposes **only the slice's own
delegate** (e.g. the variant spec has no `product` delegate), so a stray cross-table query throws.

## 3. Module dependency graph

```
order ──▶ product   (read price/stock, reserve & decrement stock via product.service)
order ──▶ cart      (convert cart → order, then clear cart)
order ──▶ voucher   (validate + apply, increment usedCount)
order ──▶ payment   (create PaymentIntent)
order ──(QStash)──▶ notification
review ─▶ order     (verify the OrderItem belongs to user and order is DELIVERED)
chat  ──▶ (Supabase Realtime, out-of-process)
```

No dependency cycles. `payment` does **not** call `order` synchronously; the webhook
updates order state by emitting an event / calling `order.service.markPaid()`.

## 4. Key flows

### 4.1 Checkout (the hardest path)
1. `order.service` reads the cart and validates each line against `product.service` (active variant, enough stock).
2. **Reserve stock atomically** — see 4.3. Either decrement now inside a transaction, or create a time-boxed reservation that a cron releases on expiry.
3. **Snapshot** prices and product fields into `OrderItem` (`unitPriceCents`, `productNameVi/En`, `size`, `color`) and the address into `Order.shippingAddress`. Snapshot the voucher (`voucherCode`, `voucherId`, `discountCents`).
4. `payment.service` creates a Stripe PaymentIntent (`amount` = `order.totalCents`; **currency hard-locked to `usd`** — cents map 1:1 only for 2-decimal currencies, a zero-decimal one like VND/JPY would need conversion) with an `idempotencyKey`; order is `PENDING_PAYMENT`.
5. Return the `clientSecret` to the frontend; the browser confirms payment.
6. Stripe webhook `payment_intent.succeeded` → order becomes `PAID`, append `OrderStatusHistory`, emit a notification event.
7. On payment failure / reservation timeout → **release stock** (4.4).

> **Known gap (Phase 2):** `OrderService.createFromCart` snapshots the cart's *currently purchasable* lines and **silently skips** any line whose variant has since been archived / hidden, instead of failing the checkout. The frontend must **warn the user that an item was dropped** before they confirm. **TODO — frontend phase.**

### 4.2 Stripe webhook (must be idempotent)
- Verify the signature with `STRIPE_WEBHOOK_SECRET` (against the RAW body).
- In ONE transaction, **INSERT the event id into the `StripeEvent` ledger FIRST**, then apply the effect (Payment → SUCCEEDED, Order → PAID). The unique `id` is the idempotency guard: a duplicate delivery hits `P2002` and the whole transaction is skipped → `200` no-op. A genuine failure rolls back (event NOT recorded) and 5xx-s so Stripe retries.
- The backend may be asleep when the webhook arrives → Stripe retries; insert-first makes processing **exactly-once**.
- **Verified e2e:** a re-sent `payment_intent.succeeded` left the order `PAID` once, no duplicated timeline, stock unchanged.

### 4.3 Atomic stock decrement
```sql
UPDATE product."ProductVariant"
SET    "stockQty" = "stockQty" - $qty
WHERE  "id" = $variantId AND "stockQty" >= $qty;
-- affected rows = 0  →  out of stock, abort the transaction
```
Never read-then-write in separate statements (race window). Wrap the whole checkout in one transaction.

> **Status (Phase 2): IMPLEMENTED.** Checkout decrements `stockQty` with the atomic `WHERE "stockQty" >= $qty` guard above, **inside the same transaction that creates the order** — `ProductVariantService.decrementForOrder(tx, …)` called from `OrderService.createFromCart`. 0 rows matched → `ConflictException` and the whole order rolls back (no oversell, no orphaned decrement). Stock is returned by `releaseForOrder(tx, …)` on cancel / expiry (§4.4). The chosen model is **atomic decrement**, not a time-boxed reservation table — so **no schema change was needed**. **Verified e2e:** a real `quantity > stock` order was rejected and stock never went negative.

### 4.4 Stock release
Triggered by: payment failure, order cancellation, or reservation expiry (cron). Re-increment `stockQty` for each line. Make it idempotent (don't double-release).

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
| `product` | `Category`, `Product`, `ProductVariant`, `ProductImage`, `Collection`, `ProductCollection` |
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
- `Review`: `@@unique([userId, productId])` (one review per product per user) + unique `orderItemId` (proof of purchase). The "order must be `DELIVERED`" rule is enforced in the service.
- `Payment`: unique `idempotencyKey` (no duplicate PaymentIntent) and unique `stripePaymentIntentId`.
- `StripeEvent.id` = the Stripe event id → webhook idempotency ledger.
- `Cart`: at most one of `userId` / `sessionId` (both `@unique`).

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

Jobs: stock-reservation expiry (Phase 2, live); birthday vouchers, abandoned-cart cleanup (later).
- **The DB is Neon, which has no `pg_cron`** (Supabase is Auth-only here) → the pg_cron-in-DB option does **not** apply; scheduling is **external**.
- **UptimeRobot → `POST /admin/jobs/*`**, guarded by `AdminGuard` (`x-admin-secret` header = `ADMIN_API_SECRET`). Phase 2 ships `POST /admin/jobs/release-expired` (cancel unpaid orders past TTL + release stock); UptimeRobot calls it **~every 5 min**.
- Every job must be **idempotent** (cron can fire late or twice) — `release-expired` flips status conditionally so a double-fire never double-restocks.

## 7. Health & keep-alive

`GET /health` is lightweight and **does not query the DB**. UptimeRobot pings it every 5
minutes to keep the Render instance awake. (Keep-alive is UptimeRobot, **not** GitHub Actions cron.)

## 8. Security

- All `/admin/*` endpoints are backend-enforced, not just hidden in the UI. Two guards, by caller type:
  - **Humans → `RoleGuard`** (Phase 2): `SupabaseAuthGuard` (verify JWT, upsert user) then `RolesGuard` + `@Roles(Role.ADMIN)`. Gates the catalog admin controllers and `/admin/orders`.
  - **Machines / cron → `AdminGuard`** (`common/guards/admin.guard.ts`): constant-time `x-admin-secret` vs `ADMIN_API_SECRET`, **fails closed** (500 if unset). Used for `/admin/jobs/*` (no Supabase session). **Retained on purpose — not dead code.**
- Stripe secret key, Supabase service-role key, `ADMIN_API_SECRET`, `CLOUDINARY_API_SECRET`, and `DATABASE_URL` live only in backend env — never sent to the browser. Image uploads are signed server-side so the Cloudinary secret never reaches the client (§4.6).
- Rate-limit review and chat write endpoints to mitigate spam.
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