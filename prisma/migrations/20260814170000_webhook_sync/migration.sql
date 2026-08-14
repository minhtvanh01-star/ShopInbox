-- AlterTable
ALTER TABLE "channel_accounts" ADD COLUMN "connectedAt" TIMESTAMP(3),
ADD COLUMN "lastWebhookAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "externalMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "messages_shopId_externalMessageId_key" ON "messages"("shopId", "externalMessageId");
