/**
 * Giờ mở cửa của quán, cùng quy tắc với backend (backend/src/common/utils/opening-hours.ts):
 *  - Giờ hiểu theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của điện thoại.
 *  - open < close: mở trong ngày (07:00–22:00); open > close: mở qua đêm (18:00–02:00);
 *    open = close: mở cả ngày.
 *  - Quán nhận đơn khi: đã được duyệt (ACTIVE) + chủ quán bật nhận đơn + đang trong giờ mở cửa.
 */

const VN_OFFSET_MINUTES = 7 * 60;
const DAY = 24 * 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Số phút từ 00:00 theo giờ Việt Nam. */
export function vnMinutesOfDay(now: Date = new Date()): number {
  const local = new Date(now.getTime() + VN_OFFSET_MINUTES * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function isWithinOpeningHours(openTime: string, closeTime: string, now: Date = new Date()): boolean {
  const t = vnMinutesOfDay(now);
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open === close) return true;
  return open < close ? t >= open && t < close : t >= open || t < close;
}

/** "2 giờ 15 phút", "45 phút". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
}

export type StoreStatusKind = 'OPEN' | 'OUT_OF_HOURS' | 'PAUSED' | 'NOT_ACTIVE';

export interface StoreStatus {
  kind: StoreStatusKind;
  /** Khách có đặt được món ngay lúc này không. */
  accepting: boolean;
  /** Nhãn ngắn: "Đang nhận đơn", "Ngoài giờ mở cửa"… */
  label: string;
  /** Dòng giải thích dưới nhãn. */
  detail: string;
}

export function getStoreStatus(
  r: { status?: string; isOpen: boolean; openTime?: string | null; closeTime?: string | null },
  now: Date = new Date(),
): StoreStatus {
  const openTime = r.openTime || '07:00';
  const closeTime = r.closeTime || '22:00';

  if (r.status && r.status !== 'ACTIVE') {
    return {
      kind: 'NOT_ACTIVE',
      accepting: false,
      label: r.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Tạm khoá',
      detail: 'Quán chưa hiển thị với khách',
    };
  }
  if (!r.isOpen) {
    return {
      kind: 'PAUSED',
      accepting: false,
      label: 'Tạm nghỉ',
      detail: 'Khách không đặt được món cho tới khi bạn bật lại',
    };
  }

  const t = vnMinutesOfDay(now);
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);

  if (isWithinOpeningHours(openTime, closeTime, now)) {
    if (open === close) {
      return { kind: 'OPEN', accepting: true, label: 'Đang nhận đơn', detail: 'Mở cửa cả ngày' };
    }
    const left = (close - t + DAY) % DAY;
    return {
      kind: 'OPEN',
      accepting: true,
      label: 'Đang nhận đơn',
      detail: `Đóng cửa lúc ${closeTime} · còn ${formatDuration(left)}`,
    };
  }

  // Ngoài giờ: công tắc vẫn bật nên quán sẽ tự mở lại theo giờ
  const until = (open - t + DAY) % DAY;
  const whenText = t < open ? `lúc ${openTime} hôm nay` : `lúc ${openTime} sáng mai`;
  return {
    kind: 'OUT_OF_HOURS',
    accepting: false,
    label: 'Ngoài giờ mở cửa',
    detail: `Tự mở lại ${whenText} · sau ${formatDuration(until)}`,
  };
}
