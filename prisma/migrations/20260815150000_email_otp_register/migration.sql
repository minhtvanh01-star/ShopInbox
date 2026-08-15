-- CreateTable
CREATE TABLE "email_otp_challenges" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_otp_challenges_email_purpose_idx" ON "email_otp_challenges"("email", "purpose");

-- CreateIndex
CREATE INDEX "email_otp_challenges_expiresAt_idx" ON "email_otp_challenges"("expiresAt");
