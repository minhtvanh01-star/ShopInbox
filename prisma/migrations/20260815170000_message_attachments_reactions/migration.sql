-- AlterTable
ALTER TABLE "messages" ADD COLUMN "attachmentType" TEXT;
ALTER TABLE "messages" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "messages" ADD COLUMN "attachmentName" TEXT;

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "staffId" TEXT,
    "reactorKey" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_reactions_shopId_idx" ON "message_reactions"("shopId");

-- CreateIndex
CREATE INDEX "message_reactions_messageId_idx" ON "message_reactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_reactorKey_key" ON "message_reactions"("messageId", "reactorKey");

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
