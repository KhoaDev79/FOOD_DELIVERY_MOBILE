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
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    user: { findUnique: jest.Mock; update: jest.Mock };
    driverProfile: { update: jest.Mock; findMany: jest.Mock };
    driverLedger: { create: jest.Mock };
    orderStatusHistory: { create: jest.Mock; findMany: jest.Mock };
    deliveryContactAttempt: { count: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
    review: { create: jest.Mock; aggregate: jest.Mock };
    restaurant: { update: jest.Mock };
    auditLog: { create: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let config: { get: jest.Mock };
  let gateway: {
    emitOrderUpdated: jest.Mock;
    emitOrderAvailable: jest.Mock;
    emitOrderAvailableToDriver: jest.Mock;
    emitOrderTaken: jest.Mock;
  };
  let notifications: {
    notifyStatusChanged: jest.Mock;
    notifyDriverAssigned: jest.Mock;
    notifyDriverArrived: jest.Mock;
    notifyDriverReleased: jest.Mock;
    notifyDriversOrderAvailable: jest.Mock;
  };

  let vouchers: { redeem: jest.Mock; releaseForOrder: jest.Mock };

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
        findMany: jest.fn().mockResolvedValue([]),
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      driverLedger: {
        create: jest.fn().mockResolvedValue({}),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      deliveryContactAttempt: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'att-1' }),
      },
      review: {
        create: jest.fn().mockResolvedValue({ id: 'rev-1', rating: 5 }),
        aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 4.8 }, _count: { rating: 10 } }),
      },
      restaurant: {
        update: jest.fn().mockResolvedValue({}),
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
      emitOrderAvailableToDriver: jest.fn(),
      emitOrderTaken: jest.fn(),
    };

    notifications = {
      notifyStatusChanged: jest.fn(),
      notifyDriverAssigned: jest.fn(),
      notifyDriverArrived: jest.fn(),
      notifyDriverReleased: jest.fn(),
      notifyDriversOrderAvailable: jest.fn().mockResolvedValue(undefined),
    };

    vouchers = { redeem: jest.fn(), releaseForOrder: jest.fn().mockResolvedValue(0) };

    service = new OrdersService(
      prisma as never,
      config as never,
      gateway as never,
      {} as never,
      notifications as never,
      {} as never,
      vouchers as never,
      { resolveImage: jest.fn(async (v: string) => v) } as never,
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

    it('đơn có voucher: nợ COD = tiền thực thu − thu nhập tài xế (phần giảm do sàn/quán bù)', async () => {
      // Khách được giảm 30.000 tiền món + 25.000 phí ship: thực thu 70.000, tài xế vẫn nhận 20.000
      prisma.order.findUnique.mockResolvedValue({ ...baseOrder, total: 70000, discountAmount: 30000, shippingDiscount: 25000 });
      await service.updateStatus(
        baseOrder.id,
        { id: 'driver-1', email: 'd@test.com', role: Role.DRIVER },
        { status: OrderStatus.DELIVERED },
      );
      expect(prisma.driverProfile.update).toHaveBeenCalledWith({
        where: { userId: 'driver-1' },
        data: { codBalance: { increment: 50000 } },
      });
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
      // Giao thất bại: trả lại lượt voucher
      expect(vouchers.releaseForOrder).toHaveBeenCalledWith(prisma, baseOrder.id);
    });
  });

  describe('D3: Lọc đơn khả dụng theo bán kính & vị trí tài xế', () => {
    it('trả 409 khi vị trí tài xế đã cũ hơn DRIVER_LOCATION_STALE_MINUTES', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'driver-1',
        isActive: true,
        driverProfile: {
          userId: 'driver-1',
          verificationStatus: DriverVerificationStatus.APPROVED,
          isOnline: true,
          codBalance: 0,
          lastLatitude: 10.77,
          lastLongitude: 106.7,
          lastLocationAt: new Date(Date.now() - 10 * 60 * 1000), // 10 phút trước (> 5 phút)
        },
      });

      await expect(
        service.findAvailableForDrivers('driver-1', { page: 1, limit: 20 }),
      ).rejects.toThrow(ConflictException);
    });

    it('chỉ trả đơn trong bán kính, sắp theo khoảng cách tới quán và đính kèm thông tin thu nhập/công nợ', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'driver-1',
        isActive: true,
        driverProfile: {
          userId: 'driver-1',
          verificationStatus: DriverVerificationStatus.APPROVED,
          isOnline: true,
          codBalance: 100000,
          lastLatitude: 10.77,
          lastLongitude: 106.7,
          lastLocationAt: new Date(),
        },
      });

      prisma.order.findMany.mockResolvedValue([
        {
          ...baseOrder,
          id: 'ord-far',
          driverId: null,
          status: OrderStatus.CONFIRMED,
          createdAt: new Date(Date.now() - 10 * 60 * 1000),
          restaurant: {
            id: 'rest-far',
            name: 'Quán Xa 3km',
            latitude: 10.795,
            longitude: 106.7,
            address: 'Q3',
            phone: null,
            imageUrl: null,
          },
        },
        {
          ...baseOrder,
          id: 'ord-near',
          driverId: null,
          status: OrderStatus.READY_FOR_PICKUP,
          createdAt: new Date(Date.now() - 2 * 60 * 1000),
          restaurant: {
            id: 'rest-near',
            name: 'Quán Gần 500m',
            latitude: 10.774,
            longitude: 106.7,
            address: 'Q1',
            phone: null,
            imageUrl: null,
          },
        },
        {
          ...baseOrder,
          id: 'ord-out',
          driverId: null,
          status: OrderStatus.CONFIRMED,
          createdAt: new Date(Date.now() - 20 * 60 * 1000),
          restaurant: {
            id: 'rest-out',
            name: 'Quán Ngoài Bán Kính 8km',
            latitude: 10.85,
            longitude: 106.7,
            address: 'Thủ Đức',
            phone: null,
            imageUrl: null,
          },
        },
      ]);

      const res = await service.findAvailableForDrivers('driver-1', { page: 1, limit: 20 });
      expect(res.items).toHaveLength(2);
      expect(res.items[0].id).toBe('ord-near');
      expect(res.items[1].id).toBe('ord-far');
      expect(res.items[0].codToCollect).toBe(125000);
      expect(res.items[0].debtAfterAccept).toBe(205000); // 100k + (100k + 5k)
    });
  });

  describe('E3: Đánh giá theo đơn (một lần mỗi đơn, trong REVIEW_WINDOW_DAYS)', () => {
    it('cho phép đánh giá quán và tài xế một lần khi đơn DELIVERED trong thời hạn', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.DELIVERED,
        review: null,
        statusHistory: [{ status: OrderStatus.DELIVERED, createdAt: new Date() }],
      });

      const res = await service.review(baseOrder.id, 'cust-1', {
        rating: 5,
        comment: 'Món ngon',
        driverRating: 5,
        driverComment: 'Giao nhanh',
      });

      expect(res).toBeDefined();
      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: baseOrder.id,
            rating: 5,
            driverId: 'driver-1',
            driverRating: 5,
          }),
        }),
      );
      expect(prisma.restaurant.update).toHaveBeenCalledWith({
        where: { id: 'rest-1' },
        data: { rating: 4.8, ratingCount: 10 },
      });
    });

    it('đánh giá kèm ảnh: tải ảnh lên (tối đa 3) và lưu link; ảnh lỗi thì bỏ qua', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.DELIVERED,
        review: null,
        statusHistory: [{ status: OrderStatus.DELIVERED, createdAt: new Date() }],
      });
      const media = (service as any).media;
      media.resolveImage = jest
        .fn()
        .mockResolvedValueOnce('https://cdn/a.jpg')
        .mockRejectedValueOnce(new Error('mạng lỗi'))
        .mockResolvedValueOnce('https://cdn/c.jpg');

      await service.review(baseOrder.id, 'cust-1', {
        rating: 4,
        images: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB', 'data:image/png;base64,CCC'],
      });
      expect(media.resolveImage).toHaveBeenCalledWith('data:image/jpeg;base64,AAA', 'reviews');
      expect(prisma.review.create.mock.calls.at(-1)[0].data.images).toEqual(['https://cdn/a.jpg', 'https://cdn/c.jpg']);
    });

    it('từ chối (409) khi đơn đã được đánh giá trước đó', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.DELIVERED,
        review: { id: 'rev-existing' },
        statusHistory: [{ status: OrderStatus.DELIVERED, createdAt: new Date() }],
      });

      await expect(
        service.review(baseOrder.id, 'cust-1', { rating: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('từ chối khi đơn đã quá thời hạn REVIEW_WINDOW_DAYS (7 ngày)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.DELIVERED,
        review: null,
        statusHistory: [
          {
            status: OrderStatus.DELIVERED,
            createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          },
        ],
      });

      await expect(
        service.review(baseOrder.id, 'cust-1', { rating: 4 }),
      ).rejects.toThrow(/quá thời hạn đánh giá/);
    });
  });

  describe('Chính sách huỷ & hoàn tiền', () => {
    const customer = { id: 'cust-1', email: 'c@test.com', role: Role.CUSTOMER };

    it('khách huỷ đơn đã trả online -> chờ hoàn tiền (không ghi đã hoàn)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        status: OrderStatus.PENDING,
        driverId: null,
        paymentMethod: PaymentMethod.VNPAY,
        paymentStatus: 'PAID',
      });
      await service.updateStatus(baseOrder.id, customer, {
        status: OrderStatus.CANCELLED,
        cancelReason: 'CUSTOMER_WRONG_ADDRESS' as never,
      });
      expect(prisma.order.updateMany.mock.calls[0][0].data.paymentStatus).toBe('REFUND_PENDING');
    });

    it('khách tự huỷ 4 đơn trong 7 ngày -> không đặt được đơn mới (403 CANCEL_LIMIT)', async () => {
      const now = Date.now();
      prisma.orderStatusHistory.findMany.mockResolvedValue(
        [1, 2, 3, 4].map((h) => ({ createdAt: new Date(now - h * 3_600_000) })),
      );
      prisma.user.findUnique.mockResolvedValue({ phone: '0912345678', fullName: 'Khách Test' });
      await expect(
        service.create('cust-1', { restaurantId: 'r', addressId: 'a', items: [], quoteToken: 'x'.repeat(20) } as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('thông tin huỷ đơn: nhắc khi đã huỷ 1 đơn, đơn quán đã nhận thì không tự huỷ được', async () => {
      prisma.orderStatusHistory.findMany.mockResolvedValue([{ createdAt: new Date() }]);
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'cust-1', status: OrderStatus.PENDING, paymentStatus: 'UNPAID' });
      const info = await service.getCancelInfo('o1', 'cust-1');
      expect(info.canCancel).toBe(true);
      expect(info.warning).toContain('Bạn đã huỷ 1 đơn');
      expect(info.reasons.length).toBeGreaterThanOrEqual(5);

      prisma.order.findUnique.mockResolvedValue({ id: 'o1', customerId: 'cust-1', status: OrderStatus.CONFIRMED, paymentStatus: 'UNPAID' });
      const info2 = await service.getCancelInfo('o1', 'cust-1');
      expect(info2.canCancel).toBe(false);
    });

    it('admin xác nhận hoàn tiền: chỉ áp dụng cho đơn đang chờ hoàn, ghi AuditLog', async () => {
      prisma.order.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValueOnce({ id: 'o1', customerId: 'cust-1', total: 125000 });
      (notifications as any).sendToUsers = jest.fn();
      await service.confirmRefund('o1', 'admin-1', 'Hoàn qua VNPay, mã HT123');
      expect(prisma.order.updateMany.mock.calls.at(-1)[0]).toMatchObject({
        where: { id: 'o1', paymentStatus: 'REFUND_PENDING' },
        data: { paymentStatus: 'REFUNDED' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();

      prisma.order.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.confirmRefund('o1', 'admin-1', 'lần 2')).rejects.toThrow(ConflictException);
    });
  });
});
