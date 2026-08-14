-- Clear existing staff so required auth columns can be added
DELETE FROM "staff";

-- AlterTable
ALTER TABLE "staff" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "email" TEXT NOT NULL,
ADD COLUMN "passwordHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");
