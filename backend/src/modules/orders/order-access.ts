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
