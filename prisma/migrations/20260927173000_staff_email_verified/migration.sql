-- Xác nhận hồ sơ: email đã OTP / Google.
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
