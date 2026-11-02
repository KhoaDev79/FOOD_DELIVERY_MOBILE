-- CreateTable
CREATE TABLE "order_chat_reads" (
    "orderId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_chat_reads_pkey" PRIMARY KEY ("orderId","userId")
);

-- CreateIndex
CREATE INDEX "order_chat_reads_userId_idx" ON "order_chat_reads"("userId");

-- AddForeignKey
ALTER TABLE "order_chat_reads" ADD CONSTRAINT "order_chat_reads_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_reads" ADD CONSTRAINT "order_chat_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
