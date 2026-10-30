import { OrderStatus } from '@prisma/client';
import { statsRangeStart, vnDateKey, VN_OFFSET_MINUTES } from '../restaurants/restaurant-stats';

export interface DriverStatsOrderInput {
  status: OrderStatus;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  createdAt: Date;
}

export interface DriverStats {
  days: number;
  from: string; // YYYY-MM-DD (giờ VN), ngày đầu của khoảng
  to: string; // YYYY-MM-DD (giờ VN), hôm nay
  /** Thu nhập của tài xế = tổng deliveryFee của các đơn đã giao thành công (DELIVERED). */
  earnings: number;
  /** Số chuyến giao thành công. */
  deliveredTrips: number;
  /** Số chuyến bị huỷ (đã nhận nhưng sau đó huỷ). */
  cancelledTrips: number;
  /** Tiền mặt đã thu hộ (tổng total của đơn COD đã giao thành công). */
  cashCollected: number;
  daily: { date: string; earnings: number; trips: number }[];
}

export function buildDriverStats(
  orders: DriverStatsOrderInput[],
  now: Date,
  days: number,
  offsetMinutes = VN_OFFSET_MINUTES,
): DriverStats {
  const start = statsRangeStart(now, days, offsetMinutes);

  // Khung các ngày trong khoảng (kể cả những ngày không có đơn)
  const daily = new Map<string, { date: string; earnings: number; trips: number }>();
  for (let i = 0; i < days; i++) {
    const key = vnDateKey(new Date(start.getTime() + i * 86_400_000), offsetMinutes);
    daily.set(key, { date: key, earnings: 0, trips: 0 });
  }

  let earnings = 0;
  let deliveredTrips = 0;
  let cancelledTrips = 0;
  let cashCollected = 0;

  for (const o of orders) {
    if (o.status === 'DELIVERED') {
      deliveredTrips += 1;
      earnings += o.deliveryFee;
      if (o.paymentMethod === 'COD') {
        cashCollected += o.total;
      }
      const key = vnDateKey(o.createdAt, offsetMinutes);
      const day = daily.get(key);
      if (day) {
        day.earnings += o.deliveryFee;
        day.trips += 1;
      }
    } else if (o.status === 'CANCELLED') {
      cancelledTrips += 1;
    }
  }

  const from = vnDateKey(start, offsetMinutes);
  const to = vnDateKey(now, offsetMinutes);

  return {
    days,
    from,
    to,
    earnings,
    deliveredTrips,
    cancelledTrips,
    cashCollected,
    daily: Array.from(daily.values()),
  };
}

