import { OrderStatus } from '@prisma/client';
import { buildRestaurantStats, statsRangeStart, vnDateKey } from './restaurant-stats';

// 30/10/2026 10:00 giờ VN = 03:00 UTC
const NOW = new Date('2026-10-30T03:00:00.000Z');

const order = (status: OrderStatus, subtotal: number, iso: string, items: [string, string, number, number][] = []) => ({
  status,
  subtotal,
  createdAt: new Date(iso),
  items: items.map(([menuItemId, name, quantity, lineTotal]) => ({ menuItemId, name, quantity, lineTotal })),
});

describe('restaurant-stats', () => {
  it('tính ngày theo giờ Việt Nam', () => {
    // 23:30 UTC ngày 29 = 06:30 sáng ngày 30 giờ VN
    expect(vnDateKey(new Date('2026-10-29T23:30:00.000Z'))).toBe('2026-10-30');
    // Hôm nay bắt đầu lúc 00:00 giờ VN = 17:00 UTC hôm trước
    expect(statsRangeStart(NOW, 1).toISOString()).toBe('2026-10-29T17:00:00.000Z');
    expect(statsRangeStart(NOW, 7).toISOString()).toBe('2026-10-23T17:00:00.000Z');
  });

  it('chỉ tính doanh thu từ đơn đã giao, đếm đúng các loại đơn', () => {
    const stats = buildRestaurantStats(
      [
        order('DELIVERED', 100_000, '2026-10-30T01:00:00.000Z', [['a', 'Phở', 2, 100_000]]),
        order('DELIVERED', 50_000, '2026-10-28T05:00:00.000Z', [
          ['a', 'Phở', 1, 50_000],
        ]),
        order('CANCELLED', 70_000, '2026-10-29T05:00:00.000Z', [['b', 'Bún', 1, 70_000]]),
        order('PREPARING', 30_000, '2026-10-30T02:00:00.000Z', [['b', 'Bún', 1, 30_000]]),
        // Ngoài khoảng 7 ngày: bỏ qua
        order('DELIVERED', 999_000, '2026-10-01T05:00:00.000Z', [['c', 'Lẩu', 9, 999_000]]),
      ],
      NOW,
      7,
    );

    expect(stats.revenue).toBe(150_000);
    expect(stats.totalOrders).toBe(4);
    expect(stats.deliveredOrders).toBe(2);
    expect(stats.cancelledOrders).toBe(1);
    expect(stats.inProgressOrders).toBe(1);
    expect(stats.averageOrderValue).toBe(75_000);
    expect(stats.itemsSold).toBe(3);
    expect(stats.topItems).toEqual([{ menuItemId: 'a', name: 'Phở', quantity: 3, revenue: 150_000 }]);
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily[6]).toEqual({ date: '2026-10-30', revenue: 100_000, orders: 1 });
    expect(stats.from).toBe('2026-10-24');
    expect(stats.to).toBe('2026-10-30');
  });

  it('không có đơn thì mọi số bằng 0', () => {
    const stats = buildRestaurantStats([], NOW, 1);
    expect(stats.revenue).toBe(0);
    expect(stats.averageOrderValue).toBe(0);
    expect(stats.daily).toEqual([{ date: '2026-10-30', revenue: 0, orders: 0 }]);
  });
});
