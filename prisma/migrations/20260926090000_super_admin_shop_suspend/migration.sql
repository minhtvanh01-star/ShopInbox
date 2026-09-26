-- Super admin nền tảng + tạm khóa shop.
ALTER TABLE "staff" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shops" ADD COLUMN "suspendedAt" TIMESTAMP(3);
