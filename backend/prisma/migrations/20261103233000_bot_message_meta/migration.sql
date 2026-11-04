-- Lưu thẻ hành động và gợi ý nhanh của tin nhắn trợ lý
ALTER TABLE "bot_messages" ADD COLUMN "meta" JSONB;
