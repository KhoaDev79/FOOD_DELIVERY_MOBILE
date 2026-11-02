import { ChatChannel } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * Chat theo đơn tách thành 3 cuộc trò chuyện riêng, mỗi cuộc đúng 2 bên:
 *  - CUSTOMER_DRIVER:      khách ↔ tài xế
 *  - CUSTOMER_RESTAURANT:  khách ↔ quán
 *  - RESTAURANT_DRIVER:    quán ↔ tài xế
 * Bên thứ ba của đơn KHÔNG đọc được cuộc trò chuyện không có mình.
 * Kênh có tài xế luôn gắn với tài xế hiện tại của đơn: tài xế trả đơn thì tài xế mới không thấy tin cũ.
 */
export type ChatSide = 'CUSTOMER' | 'RESTAURANT' | 'DRIVER';

export const CHANNEL_SIDES: Record<ChatChannel, readonly [ChatSide, ChatSide]> = {
  CUSTOMER_DRIVER: ['CUSTOMER', 'DRIVER'],
  CUSTOMER_RESTAURANT: ['CUSTOMER', 'RESTAURANT'],
  RESTAURANT_DRIVER: ['RESTAURANT', 'DRIVER'],
};

export const channelHasDriver = (channel: ChatChannel) => CHANNEL_SIDES[channel].includes('DRIVER');

export interface ChatOrder {
  customerId: string;
  driverId: string | null;
  restaurant: { ownerId: string };
}

/** Người dùng đứng ở (những) phía nào của đơn. */
export function sidesOf(order: ChatOrder, userId: string): ChatSide[] {
  const sides: ChatSide[] = [];
  if (order.customerId === userId) sides.push('CUSTOMER');
  if (order.restaurant.ownerId === userId) sides.push('RESTAURANT');
  if (order.driverId && order.driverId === userId) sides.push('DRIVER');
  return sides;
}

const userIdOfSide = (order: ChatOrder, side: ChatSide): string | null =>
  side === 'CUSTOMER' ? order.customerId : side === 'RESTAURANT' ? order.restaurant.ownerId : order.driverId;

/** Kênh còn dùng được không: kênh có tài xế cần đơn đang có tài xế. */
export const channelIsOpen = (order: ChatOrder, channel: ChatChannel) =>
  !channelHasDriver(channel) || !!order.driverId;

/** Được gửi/đánh dấu đã đọc trong kênh: phải là một trong hai bên của kênh. */
export function canParticipate(order: ChatOrder, user: AuthUser, channel: ChatChannel): boolean {
  if (!channelIsOpen(order, channel)) return false;
  const mine = sidesOf(order, user.id);
  return CHANNEL_SIDES[channel].some((side) => mine.includes(side));
}

/** Được đọc kênh: hai bên của kênh, hoặc admin (hỗ trợ khiếu nại, chỉ đọc). */
export const canReadChannel = (order: ChatOrder, user: AuthUser, channel: ChatChannel) =>
  user.role === 'ADMIN' ? channelIsOpen(order, channel) : canParticipate(order, user, channel);

/** Người nhận tin trong kênh (bên còn lại, không gồm người gửi). */
export function channelRecipients(order: ChatOrder, channel: ChatChannel, senderId: string): string[] {
  return CHANNEL_SIDES[channel]
    .map((side) => userIdOfSide(order, side))
    .filter((id): id is string => !!id && id !== senderId);
}

/** Phía của người gửi trong kênh (dùng làm nhãn hiển thị). */
export function senderSideIn(order: ChatOrder, channel: ChatChannel, senderId: string): ChatSide | null {
  return CHANNEL_SIDES[channel].find((side) => userIdOfSide(order, side) === senderId) ?? null;
}
