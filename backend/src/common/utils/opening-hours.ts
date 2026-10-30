/** Giờ Việt Nam (UTC+7). Giờ mở cửa của quán luôn hiểu theo giờ địa phương. */
const VN_OFFSET_MINUTES = 7 * 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Quán có đang trong giờ mở cửa không.
 *  - open < close: mở trong ngày (07:00–22:00)
 *  - open > close: mở qua đêm (18:00–02:00)
 *  - open = close: mở cả ngày
 */
export function isWithinOpeningHours(
  openTime: string,
  closeTime: string,
  now: Date = new Date(),
  offsetMinutes = VN_OFFSET_MINUTES,
): boolean {
  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const t = local.getUTCHours() * 60 + local.getUTCMinutes();
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === close) return true;
  return open < close ? t >= open && t < close : t >= open || t < close;
}

/**
 * Quán có đang nhận đơn không: chủ quán bật "mở cửa" VÀ đang trong giờ mở cửa.
 * Dùng cho mọi chỗ khách hàng nhìn thấy và khi đặt đơn.
 */
export function isAcceptingOrders(
  r: { isOpen: boolean; openTime: string; closeTime: string },
  now: Date = new Date(),
): boolean {
  return r.isOpen && isWithinOpeningHours(r.openTime, r.closeTime, now);
}
