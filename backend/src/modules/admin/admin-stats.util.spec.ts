import {
  buildKpis,
  buildSeries,
  countEndReasons,
  percentChange,
  ratio,
  resolveStatsWindow,
  startOfVnDay,
  StatsOrderRow,
  summarizePeriod,
  topRestaurantsByGmv,
} from './admin-stats.util';

const row = (over: Partial<StatsOrderRow>): StatsOrderRow => ({
  createdAt: new Date('2026-11-02T03:00:00Z'),
  status: 'DELIVERED',
  restaurantId: 'r1',
  subtotal: 100_000,
  deliveryFee: 15_000,
  platformCommission: 10_000,
  ...over,
});

describe('startOfVnDay / resolveStatsWindow', () => {
  it('00:00 giờ VN = 17:00 UTC hôm trước', () => {
    // 01:30 sáng 03/11 giờ VN = 18:30 UTC 02/11
    expect(startOfVnDay(new Date('2026-11-02T18:30:00Z')).toISOString()).toBe('2026-11-02T17:00:00.000Z');
    // 23:00 tối 02/11 giờ VN = 16:00 UTC 02/11
    expect(startOfVnDay(new Date('2026-11-02T16:00:00Z')).toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });

  it('hôm nay: 24 cột theo giờ, kỳ trước là cùng khung giờ hôm qua', () => {
    const now = new Date('2026-11-02T05:00:00Z'); // 12:00 trưa giờ VN
    const w = resolveStatsWindow('today', now);
    expect(w.start.toISOString()).toBe('2026-11-01T17:00:00.000Z');
    expect(w.prevStart.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(w.prevEnd.toISOString()).toBe('2026-11-01T05:00:00.000Z');
    expect(w.bucket).toBe('hour');
    expect(w.buckets).toHaveLength(24);
  });

  it('7 ngày: gồm hôm nay và 6 ngày trước, kỳ trước lùi đúng 7 ngày', () => {
    const now = new Date('2026-11-02T05:00:00Z');
    const w = resolveStatsWindow('7d', now);
    expect(w.buckets).toHaveLength(7);
    expect(w.start.toISOString()).toBe('2026-10-26T17:00:00.000Z');
    expect(w.prevStart.toISOString()).toBe('2026-10-19T17:00:00.000Z');
    expect(w.prevEnd.toISOString()).toBe('2026-10-26T05:00:00.000Z');
    expect(resolveStatsWindow('30d', now).buckets).toHaveLength(30);
  });
});

describe('percentChange / ratio', () => {
  it('không chia cho 0', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
    expect(ratio(1, 0)).toBe(0);
  });
  it('làm tròn 1 chữ số', () => {
    expect(percentChange(118, 100)).toBe(18);
    expect(percentChange(50, 100)).toBe(-50);
    expect(ratio(1, 3)).toBe(33.3);
  });
});

describe('summarizePeriod + buildKpis', () => {
  it('GMV chỉ tính tiền món đơn đã giao; AOV = GMV / số đơn giao', () => {
    const cur = summarizePeriod([
      row({ subtotal: 100_000 }),
      row({ subtotal: 50_000 }),
      row({ status: 'CANCELLED', cancelReason: 'CUSTOMER_CHANGED_MIND' }),
      row({ status: 'PREPARING' }),
    ]);
    expect(cur).toMatchObject({ orders: 4, delivered: 2, cancelled: 1, gmv: 150_000, deliveryFee: 30_000 });

    const prev = summarizePeriod([row({ subtotal: 100_000 })]);
    const k = buildKpis(cur, prev);
    expect(k.gmv).toEqual({ value: 150_000, previous: 100_000, changePct: 50 });
    expect(k.aov.value).toBe(75_000);
    expect(k.orders.changePct).toBe(300);
    // 2 giao / 3 đã kết thúc (đơn đang làm không tính)
    expect(k.successRate.value).toBe(66.7);
    expect(k.cancelRate.value).toBe(33.3);
    // Tỉ lệ so sánh bằng điểm %: 66.7 - 100
    expect(k.successRate.changePct).toBe(-33.3);
  });

  it('không có dữ liệu: mọi chỉ số = 0, không so sánh được', () => {
    const k = buildKpis(summarizePeriod([]), summarizePeriod([]));
    expect(k.gmv).toEqual({ value: 0, previous: 0, changePct: null });
    expect(k.aov.value).toBe(0);
    expect(k.successRate).toEqual({ value: 0, previous: 0, changePct: null });
  });
});

describe('buildSeries', () => {
  it('gom đơn vào cột theo giờ VN, bỏ đơn ngoài kỳ', () => {
    const now = new Date('2026-11-02T05:00:00Z');
    const w = resolveStatsWindow('today', now);
    const s = buildSeries(
      [
        row({ createdAt: new Date('2026-11-02T03:10:00Z'), subtotal: 80_000 }), // 10h VN
        row({ createdAt: new Date('2026-11-02T03:50:00Z'), status: 'CANCELLED' }), // 10h VN
        row({ createdAt: new Date('2026-10-30T03:00:00Z') }), // ngoài kỳ
      ],
      w,
    );
    expect(s[10]).toMatchObject({ label: '10h', orders: 2, gmv: 80_000 });
    expect(s.reduce((a, p) => a + p.orders, 0)).toBe(2);
  });

  it('nhãn ngày dạng dd/mm theo giờ VN', () => {
    const w = resolveStatsWindow('7d', new Date('2026-11-02T05:00:00Z'));
    const s = buildSeries([], w);
    expect(s.map((p) => p.label)).toEqual(['27/10', '28/10', '29/10', '30/10', '31/10', '01/11', '02/11']);
  });
});

describe('topRestaurantsByGmv / countEndReasons', () => {
  it('xếp hạng quán theo GMV đơn giao', () => {
    const top = topRestaurantsByGmv([
      row({ restaurantId: 'a', subtotal: 50_000 }),
      row({ restaurantId: 'b', subtotal: 200_000 }),
      row({ restaurantId: 'a', subtotal: 60_000 }),
      row({ restaurantId: 'c', status: 'CANCELLED', subtotal: 999_000 }),
    ]);
    expect(top.map((t) => t.restaurantId)).toEqual(['b', 'a']);
    expect(top[1]).toEqual({ restaurantId: 'a', gmv: 110_000, orders: 2 });
  });

  it('đếm lý do huỷ và giao thất bại', () => {
    const reasons = countEndReasons([
      row({ status: 'CANCELLED', cancelReason: 'RESTAURANT_TIMEOUT' }),
      row({ status: 'CANCELLED', cancelReason: 'RESTAURANT_TIMEOUT' }),
      row({ status: 'DELIVERY_FAILED', failedReason: 'WRONG_ADDRESS' }),
      row({ status: 'CANCELLED', cancelReason: null }),
      row({ status: 'DELIVERED' }),
    ]);
    expect(reasons[0]).toEqual({ kind: 'cancel', reason: 'RESTAURANT_TIMEOUT', count: 2 });
    expect(reasons).toHaveLength(3);
    expect(reasons.find((r) => r.reason === 'OTHER')?.count).toBe(1);
  });
});
