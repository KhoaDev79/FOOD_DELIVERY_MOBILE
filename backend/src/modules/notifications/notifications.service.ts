import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CancelReason, FailedDeliveryReason, OrderStatus, Prisma } from '@prisma/client';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { CANCEL_REASON_LABELS, FAILED_DELIVERY_REASON_LABELS } from '../orders/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';
import { ListNotificationsQueryDto } from './dto/notifications.dto';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

const CUSTOMER_STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Nhà hàng đã xác nhận đơn của bạn',
  PREPARING: 'Nhà hàng đang chuẩn bị món',
  READY_FOR_PICKUP: 'Món đã sẵn sàng, chờ tài xế đến lấy',
  PICKED_UP: 'Tài xế đã lấy món và đang giao đến bạn',
  DELIVERED: 'Đơn hàng đã được giao thành công. Chúc ngon miệng!',
  DELIVERY_FAILED: 'Đơn hàng giao không thành công',
  CANCELLED: 'Đơn hàng đã bị hủy',
};

/**
 * Gửi và lưu trữ Thông báo (Push qua Expo, Realtime Socket và Lưu Database).
 * Mọi hàm thông báo đều "fire-and-forget": không bao giờ throw để không làm hỏng luồng nghiệp vụ.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => OrdersGateway))
    private readonly gateway?: OrdersGateway,
  ) {
    this.expo = new Expo({ accessToken: config.get<string>('expo.accessToken') });
  }

  notifyOrderCreated(order: { id: string; total: number; restaurant: { ownerId: string; name: string } }) {
    return this.sendToUsers([order.restaurant.ownerId], {
      title: '🔔 Đơn hàng mới!',
      body: `Quán ${order.restaurant.name} có đơn mới trị giá ${order.total.toLocaleString('vi-VN')}đ`,
      data: { type: 'order', orderId: order.id },
      channelId: 'order_alerts',
      priority: 'high',
    });
  }

  notifyPendingOrderReminder(order: { id: string; total: number; restaurant: { ownerId: string; name: string } }) {
    return this.sendToUsers([order.restaurant.ownerId], {
      title: '⚠️ Đơn hàng mới chưa xác nhận!',
      body: `Đơn #${order.id.slice(0, 8).toUpperCase()} (${order.total.toLocaleString('vi-VN')}đ) đang chờ quán xác nhận. Vui lòng mở ứng dụng xử lý ngay!`,
      data: { type: 'order_reminder', orderId: order.id },
      channelId: 'order_alerts',
      priority: 'high',
    });
  }

  notifyStatusChanged(order: {
    id: string;
    customerId: string;
    driverId?: string | null;
    status: OrderStatus;
    cancelReason?: CancelReason | null;
    cancelNote?: string | null;
    failedReason?: FailedDeliveryReason | null;
    restaurant: { ownerId?: string; name: string };
  }) {
    const tasks: Promise<void>[] = [];

    if (order.status === 'CANCELLED') {
      const isTimeout = order.cancelReason === CancelReason.RESTAURANT_TIMEOUT;
      const reasonText = order.cancelReason ? CANCEL_REASON_LABELS[order.cancelReason] : 'Đơn đã bị huỷ';
      const customerBody = isTimeout
        ? 'Quán chưa xác nhận kịp, đơn đã được huỷ'
        : `Đơn hàng đã bị hủy: ${reasonText}`;

      tasks.push(
        this.sendToUsers([order.customerId], {
          title: order.restaurant.name,
          body: customerBody,
          data: { type: 'order', orderId: order.id, status: order.status },
        }),
      );
      if (isTimeout && order.restaurant.ownerId) {
        tasks.push(
          this.sendToUsers([order.restaurant.ownerId], {
            title: 'Đơn hàng quá hạn xác nhận',
            body: `Đơn #${order.id.slice(0, 8).toUpperCase()} đã tự động bị huỷ do quá thời gian xác nhận`,
            data: { type: 'order', orderId: order.id, status: order.status },
          }),
        );
      }
      if (order.driverId) {
        tasks.push(
          this.sendToUsers([order.driverId], {
            title: 'Đơn hàng đã bị hủy',
            body: `Đơn #${order.id.slice(0, 8).toUpperCase()} đã bị huỷ: ${reasonText}`,
            data: { type: 'order', orderId: order.id, status: order.status },
          }),
        );
      }
      return Promise.all(tasks).then(() => undefined);
    }

    if (order.status === 'DELIVERY_FAILED') {
      const failedText = order.failedReason ? FAILED_DELIVERY_REASON_LABELS[order.failedReason] : 'Giao thất bại';
      tasks.push(
        this.sendToUsers([order.customerId], {
          title: order.restaurant.name,
          body: `Đơn hàng giao không thành công: ${failedText}`,
          data: { type: 'order', orderId: order.id, status: order.status },
        }),
      );
      if (order.restaurant.ownerId) {
        tasks.push(
          this.sendToUsers([order.restaurant.ownerId], {
            title: 'Đơn hàng giao thất bại',
            body: `Đơn #${order.id.slice(0, 8).toUpperCase()} giao không thành công: ${failedText}`,
            data: { type: 'order', orderId: order.id, status: order.status },
          }),
        );
      }
      return Promise.all(tasks).then(() => undefined);
    }

    const body = CUSTOMER_STATUS_MESSAGES[order.status];
    if (!body) return Promise.resolve();
    return this.sendToUsers([order.customerId], {
      title: order.restaurant.name,
      body,
      data: { type: 'order', orderId: order.id, status: order.status },
    });
  }

  notifyDriverAssigned(order: { id: string; customerId: string; driver: { fullName: string } | null }) {
    return this.sendToUsers([order.customerId], {
      title: 'Đã có tài xế nhận đơn',
      body: `${order.driver?.fullName ?? 'Tài xế'} sẽ giao đơn hàng của bạn`,
      data: { type: 'order', orderId: order.id },
    });
  }

  notifyDriverReleased(order: { id: string; customerId: string; restaurant: { name: string } }) {
    return this.sendToUsers([order.customerId], {
      title: order.restaurant.name,
      body: 'Đang tìm tài xế khác cho đơn hàng của bạn',
      data: { type: 'order', orderId: order.id },
    });
  }

  notifyDriverArrived(order: { id: string; customerId: string; restaurant: { name: string } }) {
    return this.sendToUsers([order.customerId], {
      title: 'Tài xế đã đến điểm giao',
      body: 'Tài xế đã đến điểm giao hàng, vui lòng chuẩn bị nhận món',
      data: { type: 'order', orderId: order.id },
    });
  }

  notifyDriversOrderAvailable(
    driverIds: string[],
    order: { id: string; deliveryFee: number; driverEarning?: number; restaurant: { name: string } },
  ) {
    if (!driverIds.length) return Promise.resolve();
    const earning = order.driverEarning ?? order.deliveryFee;
    return this.sendToUsers(driverIds, {
      title: 'Chuyến giao mới gần bạn',
      body: `Đơn từ ${order.restaurant.name} - Thu nhập ${earning.toLocaleString('vi-VN')}đ`,
      data: { type: 'order_available', orderId: order.id },
    });
  }

  notifyDriverAutoOffline(driverIds: string[]) {
    if (!driverIds.length) return Promise.resolve();
    return this.sendToUsers(driverIds, {
      title: 'Chuyển sang ngoại tuyến',
      body: 'Bạn đã được chuyển ngoại tuyến do mất tín hiệu định vị',
      data: { type: 'driver_offline' },
    });
  }

  notifyOrderTimeoutCancelled(order: {
    id: string;
    customerId: string;
    restaurant: { ownerId: string; name: string };
  }) {
    return Promise.all([
      this.sendToUsers([order.customerId], {
        title: order.restaurant.name,
        body: 'Quán chưa xác nhận kịp, đơn đã được huỷ',
        data: { type: 'order', orderId: order.id, status: 'CANCELLED' },
      }),
      this.sendToUsers([order.restaurant.ownerId], {
        title: 'Đơn hàng quá hạn xác nhận',
        body: `Đơn #${order.id.slice(0, 8).toUpperCase()} đã tự động bị huỷ do quá thời gian xác nhận`,
        data: { type: 'order', orderId: order.id, status: 'CANCELLED' },
      }),
    ]).then(() => undefined);
  }

  notifyReviewReplied(review: {
    id: string;
    orderId: string;
    customerId: string;
    restaurantId?: string;
    restaurantName: string;
  }) {
    return this.sendToUsers([review.customerId], {
      title: `${review.restaurantName} đã phản hồi đánh giá`,
      body: 'Nhà hàng vừa gửi phản hồi cho đánh giá đơn hàng của bạn',
      data: {
        type: 'review_reply',
        reviewId: review.id,
        orderId: review.orderId,
        restaurantId: review.restaurantId,
        restaurantName: review.restaurantName,
      },
    });
  }

  notifyPaymentSucceeded(order: { id: string; customerId: string; total: number; restaurant: { ownerId: string } }) {
    return Promise.all([
      this.sendToUsers([order.customerId], {
        title: 'Thanh toán thành công',
        body: `Đã thanh toán ${order.total.toLocaleString('vi-VN')}đ qua VNPay`,
        data: { type: 'order', orderId: order.id },
      }),
      this.sendToUsers([order.restaurant.ownerId], {
        title: 'Đơn hàng mới (đã thanh toán)',
        body: `Đơn ${order.total.toLocaleString('vi-VN')}đ đã thanh toán VNPay, vui lòng xác nhận`,
        data: { type: 'order', orderId: order.id },
      }),
    ]).then(() => undefined);
  }

  /**
   * Lưu thông báo vào CSDL, phát socket realtime và gửi push Expo tới người dùng
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    const validUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!validUserIds.length) return;

    // 1. Lưu bản ghi Notification vào database (gộp thông báo chat chưa đọc cùng hội thoại) & phát Socket.IO
    const isOrderChat =
      payload.data?.type === 'order_chat' &&
      typeof payload.data?.orderId === 'string' &&
      typeof payload.data?.channel === 'string';

    await Promise.all(
      validUserIds.map(async (userId) => {
        try {
          let record = null;

          if (isOrderChat && typeof this.prisma.notification.findMany === 'function') {
            const unreadChats = await this.prisma.notification.findMany({
              where: { userId, type: 'order_chat', readAt: null },
              orderBy: { createdAt: 'desc' },
              take: 20,
            });
            const existing = (unreadChats ?? []).find((n) => {
              const d = n.data as Record<string, unknown> | null;
              return d?.orderId === payload.data?.orderId && d?.channel === payload.data?.channel;
            });

            if (existing && typeof this.prisma.notification.update === 'function') {
              const prevData = (existing.data as Record<string, unknown> | null) ?? {};
              const prevCount = Number(prevData.unreadCount ?? 1);
              const nextData = {
                ...prevData,
                ...payload.data,
                unreadCount: prevCount + 1,
              };
              record = await this.prisma.notification.update({
                where: { id: existing.id },
                data: {
                  title: payload.title,
                  body: payload.body,
                  data: nextData as Prisma.InputJsonValue,
                  createdAt: new Date(),
                },
              });
            }
          }

          if (!record) {
            const initialData = isOrderChat ? { ...payload.data, unreadCount: 1 } : payload.data;
            record = await this.prisma.notification.create({
              data: {
                userId,
                type: (payload.data?.type as string) || 'system',
                title: payload.title,
                body: payload.body,
                data: initialData ? (initialData as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            });
          }

          this.gateway?.emitNotification(userId, record);
        } catch (err) {
          this.logger.warn(`Lưu thông báo database thất bại cho user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );

    // 2. Gửi Expo Push Notification nếu user có token
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: validUserIds }, expoPushToken: { not: null } },
        select: { id: true, expoPushToken: true },
      });
      const messages: ExpoPushMessage[] = users
        .filter((u) => Expo.isExpoPushToken(u.expoPushToken))
        .map((u) => ({
          to: u.expoPushToken as string,
          sound: payload.sound !== undefined ? payload.sound : 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data,
          channelId: payload.channelId || 'orders',
          priority: payload.priority || 'high',
        }));
      if (!messages.length) return;

      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        await this.handleTickets(chunk, tickets);
      }
    } catch (err) {
      this.logger.warn(`Push notification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Lấy danh sách thông báo của người dùng có phân trang */
  async list(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    };
  }

  /** Lấy số lượng thông báo chưa đọc */
  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { unreadCount };
  }

  /** Đánh dấu một thông báo là đã đọc */
  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }
    if (notification.readAt) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /** Xoá một thông báo */
  async delete(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }
    await this.prisma.notification.delete({
      where: { id },
    });
    return { success: true };
  }

  /** Đánh dấu tất cả thông báo của người dùng là đã đọc */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  /**
   * Đồng bộ trạng thái đã đọc cho thông báo tin nhắn đơn hàng (`order_chat`)
   * khi người dùng mở trực tiếp cuộc trò chuyện trong màn Chat.
   */
  async markOrderChatNotificationsAsRead(userId: string, orderId: string, channel?: string): Promise<number> {
    try {
      const unreadChats = await this.prisma.notification.findMany({
        where: { userId, type: 'order_chat', readAt: null },
        select: { id: true, data: true },
      });
      const matchingIds = (unreadChats ?? [])
        .filter((n) => {
          const d = n.data as Record<string, unknown> | null;
          return d?.orderId === orderId && (!channel || d?.channel === channel);
        })
        .map((n) => n.id);
      if (!matchingIds.length) return 0;

      const result = await this.prisma.notification.updateMany({
        where: { id: { in: matchingIds }, userId, readAt: null },
        data: { readAt: new Date() },
      });
      return result.count;
    } catch (err) {
      this.logger.warn(
        `Đồng bộ đã đọc thông báo chat thất bại cho user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }

  /** Dọn dẹp các thông báo cũ hơn N ngày (mặc định 90 ngày) */
  async cleanOldNotifications(days = 90) {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.notification.deleteMany({
      where: { createdAt: { lt: threshold } },
    });
    this.logger.log(`Đã dọn dẹp ${result.count} thông báo cũ hơn ${days} ngày`);
    return result.count;
  }

  /** Token không còn hợp lệ (app bị gỡ) -> xóa để lần sau không gửi nữa. */
  private async handleTickets(messages: ExpoPushMessage[], tickets: ExpoPushTicket[]) {
    const invalidTokens: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(messages[i].to as string);
        else this.logger.warn(`Expo push error: ${ticket.message}`);
      }
    });
    if (invalidTokens.length) {
      await this.prisma.user.updateMany({
        where: { expoPushToken: { in: invalidTokens } },
        data: { expoPushToken: null },
      });
    }
  }
}
