-- Outbound Meta send needs FB Page id for Instagram; staff lifecycle needs isActive.
ALTER TABLE "staff" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "staff_shopId_isActive_idx" ON "staff"("shopId", "isActive");

ALTER TABLE "channel_accounts" ADD COLUMN "linkedPageId" TEXT;
