-- CreateEnum
CREATE TYPE "RestaurantStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('CUSTOMER_CHANGED_MIND', 'RESTAURANT_TIMEOUT', 'RESTAURANT_OUT_OF_STOCK', 'RESTAURANT_CLOSED', 'RESTAURANT_OTHER', 'ADMIN_INTERVENTION');

-- CreateEnum
CREATE TYPE "FailedDeliveryReason" AS ENUM ('CUSTOMER_UNREACHABLE', 'CUSTOMER_REFUSED', 'WRONG_ADDRESS', 'UNSAFE_LOCATION');

-- CreateEnum
CREATE TYPE "DistanceSource" AS ENUM ('ROAD', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('COD_COLLECTED', 'SETTLEMENT', 'ADJUSTMENT');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_FAILED';

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_customerId_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "targetId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "codBalance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "arrivedAt" TIMESTAMP(3),
ADD COLUMN     "cancelNote" TEXT,
ADD COLUMN     "cancelReason" "CancelReason",
ADD COLUMN     "cancelledById" UUID,
ADD COLUMN     "distanceSource" "DistanceSource" NOT NULL DEFAULT 'ESTIMATED',
ADD COLUMN     "driverEarning" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "failedReason" "FailedDeliveryReason",
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "peakSurcharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platformCommission" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stalledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "RestaurantStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
ADD COLUMN     "suspendReason" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "driverComment" TEXT,
ADD COLUMN     "driverId" UUID,
ADD COLUMN     "driverRating" INTEGER,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderId" UUID,
ADD COLUMN     "ownerRepliedAt" TIMESTAMP(3),
ADD COLUMN     "ownerReply" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedDeliveryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "delivery_contact_attempts" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_contact_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_ledgers" (
    "id" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "orderId" UUID,
    "type" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_contact_attempts_orderId_createdAt_idx" ON "delivery_contact_attempts"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "driver_ledgers_orderId_key" ON "driver_ledgers"("orderId");

-- CreateIndex
CREATE INDEX "driver_ledgers_driverId_createdAt_idx" ON "driver_ledgers"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "restaurants_status_idx" ON "restaurants"("status");

-- CreateIndex
CREATE INDEX "reviews_driverId_idx" ON "reviews"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_customerId_idempotencyKey_key" ON "orders"("customerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_key" ON "reviews"("orderId");

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_contact_attempts" ADD CONSTRAINT "delivery_contact_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_contact_attempts" ADD CONSTRAINT "delivery_contact_attempts_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ledgers" ADD CONSTRAINT "driver_ledgers_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ledgers" ADD CONSTRAINT "driver_ledgers_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_ledgers" ADD CONSTRAINT "driver_ledgers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraints cho bảng reviews (rating 1..5, driverRating 1..5)
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_driverRating_check" CHECK ("driverRating" IS NULL OR ("driverRating" BETWEEN 1 AND 5));

-- Backfill dữ liệu cũ: mọi quán đang có chuyển sang ACTIVE, approvedAt = createdAt, ratingCount tính từ bảng reviews
UPDATE "restaurants" SET "status" = 'ACTIVE', "approvedAt" = "createdAt";
UPDATE "restaurants" r SET "ratingCount" = (SELECT COUNT(*)::int FROM "reviews" rv WHERE rv."restaurantId" = r.id);

-- Backfill đơn DELIVERED cũ: platformCommission = round(deliveryFee * 0.2), driverEarning = deliveryFee - platformCommission (rate = 0.2)
UPDATE "orders"
SET "platformCommission" = ROUND("deliveryFee" * 0.2)::int,
    "driverEarning" = "deliveryFee" - ROUND("deliveryFee" * 0.2)::int
WHERE "status" = 'DELIVERED';

