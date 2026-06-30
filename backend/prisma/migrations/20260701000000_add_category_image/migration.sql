-- Phase 4 · Home sections: a category cover image (external URL, no upload) for the
-- storefront category grid. Additive nullable column, no backfill. Apply with
-- `prisma migrate deploy` (NEVER `migrate dev` — it would propose dropping the product
-- FTS/pg_trgm objects, ARCHITECTURE §5.5).

ALTER TABLE "product"."Category" ADD COLUMN "imageUrl" TEXT;
