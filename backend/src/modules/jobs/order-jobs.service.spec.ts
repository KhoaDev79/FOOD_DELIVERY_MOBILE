import { CancelReason, OrderStatus } from '@prisma/client';
import { OrderJobsService } from './order-jobs.service';

describe('OrderJobsService (E1 Cron Jobs)', () => {
  let service: OrderJobsService;
  let prisma: {
    $queryRaw: jest.Mock;
    order: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    driverProfile: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    restaurant: {
      updateMany: jest.Mock;
    };
    notification: {
      findFirst: jest.Mock;
    };
    botConversation: {
      deleteMany: jest.Mock;
    };
    menuItem: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let config: { get: jest.Mock };
  let ordersService: {
    updateStatus: jest.Mock;
    dispatchOrderAvailable: jest.Mock;
  };
  let gateway: { emitOrderStalled: jest.Mock; emitMenuStock: jest.Mock };
  let notifications: {
    notifyDriverAutoOffline: jest.Mock;
    cleanOldNotifications: jest.Mock;
    notifyPendingOrderReminder: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      driverProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      restaurant: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      botConversation: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      menuItem: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, number> = {
          'business.orderPendingTimeoutMinutes': 5,
          'business.orderStalledPickupMinutes': 10,
          'business.driverOfflineAfterMinutes': 10,
        };
        return map[key];
      }),
    };

    ordersService = {
      updateStatus: jest.fn().mockResolvedValue({}),
      dispatchOrderAvailable: jest.fn().mockResolvedValue(['driver-1']),
    };

    gateway = {
      emitOrderStalled: jest.fn(),
      emitMenuStock: jest.fn(),
    };

    notifications = {
      notifyDriverAutoOffline: jest.fn().mockResolvedValue(undefined),
      cleanOldNotifications: jest.fn().mockResolvedValue(5),
      notifyPendingOrderReminder: jest.fn().mockResolvedValue(undefined),
    };

    service = new OrderJobsService(
      prisma as never,
      config as never,
      ordersService as never,
      gateway as never,
      notifications as never,
    );
  });

  describe('handleExpiredPendingOrders', () => {
    it('tự động huỷ đơn PENDING quá hạn với actor SYSTEM và lý do RESTAURANT_TIMEOUT', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'ord-expired-1' }, { id: 'ord-expired-2' }]);

      const count = await service.handleExpiredPendingOrders();

      expect(count).toBe(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: OrderStatus.PENDING,
          }),
        }),
      );
      expect(ordersService.updateStatus).toHaveBeenCalledWith('ord-expired-1', 'SYSTEM', {
        status: OrderStatus.CANCELLED,
        cancelReason: CancelReason.RESTAURANT_TIMEOUT,
      });
      expect(ordersService.updateStatus).toHaveBeenCalledWith('ord-expired-2', 'SYSTEM', {
        status: OrderStatus.CANCELLED,
        cancelReason: CancelReason.RESTAURANT_TIMEOUT,
      });
    });

    it('không huỷ nếu đơn đã được quán chuyển sang CONFIRMED (updateStatus ném lỗi thì bỏ qua an toàn)', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'ord-confirmed' }]);
      ordersService.updateStatus.mockRejectedValueOnce(new Error('Already confirmed'));

      const count = await service.handleExpiredPendingOrders();
      expect(count).toBe(0);
    });
  });

  describe('handleStalledOrders', () => {
    it('đánh dấu stalledAt đúng một lần, phát order:stalled cho admins và phát lại order:available với bán kính x2', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'ord-stalled-1' }]);
      prisma.order.findUnique.mockResolvedValue({
        id: 'ord-stalled-1',
        status: OrderStatus.READY_FOR_PICKUP,
        total: 85000,
        restaurant: { id: 'rest-1', name: 'Cơm Tấm Cali', latitude: 10.77, longitude: 106.7 },
      });

      const count = await service.handleStalledOrders();

      expect(count).toBe(1);
      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ord-stalled-1', driverId: null, stalledAt: null },
        }),
      );
      expect(gateway.emitOrderStalled).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ord-stalled-1',
          restaurantName: 'Cơm Tấm Cali',
        }),
      );
      expect(ordersService.dispatchOrderAvailable).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ord-stalled-1' }),
        2,
      );
    });

    it('bỏ qua nếu đơn đã được đánh dấu stalledAt hoặc đã có tài xế nhận trước đó (count = 0)', async () => {
      prisma.order.findMany.mockResolvedValue([{ id: 'ord-stalled-1' }]);
      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });

      const count = await service.handleStalledOrders();
      expect(count).toBe(0);
      expect(gateway.emitOrderStalled).not.toHaveBeenCalled();
    });
  });

  describe('handleStaleOnlineDrivers', () => {
    it('tự chuyển ngoại tuyến và gửi push cho tài xế mất tín hiệu định vị quá hạn', async () => {
      prisma.driverProfile.findMany.mockResolvedValue([{ userId: 'driver-stale-1' }]);
      prisma.driverProfile.updateMany.mockResolvedValue({ count: 1 });

      const count = await service.handleStaleOnlineDrivers();

      expect(count).toBe(1);
      expect(prisma.driverProfile.updateMany).toHaveBeenCalledWith({
        where: { userId: { in: ['driver-stale-1'] }, isOnline: true },
        data: { isOnline: false },
      });
      expect(notifications.notifyDriverAutoOffline).toHaveBeenCalledWith(['driver-stale-1']);
    });
  });

  describe('handleExpiredPausedRestaurants', () => {
    it('tự động reset pausedUntil = null khi đã hết thời gian tạm nghỉ', async () => {
      prisma.restaurant.updateMany.mockResolvedValue({ count: 2 });

      const count = await service.handleExpiredPausedRestaurants();

      expect(count).toBe(2);
      expect(prisma.restaurant.updateMany).toHaveBeenCalledWith({
        where: {
          pausedUntil: { lte: expect.any(Date), not: null },
        },
        data: {
          pausedUntil: null,
        },
      });
    });
  });
  describe('handleCleanOldNotifications', () => {
    it('gọi cleanOldNotifications với 90 ngày', async () => {
      const count = await service.handleCleanOldNotifications();
      expect(count).toBe(5);
      expect(notifications.cleanOldNotifications).toHaveBeenCalledWith(90);
    });
  });
  describe('handlePendingOrderReminders', () => {
    it('gửi push nhắc nhở chủ quán khi đơn PENDING chờ quá 2 phút và chưa có nhắc nhở', async () => {
      const mockOrder = {
        id: 'order-pending-1',
        total: 120000,
        createdAt: new Date(Date.now() - 3 * 60 * 1000),
        restaurant: { name: 'Quán Cơm', ownerId: 'owner-1' },
      };
      prisma.order.findMany.mockResolvedValue([mockOrder]);
      prisma.notification.findFirst.mockResolvedValue(null);

      const count = await service.handlePendingOrderReminders();

      expect(count).toBe(1);
      expect(notifications.notifyPendingOrderReminder).toHaveBeenCalledWith(mockOrder);
    });

    it('không gửi lại nếu đã có thông báo nhắc nhở cho đơn này', async () => {
      const mockOrder = {
        id: 'order-pending-2',
        total: 150000,
        createdAt: new Date(Date.now() - 3 * 60 * 1000),
        restaurant: { name: 'Quán Phở', ownerId: 'owner-2' },
      };
      prisma.order.findMany.mockResolvedValue([mockOrder]);
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1' });

      const count = await service.handlePendingOrderReminders();

      expect(count).toBe(0);
      expect(notifications.notifyPendingOrderReminder).not.toHaveBeenCalled();
    });
  });
  describe('handleCleanOldBotConversations', () => {
    it('chỉ xoá hội thoại cũ hơn 90 ngày và không có tin nhắn mới trong 90 ngày', async () => {
      const before = Date.now();
      const count = await service.handleCleanOldBotConversations();
      expect(count).toBe(3);
      const where = prisma.botConversation.deleteMany.mock.calls[0][0].where;
      const threshold: Date = where.createdAt.lt;
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      expect(before - threshold.getTime()).toBeGreaterThanOrEqual(ninetyDays - 1000);
      expect(before - threshold.getTime()).toBeLessThanOrEqual(ninetyDays + 1000);
      expect(where.messages).toEqual({ none: { createdAt: { gte: threshold } } });
    });

    it('không xoá gì khi instance khác đang giữ khoá', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ locked: false }]);
      const count = await service.handleCleanOldBotConversations();
      expect(count).toBe(0);
      expect(prisma.botConversation.deleteMany).not.toHaveBeenCalled();
    });
  });
  describe('handleRestockMenuItems', () => {
    it('mở bán lại món "hết hôm nay" đã đến giờ, báo realtime theo từng quán', async () => {
      const now = new Date('2026-11-05T21:00:00Z'); // 04:00 sáng giờ VN
      prisma.menuItem.findMany.mockResolvedValue([
        { id: 'm1', restaurantId: 'r1' },
        { id: 'm2', restaurantId: 'r1' },
        { id: 'm3', restaurantId: 'r2' },
      ]);
      prisma.menuItem.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.handleRestockMenuItems(now);

      expect(count).toBe(3);
      expect(prisma.menuItem.findMany.mock.calls[0][0].where).toEqual({
        isAvailable: false,
        isArchived: false,
        soldOutUntil: { lte: now },
      });
      expect(prisma.menuItem.updateMany.mock.calls[0][0].data).toEqual({ isAvailable: true, soldOutUntil: null });
      expect(gateway.emitMenuStock).toHaveBeenCalledTimes(2);
      expect(gateway.emitMenuStock).toHaveBeenCalledWith({
        restaurantId: 'r1',
        items: [
          { id: 'm1', isAvailable: true, soldOutUntil: null },
          { id: 'm2', isAvailable: true, soldOutUntil: null },
        ],
      });
    });

    it('không có món đến hạn thì không ghi gì', async () => {
      expect(await service.handleRestockMenuItems()).toBe(0);
      expect(prisma.menuItem.updateMany).not.toHaveBeenCalled();
      expect(gateway.emitMenuStock).not.toHaveBeenCalled();
    });
  });
});
