import { RestaurantStatus } from '@prisma/client';

/** Giờ Việt Nam (UTC+7). Giờ mở cửa của quán luôn hiểu theo giờ địa phương. */
export const VN_OFFSET_MINUTES = 7 * 60;

export interface WeeklyOpeningHourInput {
  dayOfWeek: number; // 0 = Chủ nhật, 1 = Thứ hai, ..., 6 = Thứ bảy
  openTime: string;  // "07:00"
  closeTime: string; // "22:00"
  isClosed?: boolean;
}

export interface SpecialClosingInput {
  date: Date | string;
  reason?: string | null;
}

export const toMinutes = (hhmm: string) => {
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
 * Kiểm tra quán có đang tạm nghỉ có hẹn giờ không.
 * Nếu pausedUntil ở tương lai (so với now), quán đang tạm nghỉ.
 */
export function isRestaurantPaused(
  pausedUntil?: Date | string | null,
  now: Date = new Date(),
): boolean {
  if (!pausedUntil) return false;
  const d = typeof pausedUntil === 'string' ? new Date(pausedUntil) : pausedUntil;
  const time = d.getTime();
  return !Number.isNaN(time) && time > now.getTime();
}

/**
 * Kiểm tra ngày hiện tại (theo giờ VN UTC+7) có nằm trong danh sách ngày nghỉ đặc biệt không.
 */
export function isSpecialClosing(
  specialClosings?: SpecialClosingInput[] | null,
  now: Date = new Date(),
  offsetMinutes = VN_OFFSET_MINUTES,
): { isClosing: boolean; reason?: string | null } {
  if (!specialClosings || specialClosings.length === 0) return { isClosing: false };

  const local = new Date(now.getTime() + offsetMinutes * 60_000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  const todayYMD = `${year}-${month}-${day}`;

  for (const item of specialClosings) {
    let itemYMD: string;
    if (typeof item.date === 'string') {
      itemYMD = item.date.slice(0, 10);
    } else {
      const d = item.date;
      itemYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (itemYMD === todayYMD) {
      return { isClosing: true, reason: item.reason };
    }
  }

  return { isClosing: false };
}

/**
 * Kiểm tra giờ mở cửa theo ngày trong tuần:
 * Nếu quán có cấu hình openingHours cho dayOfWeek hôm nay:
 *   - Nếu isClosed: đóng cửa
 *   - Kiểm tra isWithinOpeningHours(openTime, closeTime, now)
 * Nếu không có cấu hình cho ngày hôm nay, dùng openTime và closeTime mặc định của quán.
 */
export function isWithinWeeklySchedule(
  schedule: {
    openTime: string;
    closeTime: string;
    openingHours?: WeeklyOpeningHourInput[] | null;
  },
  now: Date = new Date(),
  offsetMinutes = VN_OFFSET_MINUTES,
): boolean {
  if (schedule.openingHours && schedule.openingHours.length > 0) {
    const local = new Date(now.getTime() + offsetMinutes * 60_000);
    const dayOfWeek = local.getUTCDay(); // 0 = Chủ nhật, 1 = Thứ hai, ..., 6 = Thứ bảy
    const todayHour = schedule.openingHours.find((h) => h.dayOfWeek === dayOfWeek);

    if (todayHour) {
      if (todayHour.isClosed) return false;
      return isWithinOpeningHours(todayHour.openTime, todayHour.closeTime, now, offsetMinutes);
    }
  }

  return isWithinOpeningHours(schedule.openTime, schedule.closeTime, now, offsetMinutes);
}

/**
 * Quán có đang nhận đơn không: đã được duyệt (status === ACTIVE),
 * chủ quán bật "mở cửa", KHÔNG trong thời gian tạm nghỉ có hẹn giờ (pausedUntil),
 * KHÔNG trùng ngày nghỉ đặc biệt VÀ đang trong giờ mở cửa của ngày hôm nay.
 * Dùng cho mọi chỗ khách hàng nhìn thấy và khi đặt đơn.
 */
export function isAcceptingOrders(
  r: {
    status?: RestaurantStatus | string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    pausedUntil?: Date | string | null;
    openingHours?: WeeklyOpeningHourInput[] | null;
    specialClosings?: SpecialClosingInput[] | null;
  },
  now: Date = new Date(),
): boolean {
  const status = r.status ?? 'ACTIVE';
  if (status !== 'ACTIVE' || !r.isOpen) return false;
  if (isRestaurantPaused(r.pausedUntil, now)) return false;
  if (isSpecialClosing(r.specialClosings, now).isClosing) return false;
  return isWithinWeeklySchedule(r, now);
}
