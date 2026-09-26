-- Multi-shop: màn cấu hình lần đầu + lời mời nhân viên.
ALTER TABLE "shops" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

UPDATE "shops" SET "setupCompletedAt" = CURRENT_TIMESTAMP WHERE "setupCompletedAt" IS NULL;

CREATE TABLE "shop_invites" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "roleCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shop_invites_tokenHash_key" ON "shop_invites"("tokenHash");
CREATE INDEX "shop_invites_shopId_idx" ON "shop_invites"("shopId");

ALTER TABLE "shop_invites" ADD CONSTRAINT "shop_invites_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_invites" ADD CONSTRAINT "shop_invites_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
