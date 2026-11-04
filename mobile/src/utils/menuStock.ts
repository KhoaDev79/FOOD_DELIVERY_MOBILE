/**
 * Hết món có hẹn giờ ("Hết hôm nay"). Bản sao công thức của backend (modules/menus/menu-stock.util.ts):
 * mở bán lại lúc 04:00 giờ VN gần nhất, để quán bán xuyên đêm không tự mở lại món giữa ca tối.
 */
const VN_OFFSET_MS = 7 * 60 * 60_000;
export const STOCK_RESET_HOUR_VN = 4;

export type StockStatus = 'AVAILABLE' | 'SOLD_OUT_TODAY' | 'SOLD_OUT';

export function nextStockResetAt(now: Date = new Date()): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const reset = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), STOCK_RESET_HOUR_VN, 0, 0, 0);
  const target = reset > vn.getTime() ? reset : reset + 24 * 60 * 60_000;
  return new Date(target - VN_OFFSET_MS);
}

/** "04:00 sáng mai" / "04:00 hôm nay" */
export function formatRestockTime(until: Date | string, now: Date = new Date()): string {
  const a = new Date(new Date(until).getTime() + VN_OFFSET_MS);
  const b = new Date(now.getTime() + VN_OFFSET_MS);
  const hhmm = `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`;
  const sameDay =
    a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
  return sameDay ? `${hhmm} hôm nay` : `${hhmm} sáng mai`;
}

export function stockStatusOf(
  item: { isAvailable: boolean; soldOutUntil?: string | null },
  now: Date = new Date(),
): StockStatus {
  if (item.isAvailable) return 'AVAILABLE';
  return item.soldOutUntil && new Date(item.soldOutUntil).getTime() > now.getTime() ? 'SOLD_OUT_TODAY' : 'SOLD_OUT';
}
