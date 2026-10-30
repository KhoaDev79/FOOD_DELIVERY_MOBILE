import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  FailedDeliveryReason,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  Role,
} from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService (V4 C4 Ledger & C5 Failed Delivery)', () => {
  let service: OrdersService;
  let prisma: {
    order: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    user: { findUnique: jest.Mock; update: jest.Mock };
    driverProfile: { update: jest.Mock };
    driverLedger: { create: jest.Mock };
    orderStatusHistory: { create: jest.Mock };
    deliveryContactAttempt: { count: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    auditLog: { create: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let config: { get: jest.Mock };
  let gateway: { emitOrderUpdated: jest.Mock; emitOrderAvailable: jest.Mock };
  let notifications: {
    notifyStatusChanged: jest.Mock;
    notifyDriverAssigned: jest.Mock;
    notifyDriverArrived: jest.Mock;
    notifyDriverReleased: jest.Mock;
  };

  const baseOrder = {
    id: 'ord-11112222',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    driverId: 'driver-1',
    status: OrderStatus.PICKED_UP,
    paymentMethod: PaymentMethod.COD,
    paymentStatus: 'UNPAID',
    subtotal: 100000,
    deliveryFee: 25000,
    peakSurcharge: 0,
    platformCommission: 5000,
    driverEarning: 20000,
    total: 125000,
    distanceKm: 3,
    deliveryAddress: '123 Nguyễn Huệ, Q1',
    deliveryLat: 10.7769,
    deliveryLng: 106.7009,
    arrivedAt: new Date(Date.now() - 12 * 60 * 1000), // Đã đến 12 phút trước
    restaurant: {
      id: 'rest-1',
      name: 'Quán Ngon',
      ownerId: 'owner-1',
      latitude: 10.77,
      longitude: 106.7,
    },
    customer: { id: 'cust-1', fullName: 'Khách A', phone: '0901234567' },
    driver: { id: 'driver-1', fullName: 'Tài Xế B', phone: '0909999999' },
    items: [],
    statusHistory: [],
    contactAttempts: [],
  };

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(baseOrder),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...baseOrder, status: OrderStatus.DELIVERED }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(baseOrder),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      driverProfile: {
        update: jest.fn().mockResolvedValue({ codBalance: 305000 }),
      },
      driverLedger: {
        create: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      deliveryContactAttempt: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'att-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((cb: (tx: typeof prisma) => unknown) => cb(prisma)),
    };

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, number> = {
          'business.driverDebtLimit': 2000000,
          'business.driverMaxActiveOrders': 2,
          'business.arrivalMaxDistanceM': 200,
          'business.failedDeliveryMinWaitMinutes': 10,
          'business.failedDeliveryMinCalls': 3,
        };
        return map[key];
      }),
    };

    gateway = {
      emitOrderUpdated: jest.fn(),
      emitOrderAvailable: jest.fn(),
    };

    notifications = {
      notifyStatusChanged: jest.fn(),
      notifyDriverAssigned: jest.fn(),
      notifyDriverArrived: jest.fn(),
      notifyDriverReleased: jest.fn(),
    };

    service = new OrdersService(
      prisma as never,
      config as never,
      gateway as never,
      {} as never,
      notifications as never,
      {} as never,
    );
  });

  describe('C4: Công nợ COD (DriverLedger) & Hạn mức nhận đơn', () => {
    it('ghi nhận đúng nợ subtotal + platformCommission vào DriverLedger khi DELIVERED', async () => {
      await service.updateStatus(
        baseOrder.id,
        { id: 'driver-1', email: 'd@test.com', role: Role.DRIVER },
        { status: OrderStatus.DELIVERED },
      );

      // Nợ nền tảng = subtotal (100.000) + platformCommission (5.000) = 105.000
      expect(prisma.driverProfile.update).toHaveBeenCalledWith({
        where: { userId: 'driver-1' },
        data: { codBalance: { increment: 105000 } },
      });
      expect(prisma.driverLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverId: 'driver-1',
            orderId: baseOrder.id,
            type: LedgerEntryType.COD_COLLECTED,
            amount: 105000,
            balanceAfter: 305000,
          }),
        }),
      );
    });

    it('chặn nhận đơn (403) khi codBalance + nợ đơn mới vượt DRIVER_DEBT_LIMIT', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'driver-1',
        isActive: true,
        driverProfile: {
          userId: 'driver-1',
          verificationStatus: DriverVerificationStatus.APPROVED,
          isOnline: true,
          codBalance: 1950000, // Đang nợ 1.950.000đ, hạn mức 2.000.000đ
        },
      });

      // Đơn mới có nợ = 100.000 + 5.000 = 105.000 -> tổng 2.055.000 > 2.000.000
      await expect(service.acceptByDriver(baseOrder.id, 'driver-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('C5: Giao thất bại có bằng chứng (arrivedAt, thời gian chờ, cuộc gọi)', () => {
    it('từ chối xác nhận đến điểm giao (409) khi tài xế đứng cách quá ARRIVAL_MAX_DISTANCE_M (200m)', async () => {
      await expect(
        service.markDriverArrived(baseOrder.id, 'driver-1', {
          lat: 10.79, // Cách > 1.4km
          lng: 106.71,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('từ chối báo DELIVERY_FAILED (409) khi thời gian chờ tại điểm giao chưa đủ 10 phút', async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        ...baseOrder,
        arrivedAt: new Date(Date.now() - 6 * 60 * 1000), // Mới chờ 6 phút
      });

      await expect(
        service.updateStatus(
          baseOrder.id,
          { id: 'driver-1', email: 'd@test.com', role: Role.DRIVER },
          {
            status: OrderStatus.DELIVERY_FAILED,
            failedReason: FailedDeliveryReason.CUSTOMER_UNREACHABLE,
          },
        ),
      ).rejects.toThrow(/Cần chờ thêm 4 phút/);
    });

    it('từ chối báo DELIVERY_FAILED với CUSTOMER_UNREACHABLE (409) khi số lần gọi < 3', async () => {
      prisma.deliveryContactAttempt.count.mockResolvedValueOnce(2); // Mới gọi 2 lần

      await expect(
        service.updateStatus(
          baseOrder.id,
          { id: 'driver-1', email: 'd@test.com', role: Role.DRIVER },
          {
            status: OrderStatus.DELIVERY_FAILED,
            failedReason: FailedDeliveryReason.CUSTOMER_UNREACHABLE,
          },
        ),
      ).rejects.toThrow(/Cần gọi thêm 1 lần/);
    });

    it('cho phép DELIVERY_FAILED khi đủ điều kiện, cộng công chuyến đi (-driverEarning) và tăng failedDeliveryCount', async () => {
      prisma.order.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseOrder,
        status: OrderStatus.DELIVERY_FAILED,
      });

      await service.updateStatus(
        baseOrder.id,
        { id: 'driver-1', email: 'd@test.com', role: Role.DRIVER },
        {
          status: OrderStatus.DELIVERY_FAILED,
          failedReason: FailedDeliveryReason.CUSTOMER_UNREACHABLE,
        },
      );

      expect(prisma.driverLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: LedgerEntryType.ADJUSTMENT,
            amount: -20000, // -driverEarning
          }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { failedDeliveryCount: { increment: 1 } },
      });
    });
  });
});
