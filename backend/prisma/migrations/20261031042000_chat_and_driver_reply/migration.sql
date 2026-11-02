-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "driverRepliedAt" TIMESTAMP(3),
ADD COLUMN     "driverReply" TEXT;

-- CreateTable
CREATE TABLE "order_messages" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "senderRole" "Role" NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_messages_orderId_createdAt_idx" ON "order_messages"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_messages" ADD CONSTRAINT "order_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
