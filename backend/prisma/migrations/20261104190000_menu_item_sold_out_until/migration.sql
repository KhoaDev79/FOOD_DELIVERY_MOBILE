-- Hết món có hẹn giờ ("Hết hôm nay"): thời điểm tự mở bán lại (cột mới, cho phép null)
ALTER TABLE "menu_items" ADD COLUMN "soldOutUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "menu_items_soldOutUntil_idx" ON "menu_items"("soldOutUntil");
