-- Super admin: gói shop + nhu cầu hỗ trợ.
CREATE TYPE "ShopPlan" AS ENUM ('trial', 'starter', 'pro', 'business');
CREATE TYPE "ShopSupportStatus" AS ENUM ('ok', 'watching', 'needs_help', 'in_progress');
CREATE TYPE "ShopSupportTopic" AS ENUM ('none', 'onboarding', 'channel', 'billing', 'bug', 'other');

ALTER TABLE "shops" ADD COLUMN "planCode" "ShopPlan" NOT NULL DEFAULT 'trial';
ALTER TABLE "shops" ADD COLUMN "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "shops" ADD COLUMN "supportStatus" "ShopSupportStatus" NOT NULL DEFAULT 'ok';
ALTER TABLE "shops" ADD COLUMN "supportTopic" "ShopSupportTopic" NOT NULL DEFAULT 'none';
ALTER TABLE "shops" ADD COLUMN "supportNote" TEXT NOT NULL DEFAULT '';
