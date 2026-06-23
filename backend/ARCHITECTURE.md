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
├── auth/          verify Supabase JWT, upsert User/Profile, RoleGuard            → schema: iam
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
4. `payment.service` creates a Stripe PaymentIntent with an `idempotencyKey`; order is `PENDING_PAYMENT`.
5. Return the `clientSecret` to the frontend; the browser confirms payment.
6. Stripe webhook `payment_intent.succeeded` → order becomes `PAID`, append `OrderStatusHistory`, emit a notification event.
7. On payment failure / reservation timeout → **release stock** (4.4).

### 4.2 Stripe webhook (must be idempotent)
- Verify the signature with `STRIPE_WEBHOOK_SECRET`.
- Look up the event id in the `StripeEvent` ledger. If present → return `200` immediately (no-op).
- Otherwise process, then insert the `StripeEvent` row in the **same transaction** as the state change.
- The backend may be asleep when the webhook arrives → Stripe retries; the handler tolerates duplicates by design.

### 4.3 Atomic stock decrement
```sql
UPDATE product."ProductVariant"
SET    "stockQty" = "stockQty" - $qty
WHERE  "id" = $variantId AND "stockQty" >= $qty;
-- affected rows = 0  →  out of stock, abort the transaction
```
Never read-then-write in separate statements (race window). Wrap the whole checkout in one transaction.

### 4.4 Stock release
Triggered by: payment failure, order cancellation, or reservation expiry (cron). Re-increment `stockQty` for each line. Make it idempotent (don't double-release).

### 4.5 Auth sync
`SupabaseJwtGuard` verifies the JWT. On first sight of a user id, **upsert** `User` (+ empty `Profile`). `User.id` equals the Supabase Auth UUID.

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
- `ProductVariant`: `@@unique([productId, size, color])` and unique `sku`. `stockQty` is the per-variant inventory.
- `Review`: `@@unique([userId, productId])` (one review per product per user) + unique `orderItemId` (proof of purchase). The "order must be `DELIVERED`" rule is enforced in the service.
- `Payment`: unique `idempotencyKey` (no duplicate PaymentIntent) and unique `stripePaymentIntentId`.
- `StripeEvent.id` = the Stripe event id → webhook idempotency ledger.
- `Cart`: at most one of `userId` / `sessionId` (both `@unique`).

### 5.5 Full-text search
`Product` gets a `search_tsv tsvector` column + GIN index, plus a `pg_trgm` GIN index for
fuzzy name/slug matching. These are added by a **raw SQL migration** (Prisma can't express a
generated `tsvector` column natively). The `product` module exposes a `search(query, locale)`
service method. No Elasticsearch/Algolia.

## 6. Cron / scheduled jobs

Jobs: birthday vouchers, abandoned-cart cleanup, stock-reservation expiry.
- **Primary: `pg_cron` (Supabase)** — runs inside the DB, independent of Render's sleep state.
- **Alternative: UptimeRobot / cron-job.org** hitting `POST /admin/jobs/*` with a secret header (`ADMIN_JOB_SECRET`).
- Every job must be **idempotent** (cron can fire late or twice).

## 7. Health & keep-alive

`GET /health` is lightweight and **does not query the DB**. UptimeRobot pings it every 5
minutes to keep the Render instance awake. (Keep-alive is UptimeRobot, **not** GitHub Actions cron.)

## 8. Security

- All `/admin/*` endpoints are backend-enforced, not just hidden in the UI.
  - **Target:** a `RoleGuard` (Supabase JWT + `Role.ADMIN`) once the auth module exists.
  - **Current (auth deferred):** a temporary `AdminGuard` (`common/guards/admin.guard.ts`) compares an `x-admin-secret` header against `ADMIN_API_SECRET` in constant time and **fails closed** (500 if the env var is unset). Swap it for `RoleGuard` when auth lands.
- Cron endpoints require the `ADMIN_JOB_SECRET` header.
- Stripe secret key, Supabase service-role key, `ADMIN_API_SECRET`, and `DATABASE_URL` live only in backend env — never sent to the browser.
- Rate-limit review and chat write endpoints to mitigate spam.
- Never log card data or secrets.