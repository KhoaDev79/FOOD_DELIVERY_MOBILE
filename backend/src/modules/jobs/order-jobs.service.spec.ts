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
  };
  let config: { get: jest.Mock };
  let ordersService: {
    updateStatus: jest.Mock;
    dispatchOrderAvailable: jest.Mock;
  };
  let gateway: { emitOrderStalled: jest.Mock };
  let notifications: { notifyDriverAutoOffline: jest.Mock };

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
    };

    notifications = {
      notifyDriverAutoOffline: jest.fn().mockResolvedValue(undefined),
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
});

