-- Phase 4 · Home banners. New `marketing` schema (schema-per-module, ARCHITECTURE §2).
-- A banner's image is an external URL (admin pastes it — no upload). Additive only,
-- no backfill. Apply with `prisma migrate deploy` (NEVER `migrate dev` — it would
-- propose dropping the product FTS/pg_trgm objects, ARCHITECTURE §5.5).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "marketing";

-- CreateTable
CREATE TABLE "marketing"."Banner" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "title" TEXT,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);
