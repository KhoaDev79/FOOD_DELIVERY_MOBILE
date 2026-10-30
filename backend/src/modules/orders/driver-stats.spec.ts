import { buildDriverStats, DriverStatsOrderInput } from './driver-stats';

describe('buildDriverStats (V4)', () => {
  // Giả lập thời điểm: 2026-10-30T10:00:00Z (17:00 giờ VN)
  const now = new Date('2026-10-30T10:00:00.000Z');

  it('tính thu nhập theo driverEarning và nhóm theo ngày giao thành công (deliveredAt)', () => {
    const orders: DriverStatsOrderInput[] = [
      {
        status: 'DELIVERED',
        deliveryFee: 20000,
        driverEarning: 16000,
        total: 85000,
        paymentMethod: 'COD',
        // Đơn tạo đêm hôm trước (23:50 giờ VN 29/10) nhưng giao lúc 00:15 giờ VN hôm nay (30/10)
        createdAt: new Date('2026-10-29T16:50:00.000Z'),
        deliveredAt: new Date('2026-10-29T17:15:00.000Z'),
      },
      {
        status: 'DELIVERED',
        deliveryFee: 25000,
        driverEarning: 20000,
        total: 120000,
        paymentMethod: 'VNPAY',
        createdAt: new Date('2026-10-30T06:00:00.000Z'),
        deliveredAt: new Date('2026-10-30T06:30:00.000Z'),
      },
      {
        status: 'CANCELLED',
        deliveryFee: 15000,
        driverEarning: 12000,
        total: 60000,
        paymentMethod: 'COD',
        createdAt: new Date('2026-10-30T02:00:00.000Z'),
      },
    ];

    const stats = buildDriverStats(orders, now, 1);
    expect(stats.days).toBe(1);
    expect(stats.earnings).toBe(36000); // 16.000 + 20.000 (theo driverEarning)
    expect(stats.deliveredTrips).toBe(2);
    expect(stats.cancelledTrips).toBe(1);
    expect(stats.cashCollected).toBe(85000); // Chỉ đơn COD
    expect(stats.daily).toHaveLength(1);
    expect(stats.daily[0].earnings).toBe(36000);
    expect(stats.daily[0].trips).toBe(2);
  });

  it('tạo đủ các ngày trong khoảng 7 ngày kể cả ngày không có chuyến', () => {
    const stats = buildDriverStats([], now, 7);
    expect(stats.days).toBe(7);
    expect(stats.earnings).toBe(0);
    expect(stats.deliveredTrips).toBe(0);
    expect(stats.cancelledTrips).toBe(0);
    expect(stats.cashCollected).toBe(0);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily.every((d) => d.earnings === 0 && d.trips === 0)).toBe(true);
  });
});
