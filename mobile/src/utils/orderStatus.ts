import { CancelReason, FailedDeliveryReason, OrderStatus } from '../types/api';
import { colors } from '../constants/colors';

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bgColor: string; step: number }
> = {
  PENDING: {
    label: 'Chờ xác nhận',
    color: colors.warning,
    bgColor: '#FEF3C7',
    step: 0,
  },
  CONFIRMED: {
    label: 'Quán đã nhận',
    color: colors.info,
    bgColor: '#DBEAFE',
    step: 1,
  },
  PREPARING: {
    label: 'Đang làm món',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    step: 2,
  },
  READY_FOR_PICKUP: {
    label: 'Chờ tài xế lấy',
    color: colors.secondary,
    bgColor: '#CCFBF1',
    step: 3,
  },
  PICKED_UP: {
    label: 'Đang giao hàng',
    color: colors.primary,
    bgColor: colors.primaryLight,
    step: 4,
  },
  DELIVERED: {
    label: 'Giao thành công',
    color: colors.success,
    bgColor: '#D1FAE5',
    step: 5,
  },
  DELIVERY_FAILED: {
    label: 'Giao thất bại',
    color: colors.danger,
    bgColor: '#FEE2E2',
    step: -1,
  },
  CANCELLED: {
    label: 'Đã huỷ',
    color: colors.danger,
    bgColor: '#FEE2E2',
    step: -1,
  },
};

export function getOrderStatusRoleLabel(
  status: OrderStatus,
  role?: 'customer' | 'driver' | 'owner' | 'admin',
): string {
  if (role === 'owner' && status === 'PENDING') {
    return 'Đơn mới cần nhận';
  }
  if (role === 'driver') {
    if (status === 'CONFIRMED') return 'Quán đang làm món';
    if (status === 'READY_FOR_PICKUP') return 'Sẵn sàng lấy món';
  }
  return ORDER_STATUS_CONFIG[status]?.label ?? status;
}

export const ORDER_STEPS = [
  { key: 'PENDING', label: 'Chờ quán nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PREPARING', label: 'Đang làm món' },
  { key: 'READY_FOR_PICKUP', label: 'Chờ lấy' },
  { key: 'PICKED_UP', label: 'Đang giao' },
  { key: 'DELIVERED', label: 'Hoàn thành' },
];

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  CUSTOMER_CHANGED_MIND: 'Khách hàng đổi ý',
  RESTAURANT_OUT_OF_STOCK: 'Nhà hàng hết món / nguyên liệu',
  RESTAURANT_CLOSED: 'Nhà hàng đóng cửa đột xuất',
  RESTAURANT_OTHER: 'Lý do khác từ nhà hàng',
  RESTAURANT_TIMEOUT: 'Quán không xác nhận đơn đúng hạn',
  ADMIN_INTERVENTION: 'Hệ thống hỗ trợ can thiệp huỷ đơn',
};

export const FAILED_DELIVERY_REASON_LABELS: Record<FailedDeliveryReason, string> = {
  CUSTOMER_UNREACHABLE: 'Không liên lạc được với khách hàng',
  CUSTOMER_REFUSED: 'Khách hàng từ chối nhận món',
  WRONG_ADDRESS: 'Sai địa chỉ giao hàng',
  UNSAFE_LOCATION: 'Khu vực giao hàng không an toàn',
};

export function formatOrderEndReason(order: {
  status: OrderStatus;
  cancelReason?: CancelReason | null;
  failedReason?: FailedDeliveryReason | null;
  cancelNote?: string | null;
}): string | null {
  if (order.status === 'CANCELLED') {
    const label = order.cancelReason ? CANCEL_REASON_LABELS[order.cancelReason] : 'Đơn hàng đã bị huỷ';
    return order.cancelNote ? `${label} (${order.cancelNote})` : label;
  }
  if (order.status === 'DELIVERY_FAILED') {
    const label = order.failedReason ? FAILED_DELIVERY_REASON_LABELS[order.failedReason] : 'Giao không thành công';
    return order.cancelNote ? `${label} (${order.cancelNote})` : label;
  }
  return null;
}
