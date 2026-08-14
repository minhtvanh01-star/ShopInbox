-- AlterTable
ALTER TABLE "staff" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "staff" ADD COLUMN "googleId" TEXT,
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "staff_googleId_key" ON "staff"("googleId");
