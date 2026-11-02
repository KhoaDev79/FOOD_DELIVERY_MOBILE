-- Tách chat theo đơn thành 3 cuộc trò chuyện riêng 2 bên (khách–tài xế, khách–quán, quán–tài xế).
-- Trước đây mọi bên của đơn đọc chung một luồng tin nhắn.

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('CUSTOMER_DRIVER', 'CUSTOMER_RESTAURANT', 'RESTAURANT_DRIVER');

-- DropIndex
DROP INDEX "order_messages_orderId_createdAt_idx";

-- ===== order_messages: thêm cột, gán kênh cho tin cũ, rồi mới đặt NOT NULL =====
ALTER TABLE "order_messages" ADD COLUMN "channel" "ChatChannel",
ADD COLUMN "driverId" UUID;

-- Tin cũ không lưu người nhận nên suy ra theo người gửi:
--  - Tài xế gửi                  -> khách–tài xế
--  - Chủ quán gửi                -> khách–quán
--  - Khách gửi, đơn có tài xế    -> khách–tài xế; chưa có tài xế -> khách–quán
--  - Vai trò khác (admin)        -> khách–quán
UPDATE "order_messages" m
SET "channel" = CASE
    WHEN m."senderRole" = 'DRIVER' THEN 'CUSTOMER_DRIVER'::"ChatChannel"
    WHEN m."senderRole" = 'RESTAURANT_OWNER' THEN 'CUSTOMER_RESTAURANT'::"ChatChannel"
    WHEN m."senderRole" = 'CUSTOMER' AND o."driverId" IS NOT NULL THEN 'CUSTOMER_DRIVER'::"ChatChannel"
    ELSE 'CUSTOMER_RESTAURANT'::"ChatChannel"
  END,
  "driverId" = CASE
    WHEN m."senderRole" = 'DRIVER' THEN m."senderId"
    WHEN m."senderRole" = 'CUSTOMER' AND o."driverId" IS NOT NULL THEN o."driverId"
    ELSE NULL
  END
FROM "orders" o
WHERE o."id" = m."orderId";

ALTER TABLE "order_messages" ALTER COLUMN "channel" SET NOT NULL;

-- CreateIndex
CREATE INDEX "order_messages_orderId_channel_createdAt_idx" ON "order_messages"("orderId", "channel", "createdAt");

-- ===== order_chat_reads: mốc đọc cũ áp cho cả 3 kênh để tin đã đọc không bị báo lại =====
ALTER TABLE "order_chat_reads" DROP CONSTRAINT "order_chat_reads_pkey";
ALTER TABLE "order_chat_reads" ADD COLUMN "channel" "ChatChannel";

INSERT INTO "order_chat_reads" ("orderId", "userId", "channel", "lastReadAt")
SELECT r."orderId", r."userId", c."channel", r."lastReadAt"
FROM "order_chat_reads" r
CROSS JOIN (VALUES ('CUSTOMER_DRIVER'::"ChatChannel"), ('CUSTOMER_RESTAURANT'::"ChatChannel"), ('RESTAURANT_DRIVER'::"ChatChannel")) AS c("channel")
WHERE r."channel" IS NULL;

DELETE FROM "order_chat_reads" WHERE "channel" IS NULL;

ALTER TABLE "order_chat_reads" ALTER COLUMN "channel" SET NOT NULL;
ALTER TABLE "order_chat_reads" ADD CONSTRAINT "order_chat_reads_pkey" PRIMARY KEY ("orderId", "userId", "channel");
