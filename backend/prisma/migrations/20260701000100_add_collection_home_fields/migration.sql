-- Phase 4 · Home sections: collection cover image + home curation. `imageUrl` is an
-- external URL (no upload); `featuredOnHome` lets an admin pick which collections show
-- on the home page, ordered by `homeSortOrder` (asc). All additive with safe defaults,
-- no backfill. Apply with `prisma migrate deploy` (NEVER `migrate dev` — §5.5).

ALTER TABLE "product"."Collection" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "product"."Collection" ADD COLUMN "featuredOnHome" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product"."Collection" ADD COLUMN "homeSortOrder" INTEGER NOT NULL DEFAULT 0;
