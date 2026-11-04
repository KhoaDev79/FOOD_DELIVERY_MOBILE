import { BadRequestException, ConflictException } from '@nestjs/common';
import { RestaurantStatus } from '@prisma/client';
import { parsePeakWindows } from '../../config/configuration';
import { OrderPricingService } from './order-pricing.service';

describe('OrderPricingService', () => {
  let service: OrderPricingService;
  let prisma: {
    restaurant: { findUnique: jest.Mock };
    address: { findFirst: jest.Mock };
    menuItem: { findMany: jest.Mock };
  };
  let config: { get: jest.Mock; getOrThrow: jest.Mock };
  let maps: { getRoadDistance: jest.Mock };

  const baseRestaurant = {
    id: 'rest-1',
    name: 'Phở Gia Truyền',
    status: RestaurantStatus.ACTIVE,
    isOpen: true,
    openTime: '06:00',
    closeTime: '22:00',
    latitude: 10.7769,
    longitude: 106.7009,
    deliveryRadiusKm: 8,
  };

  const baseAddress = {
    id: 'addr-1',
    userId: 'cust-1',
    addressLine: '123 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    latitude: 10.78,
    longitude: 106.705,
  };

  const baseMenuItem = {
    id: 'item-1',
    name: 'Phở Tái Nạm',
    price: 55000,
    discountPrice: 50000,
    options: {
      sizes: [
        { id: 's', name: 'Nhỏ', price: 0 },
        { id: 'l', name: 'Lớn', price: 10000 },
      ],
      toppings: [{ id: 'egg', name: 'Trứng chần', price: 8000 }],
    },
  };

  beforeEach(() => {
    prisma = {
      restaurant: { findUnique: jest.fn().mockResolvedValue(baseRestaurant) },
      address: { findFirst: jest.fn().mockResolvedValue(baseAddress) },
      menuItem: { findMany: jest.fn().mockResolvedValue([baseMenuItem]) },
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'business') {
          return {
            quoteSecret: 'test-quote-secret-at-least-32-chars-long!',
            quoteTtlMinutes: 10,
            platformCommissionRate: 0.2,
          };
        }
        if (key === 'business.quoteSecret') return 'test-quote-secret-at-least-32-chars-long!';
        return undefined;
      }),
      getOrThrow: jest.fn(() => ({
        baseFee: 15000,
        freeKm: 2,
        feePerKm: 5000,
        peakMultiplier: 1.2,
        peakWindows: parsePeakWindows('11:00-13:00,17:30-20:00'),
      })),
    };
    maps = {
      getRoadDistance: jest.fn().mockResolvedValue({
        distanceKm: 3.4,
        durationMinutes: 15,
        source: 'ROAD',
      }),
    };
    // Không chọn voucher: không giảm gì
    vouchers = {
      priceSelection: jest.fn().mockResolvedValue({ applied: [], rejected: [], discount: 0, shippingDiscount: 0, restaurantDiscount: 0 }),
    };
    service = new OrderPricingService(prisma as never, config as never, maps as never, vouchers as never);
  });

  // 03:00 UTC = 10:00 giờ VN (ngoài giờ cao điểm, trong giờ mở cửa)
  let vouchers: { priceSelection: jest.Mock };
  const normalTime = new Date('2026-10-30T03:00:00.000Z');
  // 05:00 UTC = 12:00 giờ VN (trong giờ cao điểm 11:00-13:00)
  const peakTime = new Date('2026-10-30T05:00:00.000Z');

  it('tính báo giá chuẩn (ngoài giờ cao điểm) và làm tròn lên 1.000đ', async () => {
    const quote = await service.quote(
      'cust-1',
      {
        restaurantId: 'rest-1',
        addressId: 'addr-1',
        items: [{ menuItemId: 'item-1', quantity: 2, sizeId: 'l', toppingIds: ['egg'] }],
      },
      normalTime,
    );

    // Đơn giá = 50.000 (giá giảm) + 10.000 (size L) + 8.000 (trứng) = 68.000 x 2 = 136.000
    expect(quote.subtotal).toBe(136000);
    // Phí ship cơ bản: 15.000 + (3.4 - 2) * 5.000 = 22.000
    expect(quote.baseDeliveryFee).toBe(22000);
    expect(quote.peakSurcharge).toBe(0);
    expect(quote.deliveryFee).toBe(22000);
    expect(quote.total).toBe(158000);
    expect(quote.distanceSource).toBe('ROAD');
    expect(quote.paymentMethod).toBe('COD');
    expect(quote.quoteToken).toBeTruthy();
  });

  it('áp voucher: giảm tiền món + freeship, thu nhập tài xế giữ nguyên, mã nằm trong chữ ký báo giá', async () => {
    vouchers.priceSelection.mockResolvedValue({
      applied: [
        { voucher: { code: 'GIAM20K', title: 'Giảm 20k', discountType: 'FIXED_AMOUNT' }, discount: 20000, shippingDiscount: 0 },
        { voucher: { code: 'FREESHIP', title: 'Freeship', discountType: 'FREE_SHIP' }, discount: 0, shippingDiscount: 22000 },
      ],
      rejected: [{ code: 'SAIMA', reason: 'Mã không tồn tại' }],
      discount: 20000,
      shippingDiscount: 22000,
      restaurantDiscount: 0,
    });
    const dto = {
      restaurantId: 'rest-1',
      addressId: 'addr-1',
      items: [{ menuItemId: 'item-1', quantity: 2, sizeId: 'l', toppingIds: ['egg'] }],
      voucherCodes: ['GIAM20K', 'FREESHIP'],
    };
    const ctx = await service.computeOrderPricing('cust-1', dto, prisma as never, normalTime);

    // 136.000 − 20.000 + 22.000 − 22.000
    expect(ctx.quote.total).toBe(116000);
    expect(ctx.quote.itemDiscount).toBe(20000);
    expect(ctx.quote.shippingDiscount).toBe(22000);
    expect(ctx.quote.rejectedVouchers).toEqual([{ code: 'SAIMA', reason: 'Mã không tồn tại' }]);
    expect(ctx.driverEarning).toBe(22000 - ctx.platformCommission);

    // Đổi mã sau khi báo giá -> chữ ký không khớp
    await expect(
      service.verifyAndPriceOrder('cust-1', { ...dto, voucherCodes: ['KHAC'], quoteToken: ctx.quote.quoteToken }, prisma as never, normalTime),
    ).rejects.toThrow('không khớp');
  });

  it('tính phụ phí cao điểm làm tròn lên 1.000đ và chiết khấu sàn 20%', async () => {
    const ctx = await service.computeOrderPricing(
      'cust-1',
      {
        restaurantId: 'rest-1',
        addressId: 'addr-1',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      },
      prisma as never,
      peakTime,
    );

    // baseDeliveryFee = 22.000; peakSurcharge = ceil1000(22.000 * 0.2) = ceil1000(4.400) = 5.000
    expect(ctx.quote.baseDeliveryFee).toBe(22000);
    expect(ctx.quote.peakSurcharge).toBe(5000);
    expect(ctx.quote.deliveryFee).toBe(27000);
    // platformCommission = ceil1000(27.000 * 0.2) = ceil1000(5.400) = 6.000; driverEarning = 21.000
    expect(ctx.platformCommission).toBe(6000);
    expect(ctx.driverEarning).toBe(21000);
  });

  it('từ chối quoteToken giả mạo hoặc giỏ hàng thay đổi với lỗi 400', async () => {
    const quote = await service.quote(
      'cust-1',
      {
        restaurantId: 'rest-1',
        addressId: 'addr-1',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      },
      normalTime,
    );

    // Thay đổi số lượng mà vẫn gửi quoteToken cũ -> 400
    await expect(
      service.verifyAndPriceOrder(
        'cust-1',
        {
          restaurantId: 'rest-1',
          addressId: 'addr-1',
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          quoteToken: quote.quoteToken,
        },
        prisma as never,
        normalTime,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trả 409 QUOTE_CHANGED kèm báo giá mới khi quoteToken hết hạn hoặc giá món thay đổi', async () => {
    const quote = await service.quote(
      'cust-1',
      {
        restaurantId: 'rest-1',
        addressId: 'addr-1',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      },
      normalTime,
    );

    // Giả lập 15 phút sau (quá TTL 10 phút)
    const expiredTime = new Date(normalTime.getTime() + 15 * 60 * 1000);
    try {
      await service.verifyAndPriceOrder(
        'cust-1',
        {
          restaurantId: 'rest-1',
          addressId: 'addr-1',
          items: [{ menuItemId: 'item-1', quantity: 1 }],
          quoteToken: quote.quoteToken,
        },
        prisma as never,
        expiredTime,
      );
      fail('Should throw ConflictException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ConflictException);
      const res = (err as ConflictException).getResponse() as { code: string; quote: { quoteToken: string } };
      expect(res.code).toBe('QUOTE_CHANGED');
      expect(res.quote.quoteToken).toBeTruthy();
    }
  });

  it('chặn đặt món nếu đang ngoài khung giờ mở bán của món (availableFrom - availableTo)', async () => {
    prisma.menuItem.findMany.mockResolvedValueOnce([
      {
        ...baseMenuItem,
        availableFrom: '06:00',
        availableTo: '10:00',
      },
    ]);

    // normalTime là 14:00 VN (ngoài khung giờ 06:00 - 10:00)
    await expect(
      service.quote(
        'cust-1',
        {
          restaurantId: 'rest-1',
          addressId: 'addr-1',
          items: [{ menuItemId: 'item-1', quantity: 1 }],
        },
        normalTime,
      ),
    ).rejects.toThrow('chỉ bán trong khung giờ 06:00 – 10:00');
  });

  it('cho phép đặt món nếu đang trong khung giờ mở bán của món', async () => {
    prisma.menuItem.findMany.mockResolvedValueOnce([
      {
        ...baseMenuItem,
        availableFrom: '06:00',
        availableTo: '10:00',
      },
    ]);

    // Giả lập thời điểm 08:00 sáng VN
    const morningTime = new Date('2026-11-03T08:00:00+07:00');
    const quote = await service.quote(
      'cust-1',
      {
        restaurantId: 'rest-1',
        addressId: 'addr-1',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      },
      morningTime,
    );

    expect(quote).toBeDefined();
    expect(quote.subtotal).toBe(50000);
  });
});