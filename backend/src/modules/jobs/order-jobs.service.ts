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
}

