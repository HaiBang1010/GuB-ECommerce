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

---

## 3. Tech stack (all free tier)

**Frontend (Vercel):** Next.js App Router · TypeScript · Tailwind · shadcn/ui · react-hook-form + zod · TanStack Query · Zustand (guest cart) · next-intl (vi/en) · Recharts · Vercel Web Analytics.

**Backend (Render/Koyeb):** NestJS · Prisma · PostgreSQL · class-validator + zod · Supabase JWT verification · Postgres full-text + `pg_trgm`.

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
           └─< Product ──< ProductVariant   (size+color, per-variant stockQty)
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
- `OrderItem.unitPriceCents` + `productNameVi/En` + `size`/`color` are captured at purchase.
- `Order.shippingAddress` is a JSON copy, and the voucher is snapshotted (`voucherCode`, `discountCents`).
Re-printing an old invoice always shows the original values.

---

## 5. Cross-cutting problems to solve (easy to miss)

1. **Stock race condition** — two buyers, last pair. Decrement **atomically** (`UPDATE … WHERE stockQty >= n`) or use a time-boxed reservation released on expiry.
2. **Guest-cart merge on login** — guests browse + add to cart first, log in only at checkout. Persist the guest cart (Zustand/localStorage), then **merge** into the user cart (sum quantities, dedupe variants).
3. **Price snapshot at order time** — store `unitPriceCents`; never reference the live price.
4. **Supabase Auth ↔ User sync** — upsert `User`/`Profile` on first login (in the JWT guard).
5. **Idempotent Stripe webhook** — verify signature, record `event_id` in `StripeEvent`; the backend may be asleep → Stripe retries, duplicates must be no-ops.
6. **Release stock on payment failure / cancellation** — don't leak inventory.
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
- **Scheduled jobs** (stock-reservation expiry now; birthday vouchers, abandoned-cart cleanup later): the DB is **Neon, which has no `pg_cron`** (Supabase is Auth-only here), so the pg_cron-in-DB option does **not** apply — the scheduler must be **external**. **UptimeRobot → `POST /admin/jobs/*`** with a secret header (the `AdminGuard` `x-admin-secret` = `ADMIN_API_SECRET`). Phase 2 ships `POST /admin/jobs/release-expired`, which UptimeRobot calls **~every 5 min** to cancel unpaid orders past their TTL and release their stock. All jobs must be **idempotent**.

Render free **750 instance-hours/month** → only enough to keep **one** service awake 24/7 (another reason for the monolith).

---

## 7. Phases

Principle: **get the purchase flow (Phase 0→2) working first**, layer engagement after. Every phase is deployable.

0. **Foundation** — **DONE** (CI skipped on purpose · deploy deferred). monorepo (npm workspaces), NestJS + Next.js skeleton, `GET /health`, Prisma **init migration applied on local Postgres (Docker)**, i18n (vi/en) scaffold. Deferred for later: Neon, Supabase Auth (→ Phase 2), keep-alive (UptimeRobot), and the "hello world" deploy.
1. **Catalog** — **DONE.** **Category · Product · ProductVariant · Collection · ProductImage** slices — admin CRUD + cascade/season-window archive, storefront reads, size×color variant matrix (per-variant `stockQty` + unique `sku`), n-n Collection membership with season window, by-color images via **Cloudinary signed direct upload** (delivery-time URL transforms, no backend image processing), and **full-text + fuzzy search** — generated `search_tsv` via a `simple`+`unaccent` text-search config (`product.gub_vn`), GIN index + `pg_trgm` typo tolerance, accent-insensitive `searchActive` on `GET /products?search=`. Temporary AdminGuard; jest specs throughout (incl. a DB-backed search integration spec). Cross-slice validation goes through in-process service calls (no cross-table queries). (No login required.)
2. **Cart + Auth + Checkout** *(hardest)* — **BACKEND CODE-COMPLETE · NOT yet verified end-to-end.**
   Done (backend, unit-tested + DI boot smoke test): Supabase JWT auth + first-login `User`/`Profile` upsert, real `RoleGuard` (catalog admin re-gated), address book, server-side cart (guest `sessionId` + user) with merge-on-login, checkout with **atomic stock decrement** + release, Stripe PaymentIntent + idempotent webhook (`StripeEvent` ledger), admin order-status timeline, and the `release-expired` job endpoint.
   **Still required before this counts as truly done:** a real `SUPABASE_URL` (JWKS), Stripe live test-mode keys + `stripe listen`, an integration test run against a **real Postgres**, and at least one `Role.ADMIN` user to exercise admin routes.
   **Not started:** the entire frontend (cart/checkout UI, Stripe.js). Deferred to Phase 4: refund / admin-cancel of a PAID order, voucher discount at checkout.
3. **Post-purchase** — order timeline, notifications (in-app + email via queue), reviews (purchased-only) + admin reply.
4. **Promotions & personalization** — vouchers (wallet + birthday cron), product discounts, profile + measurements + rule-based size suggestion (no ML), home banners.
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