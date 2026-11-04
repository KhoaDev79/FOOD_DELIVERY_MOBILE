/**
 * Giờ mở cửa của quán, cùng quy tắc với backend (backend/src/common/utils/opening-hours.ts):
 *  - Giờ hiểu theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của điện thoại.
 *  - open < close: mở trong ngày (07:00–22:00); open > close: mở qua đêm (18:00–02:00);
 *    open = close: mở cả ngày.
 *  - Quán nhận đơn khi: đã được duyệt (ACTIVE) + chủ quán bật nhận đơn + không tạm nghỉ +
 *    không trong ngày nghỉ lễ/Tết + đang trong giờ mở cửa.
 */

import { RestaurantOpeningHour, RestaurantSpecialClosing } from '../types/api';

const VN_OFFSET_MINUTES = 7 * 60;
const DAY = 24 * 60;

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const DAY_OF_WEEK_NAMES = [
  'Chủ nhật',
  'Thứ hai',
  'Thứ ba',
  'Thứ tư',
  'Thứ năm',
  'Thứ sáu',
  'Thứ bảy',
];

/** Tên ngắn: "CN", "T2", "T3"... */
export const DAY_OF_WEEK_SHORT_NAMES = [
  'CN',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
];

/** Số phút từ 00:00 theo giờ Việt Nam. */
export function vnMinutesOfDay(now: Date = new Date()): number {
  const local = new Date(now.getTime() + VN_OFFSET_MINUTES * 60_000);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** Lấy thứ trong tuần (0..6) theo giờ Việt Nam */
export function vnDayOfWeek(now: Date = new Date()): number {
  const local = new Date(now.getTime() + VN_OFFSET_MINUTES * 60_000);
  return local.getUTCDay();
}

/** Lấy chuỗi YYYY-MM-DD theo giờ Việt Nam */
export function vnDateYMD(now: Date = new Date()): string {
  const local = new Date(now.getTime() + VN_OFFSET_MINUTES * 60_000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/** Kiểm tra quán có đang trong thời gian tạm nghỉ có hẹn giờ không. */
export function isRestaurantPaused(
  pausedUntil?: string | null,
  now: Date = new Date(),
): boolean {
  if (!pausedUntil) return false;
  const target = new Date(pausedUntil);
  const time = target.getTime();
  return !Number.isNaN(time) && time > now.getTime();
}

/** Kiểm tra ngày hôm nay có phải ngày nghỉ đặc biệt của quán không */
export function getTodaySpecialClosing(
  specialClosings?: RestaurantSpecialClosing[] | null,
  now: Date = new Date(),
): RestaurantSpecialClosing | null {
  if (!specialClosings || specialClosings.length === 0) return null;
  const todayYMD = vnDateYMD(now);

  for (const item of specialClosings) {
    const itemYMD = item.date.slice(0, 10);
    if (itemYMD === todayYMD) {
      return item;
    }
  }
  return null;
}

/** Lấy giờ mở cửa áp dụng cho ngày hôm nay */
export function getTodayOpeningHour(
  openingHours?: RestaurantOpeningHour[] | null,
  defaultOpenTime = '07:00',
  defaultCloseTime = '22:00',
  now: Date = new Date(),
): { openTime: string; closeTime: string; isClosed: boolean } {
  if (openingHours && openingHours.length > 0) {
    const todayDay = vnDayOfWeek(now);
    const found = openingHours.find((h) => h.dayOfWeek === todayDay);
    if (found) {
      return {
        openTime: found.openTime,
        closeTime: found.closeTime,
        isClosed: found.isClosed,
      };
    }
  }

  return {
    openTime: defaultOpenTime,
    closeTime: defaultCloseTime,
    isClosed: false,
  };
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
  /** Đang trong mốc hẹn giờ tạm nghỉ. */
  isTimedPause?: boolean;
  /** Số phút còn lại nếu đang hẹn giờ. */
  remainingMinutes?: number;
  /** Giờ mở lại dạng HH:mm */
  reopenTime?: string;
}

export function getStoreStatus(
  r: {
    status?: string;
    isOpen: boolean;
    openTime?: string | null;
    closeTime?: string | null;
    pausedUntil?: string | null;
    openingHours?: RestaurantOpeningHour[] | null;
    specialClosings?: RestaurantSpecialClosing[] | null;
  },
  now: Date = new Date(),
): StoreStatus {
  if (r.status && r.status !== 'ACTIVE') {
    return {
      kind: 'NOT_ACTIVE',
      accepting: false,
      label: r.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Tạm khoá',
      detail: 'Quán chưa hiển thị với khách',
    };
  }

  // 1. Tạm nghỉ có hẹn giờ
  if (isRestaurantPaused(r.pausedUntil, now)) {
    const target = new Date(r.pausedUntil!);
    const diffMs = target.getTime() - now.getTime();
    const remainingMinutes = Math.max(1, Math.ceil(diffMs / 60_000));
    const localTarget = new Date(target.getTime() + VN_OFFSET_MINUTES * 60_000);
    const hh = String(localTarget.getUTCHours()).padStart(2, '0');
    const mm = String(localTarget.getUTCMinutes()).padStart(2, '0');
    const reopenTime = `${hh}:${mm}`;

    return {
      kind: 'PAUSED',
      accepting: false,
      isTimedPause: true,
      remainingMinutes,
      reopenTime,
      label: 'Tạm nghỉ có hẹn giờ',
      detail: `Tự mở lại lúc ${reopenTime} · còn ${formatDuration(remainingMinutes)}`,
    };
  }

  // 2. Công tắc mở quán bị tắt
  if (!r.isOpen) {
    return {
      kind: 'PAUSED',
      accepting: false,
      label: 'Tạm nghỉ',
      detail: 'Khách không đặt được món cho tới khi bạn bật lại',
    };
  }

  // 3. Trùng ngày nghỉ lễ / ngày nghỉ đặc biệt
  const specialClosing = getTodaySpecialClosing(r.specialClosings, now);
  if (specialClosing) {
    return {
      kind: 'PAUSED',
      accepting: false,
      label: 'Nghỉ ngày đặc biệt',
      detail: specialClosing.reason ? `Quán nghỉ: ${specialClosing.reason}` : 'Quán tạm nghỉ ngày hôm nay',
    };
  }

  // 4. Giờ mở cửa ngày hôm nay (theo lịch 7 ngày hoặc mặc định)
  const todaySchedule = getTodayOpeningHour(r.openingHours, r.openTime || '07:00', r.closeTime || '22:00', now);
  if (todaySchedule.isClosed) {
    return {
      kind: 'PAUSED',
      accepting: false,
      label: 'Nghỉ bán hôm nay',
      detail: 'Quán không mở bán vào ngày này theo lịch tuần',
    };
  }

  const { openTime, closeTime } = todaySchedule;
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
