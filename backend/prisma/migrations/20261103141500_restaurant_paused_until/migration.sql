-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN "pausedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "restaurants_pausedUntil_idx" ON "restaurants"("pausedUntil");

