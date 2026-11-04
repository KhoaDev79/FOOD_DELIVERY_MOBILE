import { OrderStatus, Role } from '../types/api';

/** Người đổi trạng thái đơn (backend admin trả kèm từng dòng lịch sử). */
export interface HistoryActor {
  id: string;
  fullName: string;
  role: Role;
}

/**
 * Câu "ai làm" cho một bước trong dòng thời gian đơn: "Quán ZomZom", "Tài xế Ryan",
 * "Khách Lan", "Admin Khoa", hoặc "Hệ thống tự động" khi không có người (cron, hết hạn…).
 * Chủ quán hiện theo tên quán vì với vận hành thì "quán nào" quan trọng hơn "ai trong quán".
 */
export function describeHistoryActor(actor: HistoryActor | null | undefined, restaurantName?: string | null): string {
  if (!actor) return 'Hệ thống tự động';
  switch (actor.role) {
    case 'RESTAURANT_OWNER':
      return restaurantName ? `Quán ${restaurantName}` : `Chủ quán ${actor.fullName}`;
    case 'DRIVER':
      return `Tài xế ${actor.fullName}`;
    case 'CUSTOMER':
      return `Khách ${actor.fullName}`;
    case 'ADMIN':
      return `Admin ${actor.fullName}`;
    default:
      return actor.fullName;
  }
}

/** Tên bước tiếng Việt dùng ở dòng thời gian và dòng "Kẹt x phút ở bước …". */
export const ORDER_STEP_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ quán nhận',
  CONFIRMED: 'Quán đã nhận',
  PREPARING: 'Đang làm món',
  READY_FOR_PICKUP: 'Chờ tài xế',
  PICKED_UP: 'Đang giao',
  DELIVERED: 'Giao thành công',
  DELIVERY_FAILED: 'Giao thất bại',
  CANCELLED: 'Đã huỷ',
};

/**
 * Thời gian chuẩn (phút) tối đa để đơn ở lại mỗi bước; quá thì tô cam, quá gấp đôi thì tô đỏ.
 * Khớp ngưỡng phát hiện ứ đọng của backend (chờ tài xế 10 phút, quán làm món 20 phút).
 */
export const STEP_SLA_MINUTES: Partial<Record<OrderStatus, number>> = {
  PENDING: 5,
  CONFIRMED: 10,
  PREPARING: 20,
  READY_FOR_PICKUP: 10,
  PICKED_UP: 30,
};

export type StepHealth = 'ok' | 'slow' | 'late';

/** Đánh giá một bước đã kéo dài bao lâu so với chuẩn. */
export function stepHealth(status: OrderStatus, minutes: number): StepHealth {
  const sla = STEP_SLA_MINUTES[status];
  if (!sla) return 'ok';
  if (minutes > sla * 2) return 'late';
  if (minutes > sla) return 'slow';
  return 'ok';
}

/** Số phút (làm tròn xuống, không âm) giữa hai thời điểm ISO. */
export function minutesBetween(fromIso: string, to: string | Date): number {
  const end = typeof to === 'string' ? new Date(to).getTime() : to.getTime();
  return Math.max(0, Math.floor((end - new Date(fromIso).getTime()) / 60000));
}

/** "12 phút", "1 giờ 5 phút"; từ 1 ngày trở lên chỉ còn số ngày ("hơn 4 ngày") cho dễ đọc. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60));
    return minutes % (24 * 60) ? `hơn ${days} ngày` : `${days} ngày`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/** "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; quá 7 ngày thì hiện ngày dd/mm. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} giờ trước`;
  if (min < 7 * 24 * 60) return `${Math.floor(min / (24 * 60))} ngày trước`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
