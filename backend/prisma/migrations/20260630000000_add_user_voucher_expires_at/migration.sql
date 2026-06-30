-- Phase 4 · Vouchers: per-user expiry. A fair deadline measured from the grant
-- (e.g. the birthday voucher = grant + 30 days), instead of one shared validTo that
-- favours early-in-the-year birthdays. Additive nullable column, no backfill
-- (null = no per-user deadline → the voucher's own validFrom/validTo applies). Apply
-- with `prisma migrate deploy` (never let `migrate dev` touch the product FTS/trgm objects).
ALTER TABLE "voucher"."UserVoucher" ADD COLUMN "expiresAt" TIMESTAMP(3);
