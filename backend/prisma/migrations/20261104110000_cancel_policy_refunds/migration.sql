-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CancelReason" ADD VALUE 'CUSTOMER_WRONG_ITEMS';
ALTER TYPE "CancelReason" ADD VALUE 'CUSTOMER_WRONG_ADDRESS';
ALTER TYPE "CancelReason" ADD VALUE 'CUSTOMER_WAIT_TOO_LONG';
ALTER TYPE "CancelReason" ADD VALUE 'CUSTOMER_FOUND_ALTERNATIVE';
ALTER TYPE "CancelReason" ADD VALUE 'CUSTOMER_OTHER';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUND_PENDING';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refundNote" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

