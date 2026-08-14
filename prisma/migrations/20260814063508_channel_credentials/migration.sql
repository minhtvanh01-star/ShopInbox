-- AlterTable
ALTER TABLE "channel_accounts" ADD COLUMN     "appId" TEXT,
ADD COLUMN     "appSecret" TEXT,
ADD COLUMN     "oaId" TEXT,
ADD COLUMN     "pageId" TEXT,
ADD COLUMN     "webhookSecret" TEXT;
