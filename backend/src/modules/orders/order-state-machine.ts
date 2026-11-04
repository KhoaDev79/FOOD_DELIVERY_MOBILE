import { CancelReason, FailedDeliveryReason, OrderStatus } from '@prisma/client';
import { CUSTOMER_CANCEL_REASON_VALUES } from './cancel-policy';

export type OrderActor = 'CUSTOMER' | 'OWNER' | 'DRIVER' | 'ADMIN' | 'SYSTEM';

/** Đồ thị chuyển trạng thái hợp lệ của đơn hàng (V4). */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'],
  DELIVERED: [],
  DELIVERY_FAILED: [],
  CANCELLED: [],
};

/** Ai được phép đẩy đơn sang trạng thái đích nào. */
const ACTOR_TARGETS: Record<Exclude<OrderActor, 'ADMIN'>, OrderStatus[]> = {
  OWNER: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
  DRIVER: ['PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'],
  CUSTOMER: ['CANCELLED'],
  SYSTEM: ['CANCELLED'],
};

export const isValidTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  ORDER_TRANSITIONS[from].includes(to);

export function actorMayTransition(
  actor: OrderActor,
  from: OrderStatus,
  to: OrderStatus,
  cancelReason?: CancelReason,
): boolean {
  if (!isValidTransition(from, to)) return false;

  if (actor === 'ADMIN') {
    return true;
  }

  if (!ACTOR_TARGETS[actor].includes(to)) return false;

  if (actor === 'CUSTOMER') {
    return from === 'PENDING' && to === 'CANCELLED';
  }

  if (actor === 'SYSTEM') {
    return from === 'PENDING' && to === 'CANCELLED';
  }

  if (actor === 'OWNER' && to === 'CANCELLED') {
    if (from === 'PENDING' || from === 'CONFIRMED') return true;
    if (from === 'PREPARING') {
      return cancelReason === undefined || cancelReason === CancelReason.RESTAURANT_OUT_OF_STOCK;
    }
    return false;
  }

  return true;
}

/**
 * Kiểm tra tính hợp lệ của lý do huỷ đơn (`cancelReason` & `cancelNote`) theo từng Actor và trạng thái hiện tại.
 * Trả về thông báo lỗi tiếng Việt nếu không hợp lệ, hoặc `null` nếu hợp lệ.
 */
export function validateCancellationInput(
  actor: OrderActor,
  from: OrderStatus,
  cancelReason?: CancelReason,
  cancelNote?: string,
): string | null {
  if (!cancelReason) {
    return 'Vui lòng chọn lý do huỷ đơn hàng';
  }

  if (actor === 'CUSTOMER') {
    if (!CUSTOMER_CANCEL_REASON_VALUES.includes(cancelReason)) {
      return 'Lý do huỷ đơn của khách hàng không hợp lệ';
    }
    if (cancelReason === CancelReason.CUSTOMER_OTHER && (cancelNote?.trim().length ?? 0) < 5) {
      return 'Vui lòng ghi rõ lý do huỷ (ít nhất 5 ký tự)';
    }
    return null;
  }

  if (actor === 'OWNER') {
    if (from === 'PREPARING') {
      if (cancelReason !== CancelReason.RESTAURANT_OUT_OF_STOCK) {
        return 'Khi đang chuẩn bị món, quán chỉ có thể huỷ đơn với lý do hết món (RESTAURANT_OUT_OF_STOCK)';
      }
      return null;
    }
    const allowedOwnerReasons: CancelReason[] = [
      CancelReason.RESTAURANT_OUT_OF_STOCK,
      CancelReason.RESTAURANT_CLOSED,
      CancelReason.RESTAURANT_OTHER,
    ];
    if (!allowedOwnerReasons.includes(cancelReason)) {
      return 'Lý do huỷ đơn của nhà hàng không hợp lệ';
    }
    return null;
  }

  if (actor === 'ADMIN') {
    if (cancelReason !== CancelReason.ADMIN_INTERVENTION) {
      return 'Quản trị viên huỷ đơn phải dùng lý do ADMIN_INTERVENTION';
    }
    if (!cancelNote || !cancelNote.trim()) {
      return 'Quản trị viên bắt buộc phải nhập ghi chú (cancelNote) khi huỷ đơn';
    }
    return null;
  }

  if (actor === 'SYSTEM') {
    if (cancelReason !== CancelReason.RESTAURANT_TIMEOUT) {
      return 'Hệ thống tự động huỷ đơn phải dùng lý do RESTAURANT_TIMEOUT';
    }
    return null;
  }

  return 'Tài xế không được phép tự huỷ đơn hàng';
}

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  CUSTOMER_CHANGED_MIND: 'Khách hàng đổi ý',
  CUSTOMER_WRONG_ITEMS: 'Khách đặt nhầm món / số lượng',
  CUSTOMER_WRONG_ADDRESS: 'Khách nhập sai địa chỉ',
  CUSTOMER_WAIT_TOO_LONG: 'Khách chờ quán xác nhận quá lâu',
  CUSTOMER_FOUND_ALTERNATIVE: 'Khách chọn quán khác',
  CUSTOMER_OTHER: 'Khách huỷ vì lý do khác',
  RESTAURANT_OUT_OF_STOCK: 'Nhà hàng hết món / nguyên liệu',
  RESTAURANT_CLOSED: 'Nhà hàng đóng cửa đột xuất',
  RESTAURANT_OTHER: 'Nhà hàng quá tải / lý do khác',
  RESTAURANT_TIMEOUT: 'Quán không xác nhận đơn đúng hạn',
  ADMIN_INTERVENTION: 'Hệ thống hỗ trợ can thiệp huỷ đơn',
};

export const FAILED_DELIVERY_REASON_LABELS: Record<FailedDeliveryReason, string> = {
  CUSTOMER_UNREACHABLE: 'Không liên lạc được với khách hàng',
  CUSTOMER_REFUSED: 'Khách hàng từ chối nhận món',
  WRONG_ADDRESS: 'Sai địa chỉ giao hàng',
  UNSAFE_LOCATION: 'Khu vực giao hàng không an toàn / không vào được',
};

/** Trạng thái mà tài xế có thể nhận đơn (đơn chưa có tài xế). */
export const DRIVER_ACCEPTABLE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];
