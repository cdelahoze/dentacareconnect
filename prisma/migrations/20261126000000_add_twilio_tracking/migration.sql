-- AlterTable
ALTER TABLE "reminders"
ADD COLUMN "externalMessageId" TEXT,
ADD COLUMN "errorMessage" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reminders_externalMessageId_key" ON "reminders"("externalMessageId");

