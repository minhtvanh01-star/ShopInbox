-- AlterEnum
ALTER TYPE "ChannelStatus" ADD VALUE 'connecting';

-- AlterTable
ALTER TABLE "channel_accounts" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);
