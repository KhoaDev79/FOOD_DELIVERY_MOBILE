import { CancelReason } from '@prisma/client';

/** Lý do khách được chọn khi tự huỷ đơn (chỉ khi quán chưa nhận đơn). */
export const CUSTOMER_CANCEL_REASONS: { value: CancelReason; label: string; requiresNote?: boolean }[] = [
  { value: CancelReason.CUSTOMER_CHANGED_MIND, label: 'Tôi đổi ý, không muốn đặt nữa' },
  { value: CancelReason.CUSTOMER_WRONG_ITEMS, label: 'Đặt nhầm món hoặc số lượng' },
  { value: CancelReason.CUSTOMER_WRONG_ADDRESS, label: 'Nhập sai địa chỉ giao hàng' },
  { value: CancelReason.CUSTOMER_WAIT_TOO_LONG, label: 'Quán xác nhận quá lâu' },
  { value: CancelReason.CUSTOMER_FOUND_ALTERNATIVE, label: 'Tìm được quán khác phù hợp hơn' },
  { value: CancelReason.CUSTOMER_OTHER, label: 'Lý do khác', requiresNote: true },
];

export const CUSTOMER_CANCEL_REASON_VALUES = CUSTOMER_CANCEL_REASONS.map((r) => r.value);

export interface CancelLimitConfig {
  /** Khoảng thời gian tính số lần huỷ (ngày) */
  windowDays: number;
  /** Từ lần huỷ thứ mấy trong khoảng thì nhắc khách */
  warnAt: number;
  /** Đạt số lần huỷ này thì tạm hạn chế đặt đơn */
  limit: number;
}

export const DEFAULT_CANCEL_LIMIT: CancelLimitConfig = { windowDays: 7, warnAt: 2, limit: 4 };

export interface CancelLimitStatus {
  /** Số đơn khách tự huỷ trong khoảng thời gian */
  count: number;
  limit: number;
  windowDays: number;
  /** Đang bị tạm hạn chế đặt đơn */
  restricted: boolean;
  /** Hết hạn chế lúc nào (khi lần huỷ cũ nhất trong số đếm ra khỏi khoảng thời gian) */
  restrictedUntil?: Date;
  /** Lời nhắc hiện khi khách sắp huỷ thêm đơn */
  warning?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const fmt = (d: Date) =>
  d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

/**
 * Giới hạn khách tự huỷ đơn (giống Grab/ShopeeFood): huỷ nhiều trong thời gian ngắn thì nhắc trước,
 * vượt ngưỡng thì tạm không cho đặt đơn mới cho tới khi số lần huỷ trong khoảng giảm xuống dưới ngưỡng.
 * Chỉ đếm đơn khách TỰ huỷ (quán/hệ thống/admin huỷ không tính).
 */
export function evaluateCancelLimit(
  cancelTimes: Date[],
  now = new Date(),
  cfg: CancelLimitConfig = DEFAULT_CANCEL_LIMIT,
): CancelLimitStatus {
  const since = now.getTime() - cfg.windowDays * DAY_MS;
  const recent = cancelTimes
    .map((d) => new Date(d).getTime())
    .filter((t) => t > since && t <= now.getTime())
    .sort((a, b) => a - b);
  const count = recent.length;
  const base = { count, limit: cfg.limit, windowDays: cfg.windowDays };

  if (count >= cfg.limit) {
    // Hết hạn chế khi số lần huỷ còn trong khoảng < limit: lần huỷ thứ (count - limit + 1) tính từ cũ nhất phải rời khoảng
    const releaseAt = new Date(recent[count - cfg.limit] + cfg.windowDays * DAY_MS);
    return {
      ...base,
      restricted: true,
      restrictedUntil: releaseAt,
      warning: `Bạn đã tự huỷ ${count} đơn trong ${cfg.windowDays} ngày nên tạm thời chưa đặt được đơn mới. Bạn có thể đặt lại từ ${fmt(releaseAt)}.`,
    };
  }

  // Lần huỷ sắp tới sẽ là lần thứ count + 1
  const next = count + 1;
  if (next >= cfg.warnAt) {
    return {
      ...base,
      restricted: false,
      warning:
        next >= cfg.limit
          ? `Đây là lần huỷ thứ ${next} trong ${cfg.windowDays} ngày. Sau lần này, tài khoản sẽ tạm thời không đặt được đơn mới.`
          : `Bạn đã huỷ ${count} đơn trong ${cfg.windowDays} ngày. Huỷ từ ${cfg.limit} đơn, tài khoản sẽ tạm bị hạn chế đặt đơn.`,
    };
  }
  return { ...base, restricted: false };
}
