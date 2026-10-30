import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CancelReason, FailedDeliveryReason, OrderStatus } from '@prisma/client';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { CANCEL_REASON_LABELS, FAILED_DELIVERY_REASON_LABELS } from '../orders/order-state-machine';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
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
 * Gửi Expo Push Notification.
 * Mọi hàm public đều "fire-and-forget": không bao giờ throw để không làm hỏng luồng nghiệp vụ.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo: Expo;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.expo = new Expo({ accessToken: config.get<string>('expo.accessToken') });
  }

  notifyOrderCreated(order: { id: string; total: number; restaurant: { ownerId: string; name: string } }) {
    return this.sendToUsers([order.restaurant.ownerId], {
      title: 'Đơn hàng mới',
      body: `Bạn có đơn mới trị giá ${order.total.toLocaleString('vi-VN')}đ`,
      data: { type: 'order', orderId: order.id },
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

  notifyReviewReplied(review: { id: string; orderId: string; customerId: string; restaurantName: string }) {
    return this.sendToUsers([review.customerId], {
      title: `${review.restaurantName} đã phản hồi đánh giá`,
      body: 'Nhà hàng vừa gửi phản hồi cho đánh giá đơn hàng của bạn',
      data: { type: 'review_reply', reviewId: review.id, orderId: review.orderId },
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

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds }, expoPushToken: { not: null } },
        select: { id: true, expoPushToken: true },
      });
      const messages: ExpoPushMessage[] = users
        .filter((u) => Expo.isExpoPushToken(u.expoPushToken))
        .map((u) => ({
          to: u.expoPushToken as string,
          sound: 'default',
          title: payload.title,
          body: payload.body,
          data: payload.data,
          channelId: 'orders',
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
