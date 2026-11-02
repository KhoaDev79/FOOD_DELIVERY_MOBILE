-- AlterTable
ALTER TABLE "banners" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "banners_isActive_sortOrder_idx" ON "banners"("isActive", "sortOrder");
