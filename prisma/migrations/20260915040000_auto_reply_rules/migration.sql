-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL,
    "keywords" TEXT NOT NULL DEFAULT '',
    "replyText" TEXT NOT NULL,
    "openMinute" INTEGER,
    "closeMinute" INTEGER,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 120,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_reply_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_reply_rules_shopId_enabled_idx" ON "auto_reply_rules"("shopId", "enabled");

-- AddForeignKey
ALTER TABLE "auto_reply_rules" ADD CONSTRAINT "auto_reply_rules_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
