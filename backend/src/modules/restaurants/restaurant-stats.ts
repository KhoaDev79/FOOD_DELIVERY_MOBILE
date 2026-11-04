import { OrderStatus } from '@prisma/client';

/** Giờ Việt Nam (UTC+7): ngày thống kê tính theo giờ địa phương của quán. */
export const VN_OFFSET_MINUTES = 7 * 60;

export const STATS_RANGES = [1, 7, 30] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export interface StatsOrderInput {
  status: OrderStatus;
  subtotal: number;
  /** Phần voucher do quán chịu, trừ vào doanh thu */
  restaurantDiscount?: number;
  createdAt: Date;
  items: { menuItemId: string; name: string; quantity: number; lineTotal: number }[];
}

export interface RestaurantStats {
  days: number;
  from: string; // YYYY-MM-DD (giờ VN), ngày đầu của khoảng
  to: string; // YYYY-MM-DD (giờ VN), hôm nay
  /** Doanh thu = tiền món của đơn giao thành công trừ phần voucher quán chịu; không gồm phí giao hàng. */
  revenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  inProgressOrders: number;
  averageOrderValue: number;
  itemsSold: number;
  daily: { date: string; revenue: number; orders: number }[];
  topItems: { menuItemId: string; name: string; quantity: number; revenue: number }[];
}

/** Ngày (YYYY-MM-DD) theo giờ VN của một thời điểm. */
export const vnDateKey = (d: Date, offsetMinutes = VN_OFFSET_MINUTES) =>
  new Date(d.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);

/** Thời điểm UTC bắt đầu khoảng thống kê: 00:00 giờ VN của ngày (days - 1) trước hôm nay. */
export function statsRangeStart(now: Date, days: number, offsetMinutes = VN_OFFSET_MINUTES): Date {
  const todayKey = vnDateKey(now, offsetMinutes);
  const startOfTodayUtc = new Date(`${todayKey}T00:00:00.000Z`).getTime() - offsetMinutes * 60_000;
  return new Date(startOfTodayUtc - (days - 1) * 86_400_000);
}

export function buildRestaurantStats(
  orders: StatsOrderInput[],
  now: Date,
  days: number,
  offsetMinutes = VN_OFFSET_MINUTES,
): RestaurantStats {
  const start = statsRangeStart(now, days, offsetMinutes);

  // Khung các ngày trong khoảng (kể cả ngày không có đơn)
  const daily = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const key = vnDateKey(new Date(start.getTime() + i * 86_400_000), offsetMinutes);
    daily.set(key, { date: key, revenue: 0, orders: 0 });
  }

  let revenue = 0;
  let delivered = 0;
  let cancelled = 0;
  let itemsSold = 0;
  const top = new Map<string, { menuItemId: string; name: string; quantity: number; revenue: number }>();

  const inRange = orders.filter((o) => o.createdAt.getTime() >= start.getTime() && o.createdAt <= now);
  for (const o of inRange) {
    if (o.status === 'CANCELLED') cancelled++;
    if (o.status !== 'DELIVERED') continue;

    delivered++;
    const net = o.subtotal - (o.restaurantDiscount ?? 0);
    revenue += net;
    const day = daily.get(vnDateKey(o.createdAt, offsetMinutes));
    if (day) {
      day.revenue += net;
      day.orders += 1;
    }
    for (const it of o.items) {
      itemsSold += it.quantity;
      const row = top.get(it.menuItemId) ?? { menuItemId: it.menuItemId, name: it.name, quantity: 0, revenue: 0 };
      row.quantity += it.quantity;
      row.revenue += it.lineTotal;
      top.set(it.menuItemId, row);
    }
  }

  return {
    days,
    from: vnDateKey(start, offsetMinutes),
    to: vnDateKey(now, offsetMinutes),
    revenue,
    totalOrders: inRange.length,
    deliveredOrders: delivered,
    cancelledOrders: cancelled,
    inProgressOrders: inRange.length - delivered - cancelled,
    averageOrderValue: delivered ? Math.round(revenue / delivered) : 0,
    itemsSold,
    daily: [...daily.values()],
    topItems: [...top.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10),
  };
}
