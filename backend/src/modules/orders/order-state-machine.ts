import { OrderStatus } from '@prisma/client';

export type OrderActor = 'CUSTOMER' | 'OWNER' | 'DRIVER' | 'ADMIN';

/** Đồ thị chuyển trạng thái hợp lệ của đơn hàng. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP'],
  READY_FOR_PICKUP: ['PICKED_UP'],
  PICKED_UP: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Ai được phép đẩy đơn sang trạng thái đích nào. */
const ACTOR_TARGETS: Record<Exclude<OrderActor, 'ADMIN'>, OrderStatus[]> = {
  OWNER: ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
  DRIVER: ['PICKED_UP', 'DELIVERED'],
  CUSTOMER: ['CANCELLED'],
};

export const isValidTransition = (from: OrderStatus, to: OrderStatus) =>
  ORDER_TRANSITIONS[from].includes(to);

export function actorMayTransition(actor: OrderActor, from: OrderStatus, to: OrderStatus): boolean {
  if (!isValidTransition(from, to)) return false;
  if (actor === 'ADMIN') return true;
  if (!ACTOR_TARGETS[actor].includes(to)) return false;
  // Khách chỉ được hủy khi quán chưa xác nhận
  if (actor === 'CUSTOMER') return from === 'PENDING';
  return true;
}

/** Trạng thái mà tài xế có thể nhận đơn (đơn chưa có tài xế). */
export const DRIVER_ACCEPTABLE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];
