-- Phase 4 · Size suggestion: a per-category size system (rule-based, no ML). The
-- size→measurement ranges live as code constants (product/size/size-charts.ts); only
-- this discriminator is persisted. Nullable, no default (no backfill); null = no
-- suggestion for the category. Apply with `prisma migrate deploy` (NEVER `migrate dev`
-- — it would propose dropping the product FTS/pg_trgm objects, ARCHITECTURE §5.5).

-- CreateEnum
CREATE TYPE "product"."SizeSystem" AS ENUM ('ALPHA_TOPS', 'ALPHA_BOTTOMS', 'EU_SHOES');

-- AlterTable
ALTER TABLE "product"."Category" ADD COLUMN "sizeSystem" "product"."SizeSystem";
