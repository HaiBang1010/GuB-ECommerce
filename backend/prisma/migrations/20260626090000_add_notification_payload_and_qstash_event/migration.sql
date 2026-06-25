-- Phase 3 · Notifications: structured payload + queue idempotency ledger.
-- `payload` carries language-neutral data (e.g. { orderId }) so the frontend renders
-- text via i18n; `title`/`body` become optional (we no longer store localized strings).
ALTER TABLE "notification"."Notification" ADD COLUMN "payload" JSONB;
ALTER TABLE "notification"."Notification" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "notification"."Notification" ALTER COLUMN "body" DROP NOT NULL;

-- QStash idempotency ledger (insert-first → P2002 no-op). The id is a deterministic
-- "<orderId>:<status>" dedup key, mirroring the StripeEvent pattern.
CREATE TABLE "notification"."QStashEvent" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QStashEvent_pkey" PRIMARY KEY ("id")
);
