import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
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
      title: 'Đơn hàng mới 🛎️',
      body: `Bạn có đơn mới trị giá ${order.total.toLocaleString('vi-VN')}đ`,
      data: { type: 'order', orderId: order.id },
    });
  }

  notifyStatusChanged(order: { id: string; customerId: string; status: OrderStatus; restaurant: { name: string } }) {
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
      title: 'Đã có tài xế nhận đơn 🛵',
      body: `${order.driver?.fullName ?? 'Tài xế'} sẽ giao đơn hàng của bạn`,
      data: { type: 'order', orderId: order.id },
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
        title: 'Đơn hàng mới (đã thanh toán) 🛎️',
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

