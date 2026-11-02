import type { IconName } from '../components/ui';
import { OrderStatus } from '../types/api';
import { estimateDeliveryTime } from './fee';

/**
 * Tiến trình đơn phía khách: dùng chung cho danh sách "Đơn hàng của tôi" và màn "Theo dõi đơn"
 * để số bước, tên bước và giờ dự kiến luôn khớp nhau.
 */
export const CUSTOMER_STEPS: { label: string; icon: IconName }[] = [
  { label: 'Đã đặt', icon: 'receipt-outline' },
  { label: 'Quán làm món', icon: 'restaurant-outline' },
  { label: 'Đang giao', icon: 'bicycle-outline' },
  { label: 'Đã giao', icon: 'home-outline' },
];

export function customerStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'PICKED_UP':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return 1; // CONFIRMED, PREPARING, READY_FOR_PICKUP
  }
}

/** Câu trạng thái dễ hiểu cho khách (thay cho nhãn kỹ thuật). */
export function customerHeadline(status: OrderStatus): { title: string; subtitle: string; icon: IconName } {
  switch (status) {
    case 'PENDING':
      return { title: 'Đang chờ quán xác nhận', subtitle: 'Quán sẽ xác nhận đơn trong ít phút', icon: 'hourglass-outline' };
    case 'CONFIRMED':
      return { title: 'Quán đã nhận đơn', subtitle: 'Quán sắp bắt đầu làm món cho bạn', icon: 'checkmark-circle-outline' };
    case 'PREPARING':
      return { title: 'Quán đang chuẩn bị món', subtitle: 'Món ngon sắp xong rồi', icon: 'restaurant-outline' };
    case 'READY_FOR_PICKUP':
      return { title: 'Món đã xong, chờ tài xế lấy', subtitle: 'Tài xế đang trên đường tới quán', icon: 'bag-check-outline' };
    case 'PICKED_UP':
      return { title: 'Tài xế đang giao tới bạn', subtitle: 'Chuẩn bị nhận món nhé', icon: 'bicycle-outline' };
    case 'DELIVERED':
      return { title: 'Đã giao thành công', subtitle: 'Chúc bạn ngon miệng!', icon: 'checkmark-done-circle-outline' };
    case 'DELIVERY_FAILED':
      return { title: 'Giao hàng không thành công', subtitle: '', icon: 'alert-circle-outline' };
    default:
      return { title: 'Đơn hàng đã huỷ', subtitle: '', icon: 'close-circle-outline' };
  }
}

/** Giờ giao dự kiến: giờ cụ thể từ backend nếu có, không thì khoảng thời gian theo quãng đường. */
export function etaText(order: { estimatedDeliveryAt?: string | null; distanceKm?: number }): string {
  if (order.estimatedDeliveryAt) {
    const dt = new Date(order.estimatedDeliveryAt);
    return `khoảng ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }
  return estimateDeliveryTime(order.distanceKm);
}
