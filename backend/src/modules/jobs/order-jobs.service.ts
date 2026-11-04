import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CancelReason, OrderStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ORDER_DETAIL_INCLUDE, OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersGateway } from '../realtime/orders.gateway';

const LOCK_PENDING_TIMEOUT = 404001;
const LOCK_STALLED_PICKUP = 404002;
const LOCK_STALE_DRIVERS = 404003;
const LOCK_PAUSED_RESTAURANTS = 404004;
const LOCK_CLEAN_NOTIFICATIONS = 404005;
const LOCK_PENDING_REMINDER = 404006;
const LOCK_CLOSE_STALE_TICKETS = 404007;
const LOCK_CLEAN_BOT_CONVERSATIONS = 404008;
const LOCK_RESTOCK_MENU_ITEMS = 404009;
/** Giữ hội thoại chatbot tối đa 90 ngày kể từ tin nhắn cuối (giảm dữ liệu cá nhân lưu trữ). */
export const BOT_CONVERSATION_RETENTION_DAYS = 90;
const BATCH_LIMIT = 100;

@Injectable()
export class OrderJobsService {
  private readonly logger = new Logger(OrderJobsService.name);
  private readonly runningFlags = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly orders: OrdersService,
    private readonly gateway: OrdersGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Khoá chống chạy chồng:
   * 1. Biến cờ trong tiến trình (in-process flag)
   * 2. pg_try_advisory_lock trên PostgreSQL để an toàn khi chạy nhiều instance
   */
  private async runWithLock(
    lockId: number,
    flagKey: string,
    task: () => Promise<void>,
  ): Promise<void> {
    if (this.runningFlags.get(flagKey)) {
      return;
    }
    this.runningFlags.set(flagKey, true);

    let acquiredDbLock = false;
    try {
      const rows = await this.prisma.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockId}) AS locked
      `;
      if (Array.isArray(rows) && rows.length > 0 && rows[0].locked === false) {
        return;
      }
      acquiredDbLock = true;
      await task();
    } catch (err) {
      this.logger.warn(
        `Cron job [${flagKey}] gặp lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      if (acquiredDbLock) {
        await this.prisma.$queryRaw`
          SELECT pg_advisory_unlock(${lockId})
        `.catch(() => undefined);
      }
      this.runningFlags.set(flagKey, false);
    }
  }

  /**
   * E1.1: Tự động huỷ các đơn PENDING quá ORDER_PENDING_TIMEOUT_MINUTES chưa được quán xác nhận.
   * - Actor: SYSTEM, cancelReason: RESTAURANT_TIMEOUT
   * - Xử lý theo lô <= 100 đơn/lần
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredPendingOrders(): Promise<number> {
    let cancelledCount = 0;
    await this.runWithLock(LOCK_PENDING_TIMEOUT, 'expired_pending', async () => {
      const timeoutMinutes = Number(
        this.config.get<number>('business.orderPendingTimeoutMinutes') ?? 5,
      );
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

      const expiredOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: { lt: cutoff },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_LIMIT,
      });

      for (const item of expiredOrders) {
        try {
          await this.orders.updateStatus(item.id, 'SYSTEM', {
            status: OrderStatus.CANCELLED,
            cancelReason: CancelReason.RESTAURANT_TIMEOUT,
          });
          cancelledCount++;
        } catch {
          // Bỏ qua nếu đơn vừa được quán xác nhận hoặc huỷ bởi luồng khác
        }
      }
    });
    return cancelledCount;
  }

  /**
   * Chức năng #10: Nhắc nhở đơn hàng PENDING chưa được quán xác nhận:
   * - Tìm các đơn PENDING đã chờ quá ORDER_PENDING_REMINDER_MINUTES (mặc định 2 phút)
   * - Nhưng chưa quá ORDER_PENDING_TIMEOUT_MINUTES (mặc định 5 phút)
   * - Gửi push nhắc nhở khẩn cấp kèm âm thanh chuông tới chủ quán nếu chưa từng gửi nhắc nhở
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingOrderReminders(): Promise<number> {
    let remindedCount = 0;
    await this.runWithLock(LOCK_PENDING_REMINDER, 'pending_reminders', async () => {
      const reminderMinutes = Number(
        this.config.get<number>('business.orderPendingReminderMinutes') ?? 2,
      );
      const timeoutMinutes = Number(
        this.config.get<number>('business.orderPendingTimeoutMinutes') ?? 5,
      );
      const now = Date.now();
      const reminderCutoff = new Date(now - reminderMinutes * 60 * 1000);
      const timeoutCutoff = new Date(now - timeoutMinutes * 60 * 1000);

      const pendingOrders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          createdAt: {
            lte: reminderCutoff,
            gt: timeoutCutoff,
          },
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
          restaurant: {
            select: {
              name: true,
              ownerId: true,
            },
          },
        },
        take: BATCH_LIMIT,
      });

      for (const order of pendingOrders) {
        try {
          const existingReminder = await this.prisma.notification.findFirst({
            where: {
              userId: order.restaurant.ownerId,
              type: 'order_reminder',
              data: {
                path: ['orderId'],
                equals: order.id,
              },
            },
            select: { id: true },
          });

          if (!existingReminder) {
            await this.notifications.notifyPendingOrderReminder(order);
            remindedCount++;
          }
        } catch {
          // Bỏ qua lỗi đơn lẻ
        }
      }
    });
    return remindedCount;
  }

  /**
   * E1.2: Phát hiện đơn ứ đọng chưa có tài xế nhận:
   * - Đơn READY_FOR_PICKUP quá ORDER_STALLED_PICKUP_MINUTES, hoặc CONFIRMED/PREPARING quá 20 phút
   * - Chưa có tài xế (driverId = null) và stalledAt = null
   * - Ghi stalledAt (chỉ 1 lần), phát socket order:stalled tới phòng admins, và phát lại order:available với bán kính x 2.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStalledOrders(): Promise<number> {
    let stalledCount = 0;
    await this.runWithLock(LOCK_STALLED_PICKUP, 'stalled_orders', async () => {
      const stalledPickupMinutes = Number(
        this.config.get<number>('business.orderStalledPickupMinutes') ?? 10,
      );
      const now = new Date();
      const readyCutoff = new Date(now.getTime() - stalledPickupMinutes * 60 * 1000);
      const preparingCutoff = new Date(now.getTime() - 20 * 60 * 1000);

      const candidates = await this.prisma.order.findMany({
        where: {
          driverId: null,
          stalledAt: null,
          OR: [
            {
              status: OrderStatus.READY_FOR_PICKUP,
              updatedAt: { lt: readyCutoff },
            },
            {
              status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
              createdAt: { lt: preparingCutoff },
            },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: BATCH_LIMIT,
      });

      for (const candidate of candidates) {
        const { count } = await this.prisma.order.updateMany({
          where: {
            id: candidate.id,
            driverId: null,
            stalledAt: null,
          },
          data: { stalledAt: now },
        });
        if (count === 0) continue;

        stalledCount++;
        const fullOrder = await this.prisma.order.findUnique({
          where: { id: candidate.id },
          include: ORDER_DETAIL_INCLUDE,
        });

        if (fullOrder) {
          this.gateway.emitOrderStalled({
            id: fullOrder.id,
            status: fullOrder.status,
            stalledAt: now.toISOString(),
            restaurantName: fullOrder.restaurant.name,
            total: fullOrder.total,
          });
          await this.orders.dispatchOrderAvailable(fullOrder, 2);
        }
      }
    });
    return stalledCount;
  }

  /**
   * E1.3 & D3: Tài xế trực tuyến nhưng mất tín hiệu định vị quá DRIVER_OFFLINE_AFTER_MINUTES
   * -> Tự chuyển isOnline = false và gửi push thông báo.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleOnlineDrivers(): Promise<number> {
    let offlinedCount = 0;
    await this.runWithLock(LOCK_STALE_DRIVERS, 'stale_drivers', async () => {
      const offlineMinutes = Number(
        this.config.get<number>('business.driverOfflineAfterMinutes') ?? 10,
      );
      const cutoff = new Date(Date.now() - offlineMinutes * 60 * 1000);

      const staleProfiles = await this.prisma.driverProfile.findMany({
        where: {
          isOnline: true,
          OR: [
            { lastLocationAt: { lt: cutoff } },
            { lastLocationAt: null, updatedAt: { lt: cutoff } },
          ],
        },
        select: { userId: true },
        take: BATCH_LIMIT,
      });

      if (staleProfiles.length === 0) return;

      const userIds = staleProfiles.map((p) => p.userId);
      const { count } = await this.prisma.driverProfile.updateMany({
        where: {
          userId: { in: userIds },
          isOnline: true,
        },
        data: { isOnline: false },
      });

      offlinedCount = count;
      if (count > 0) {
        await this.notifications.notifyDriverAutoOffline(userIds);
      }
    });
    return offlinedCount;
  }

  /**
   * Tự động dọn dẹp / mở lại quán khi đã hết mốc hẹn giờ tạm nghỉ (pausedUntil <= now).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredPausedRestaurants(): Promise<number> {
    let unpausedCount = 0;
    await this.runWithLock(LOCK_PAUSED_RESTAURANTS, 'paused_restaurants', async () => {
      const now = new Date();
      const result = await this.prisma.restaurant.updateMany({
        where: {
          pausedUntil: { lte: now, not: null },
        },
        data: {
          pausedUntil: null,
        },
      });
      unpausedCount = result.count;
      if (unpausedCount > 0) {
        this.logger.log(`Tự động mở lại ${unpausedCount} quán đã hết giờ tạm nghỉ.`);
      }
    });
    return unpausedCount;
  }
/**
   * Tự động xoá các thông báo cũ hơn 90 ngày vào 3:00 sáng mỗi ngày.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanOldNotifications(): Promise<number> {
    let cleanedCount = 0;
    await this.runWithLock(LOCK_CLEAN_NOTIFICATIONS, 'clean_notifications', async () => {
      cleanedCount = await this.notifications.cleanOldNotifications(90);
    });
    return cleanedCount;
  }

  /**
   * Tự động đóng phiếu hỗ trợ WAITING_CUSTOMER quá 72 giờ không có tin mới.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoCloseStaleTickets(): Promise<number> {
    let closedCount = 0;
    await this.runWithLock(LOCK_CLOSE_STALE_TICKETS, 'close_stale_tickets', async () => {
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      const staleTickets = await this.prisma.supportTicket.findMany({
        where: {
          status: 'WAITING_CUSTOMER',
          updatedAt: { lte: seventyTwoHoursAgo },
        },
        select: { id: true },
      });
      if (staleTickets.length > 0) {
        const res = await this.prisma.supportTicket.updateMany({
          where: { id: { in: staleTickets.map((t) => t.id) } },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
        closedCount = res.count;
        this.logger.log(`Tự động đóng ${closedCount} phiếu hỗ trợ quá hạn 72 giờ phản hồi.`);
      }
    });
    return closedCount;
  }

  /**
   * Xoá hội thoại chatbot không có tin nhắn nào trong 90 ngày, lúc 3:30 sáng mỗi ngày.
   * Xét theo tin nhắn cuối chứ không theo updatedAt, vì thêm tin mới không cập nhật hội thoại.
   * Tin nhắn bị xoá theo (onDelete: Cascade).
   */
  @Cron('30 3 * * *')
  async handleCleanOldBotConversations(): Promise<number> {
    let cleanedCount = 0;
    await this.runWithLock(LOCK_CLEAN_BOT_CONVERSATIONS, 'clean_bot_conversations', async () => {
      const threshold = new Date(Date.now() - BOT_CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const result = await this.prisma.botConversation.deleteMany({
        where: {
          createdAt: { lt: threshold },
          messages: { none: { createdAt: { gte: threshold } } },
        },
      });
      cleanedCount = result.count;
      if (cleanedCount > 0) {
        this.logger.log(`Đã xoá ${cleanedCount} hội thoại chatbot không hoạt động quá ${BOT_CONVERSATION_RETENTION_DAYS} ngày.`);
      }
    });
    return cleanedCount;
  }

  /**
   * Món "hết hôm nay" đến giờ hẹn (04:00 sáng) thì tự mở bán lại, báo realtime cho người đang xem quán.
   * Chạy mỗi phút; chỉ đụng món chưa bị xoá.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRestockMenuItems(now = new Date()): Promise<number> {
    let restocked = 0;
    await this.runWithLock(LOCK_RESTOCK_MENU_ITEMS, 'restock_menu_items', async () => {
      const due = await this.prisma.menuItem.findMany({
        where: { isAvailable: false, isArchived: false, soldOutUntil: { lte: now } },
        select: { id: true, restaurantId: true },
        take: 500,
      });
      if (due.length === 0) return;
      const res = await this.prisma.menuItem.updateMany({
        where: { id: { in: due.map((d) => d.id) }, isAvailable: false, soldOutUntil: { lte: now } },
        data: { isAvailable: true, soldOutUntil: null },
      });
      restocked = res.count;
      const byRestaurant = new Map<string, string[]>();
      for (const d of due) byRestaurant.set(d.restaurantId, [...(byRestaurant.get(d.restaurantId) ?? []), d.id]);
      for (const [restaurantId, ids] of byRestaurant) {
        this.gateway.emitMenuStock({ restaurantId, items: ids.map((id) => ({ id, isAvailable: true, soldOutUntil: null })) });
      }
      this.logger.log(`Tự mở bán lại ${restocked} món đã hết hôm qua.`);
    });
    return restocked;
  }
}
