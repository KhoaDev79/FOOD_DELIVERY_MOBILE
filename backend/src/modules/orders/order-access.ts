import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface OrderParticipants {
  customerId: string;
  driverId: string | null;
  restaurant: { ownerId: string };
}

/** Ai được xem đơn / tham gia phòng realtime của đơn. Dùng chung cho HTTP và WebSocket. */
export function canViewOrder(order: OrderParticipants, user: AuthUser): boolean {
  switch (user.role) {
    case 'ADMIN':
      return true;
    case 'CUSTOMER':
      return order.customerId === user.id;
    case 'RESTAURANT_OWNER':
      return order.restaurant.ownerId === user.id;
    case 'DRIVER':
      return order.driverId === user.id;
    default:
      return false;
  }
}

/** Ẩn số điện thoại khách/tài xế sau khi đơn kết thúc quá lâu (bảo vệ thông tin cá nhân). */
export const PHONE_VISIBLE_AFTER_FINISH_MS = 2 * 60 * 60 * 1000;

const FINISHED_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED']);

/** Đơn đã giao/huỷ/giao thất bại quá 2 giờ thì không còn cần liên lạc: ẩn số điện thoại. */
export function isPhoneHidden(status: string, finishedAt: Date, now = Date.now()): boolean {
  return FINISHED_STATUSES.has(status) && now - finishedAt.getTime() > PHONE_VISIBLE_AFTER_FINISH_MS;
}
