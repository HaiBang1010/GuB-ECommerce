-- Phase 3 · Reviews: enforce a 1..5 rating at the DB layer (defense in depth — the
-- CreateReviewDto also validates @Min(1)/@Max(5)). HAND-WRITTEN: a CHECK constraint
-- cannot be expressed in the Prisma model, so the `rating` column was scaffolded as a
-- plain INTEGER in the init migration. Apply with `prisma migrate deploy` (never let
-- `migrate dev` drop it).
ALTER TABLE "review"."Review"
  ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
