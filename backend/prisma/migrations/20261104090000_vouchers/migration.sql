-- CreateEnum
CREATE TYPE "VoucherFunding" AS ENUM ('PLATFORM', 'RESTAURANT');

-- CreateEnum
CREATE TYPE "VoucherKind" AS ENUM ('CAMPAIGN', 'COMPENSATION');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "freeshipVoucherCode" VARCHAR(30),
ADD COLUMN     "freeshipVoucherId" UUID,
ADD COLUMN     "restaurantDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherCode" VARCHAR(30);

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "createdById" UUID,
ADD COLUMN     "fundedBy" "VoucherFunding" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN     "kind" "VoucherKind" NOT NULL DEFAULT 'CAMPAIGN',
ADD COLUMN     "onlyNewCustomer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "perUserLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "restaurantId" UUID,
ADD COLUMN     "userId" UUID;

-- CreateTable
CREATE TABLE "voucher_usages" (
    "id" UUID NOT NULL,
    "voucherId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "voucher_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voucher_usages_voucherId_userId_idx" ON "voucher_usages"("voucherId", "userId");

-- CreateIndex
CREATE INDEX "voucher_usages_orderId_idx" ON "voucher_usages"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_usages_voucherId_orderId_key" ON "voucher_usages"("voucherId", "orderId");

-- CreateIndex
CREATE INDEX "vouchers_isActive_endDate_idx" ON "vouchers"("isActive", "endDate");

-- CreateIndex
CREATE INDEX "vouchers_restaurantId_idx" ON "vouchers"("restaurantId");

-- CreateIndex
CREATE INDEX "vouchers_userId_idx" ON "vouchers"("userId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_freeshipVoucherId_fkey" FOREIGN KEY ("freeshipVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

