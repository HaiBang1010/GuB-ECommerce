-- Phase 4 · Vouchers: optional bilingual display copy (admin-authored). All four
-- columns are nullable (no backfill); the storefront falls back to `code` when null.
-- Apply with `prisma migrate deploy` (never `migrate dev` — it would propose dropping
-- the product FTS/trgm objects, ARCHITECTURE §5.5).
ALTER TABLE "voucher"."Voucher"
  ADD COLUMN "titleVi" TEXT,
  ADD COLUMN "titleEn" TEXT,
  ADD COLUMN "descriptionVi" TEXT,
  ADD COLUMN "descriptionEn" TEXT;
