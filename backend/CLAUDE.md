# GuB Backend — NestJS modular monolith

> This file **supplements** `../CLAUDE.md` (does not override it). Read the full backend architecture in `ARCHITECTURE.md` in this folder.

## Commands
- Dev:          `npm run start:dev`
- Test:         `npm run test`
- Test 1 file:  `npm run test -- <path>`
- Lint:         `npm run lint`
- Typecheck:    `npm run typecheck`
- Migration:    `npx prisma migrate dev --name <name>`
- Generate:     `npx prisma generate`

## Module boundaries (MANDATORY)
- Each module = one folder in `src/modules/<name>/` containing: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `*.service.spec.ts`.
- Each module owns its **own Postgres schema** (prefix `product.`, `order.`, ...). No cross-schema JOINs.
- A module only exposes a **service interface**; other modules call that service, NOT its repository/tables directly.
- `business logic` lives in the **service**; the controller only orchestrates + validates DTOs.

## Prisma
- Money: integer **cents** columns (e.g. `price_cents`, `unit_price_cents`). No float, no Decimal for displayed money.
- `ProductImage` has a `color` field; `Category` has a self-referencing `parent_id`.
- Every table has an archive flag (e.g. `archived_at`) instead of hard deletion.

## Core problems (the code must handle correctly)
- **Atomic stock**: decrement inside a transaction with the condition `stock_qty >= n`, or use a time-boxed reservation then release. Never let stock go negative or leak.
- **Price snapshot**: `OrderItem.unit_price_cents` is captured at order time — do NOT reference the variant's live price.
- **Idempotent Stripe webhook**: store the processed `event_id`; the same event running twice must not create two orders. Verify the signature. The backend may be asleep → Stripe retries, so the handler must tolerate duplicates.
- **Release stock** on payment failure / order cancellation.
- **Auth sync**: upsert `User`/`Profile` on first login (verify the Supabase JWT in a guard).

## Security (see also `src/modules/payment/CLAUDE.md`)
- NEVER log card numbers / sensitive data. NEVER hardcode keys.
- Admin endpoints and cron-job endpoints (called externally) must all have a guard / secret header.

## Health
- `GET /health` is a lightweight endpoint — **does NOT query the DB** (UptimeRobot pings it to keep Render awake).

## API docs (OpenAPI)
- Every endpoint is documented via `@nestjs/swagger` (no CLI plugin): controllers get `@ApiTags`/`@ApiOperation`/`@ApiResponse`; request DTOs get `@ApiProperty(+example)`; each entity has a `*-response.dto.ts` so no endpoint serializes to `any`. Keep new endpoints annotated — the doc at `GET /docs` (`/docs-json`) is the frontend's type source. See `ARCHITECTURE.md` §9.
