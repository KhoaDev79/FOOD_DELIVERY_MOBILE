import { VN_OFFSET_MINUTES } from '../../common/utils/opening-hours';

/**
 * Giờ bắt đầu "ngày kinh doanh" (giờ VN). "Hết hôm nay" mở bán lại lúc này thay vì 0:00,
 * để quán bán xuyên đêm (vd 18:00 – 02:00) không tự mở lại món giữa ca tối.
 */
export const STOCK_RESET_HOUR_VN = 4;

export const STOCK_STATUSES = ['AVAILABLE', 'SOLD_OUT_TODAY', 'SOLD_OUT'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/** Mốc 04:00 (giờ VN) gần nhất SAU thời điểm now. */
export function nextStockResetAt(now: Date): Date {
  const offsetMs = VN_OFFSET_MINUTES * 60_000;
  const vn = new Date(now.getTime() + offsetMs);
  const resetVn = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), STOCK_RESET_HOUR_VN, 0, 0, 0);
  // Mốc hôm nay đã qua (hoặc đúng lúc này) thì lấy mốc ngày mai
  const target = resetVn > vn.getTime() ? resetVn : resetVn + 24 * 60 * 60_000;
  return new Date(target - offsetMs);
}

/** Dữ liệu cần ghi khi quán đổi tình trạng món. */
export function stockPatch(status: StockStatus, now: Date): { isAvailable: boolean; soldOutUntil: Date | null } {
  switch (status) {
    case 'AVAILABLE':
      return { isAvailable: true, soldOutUntil: null };
    case 'SOLD_OUT_TODAY':
      return { isAvailable: false, soldOutUntil: nextStockResetAt(now) };
    case 'SOLD_OUT':
      return { isAvailable: false, soldOutUntil: null };
  }
}

/** Tình trạng hiện tại của món (đọc từ DB), dùng cho app chủ quán. */
export function stockStatusOf(item: { isAvailable: boolean; soldOutUntil?: Date | null }, now: Date): StockStatus {
  if (item.isAvailable) return 'AVAILABLE';
  return item.soldOutUntil && item.soldOutUntil.getTime() > now.getTime() ? 'SOLD_OUT_TODAY' : 'SOLD_OUT';
}

/** "04:00 sáng mai" / "04:00 hôm nay" theo giờ VN, để báo cho khách và chủ quán. */
export function formatRestockTime(until: Date, now: Date): string {
  const offsetMs = VN_OFFSET_MINUTES * 60_000;
  const a = new Date(until.getTime() + offsetMs);
  const b = new Date(now.getTime() + offsetMs);
  const hhmm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  const sameDay =
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  return sameDay ? `${hhmm} hôm nay` : `${hhmm} sáng mai`;
}
