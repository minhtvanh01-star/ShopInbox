-- Bump khi đổi mật khẩu / vô hiệu hóa để JWT cũ hết hiệu lực.
ALTER TABLE "staff" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
