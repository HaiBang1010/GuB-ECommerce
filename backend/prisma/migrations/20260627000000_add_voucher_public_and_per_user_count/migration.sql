-- Phase 4 · Vouchers: distinguish PUBLIC vs WALLET-ONLY, and track per-user redemptions.
-- Both columns are additive with safe defaults (no data backfill). Apply with
-- `prisma migrate deploy` (never let `migrate dev` touch the product FTS/trgm objects).

-- PUBLIC (default): any code holder may redeem, bounded by usageLimit/perUserLimit.
-- false = WALLET-ONLY: redeemable only by a user it was granted to (a UserVoucher row).
ALTER TABLE "voucher"."Voucher" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Per-user redemption counter (enforces Voucher.perUserLimit). usedAt stays as the
-- last-redeemed timestamp; a wallet grant starts at usedCount = 0, usedAt = NULL.
ALTER TABLE "voucher"."UserVoucher" ADD COLUMN "usedCount" INTEGER NOT NULL DEFAULT 0;
