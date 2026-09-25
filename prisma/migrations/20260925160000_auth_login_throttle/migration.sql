-- Rate limit đăng nhập mật khẩu theo email (cửa sổ 15 phút).
CREATE TABLE "auth_login_throttles" (
    "email" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_login_throttles_pkey" PRIMARY KEY ("email")
);
