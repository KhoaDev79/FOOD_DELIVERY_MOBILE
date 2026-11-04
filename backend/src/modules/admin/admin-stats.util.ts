/**
 * Hàm thuần tính số liệu cho bảng điều khiển admin (GET /admin/stats/overview).
 * Mọi mốc ngày/giờ tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè) để "Hôm nay"
 * khớp với ngày admin nhìn thấy, bất kể máy chủ chạy múi giờ nào.
 */

export const STATS_RANGES = ['today', '7d', '30d'] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const VN_OFFSET_MS = 7 * HOUR_MS;

export interface StatsWindow {
  range: StatsRange;
  /** Kỳ hiện tại [start, end) */
  start: Date;
  end: Date;
  /** Kỳ trước cùng độ dài, kết thúc tại thời điểm tương ứng (so sánh công bằng khi kỳ hiện tại chưa hết) */
  prevStart: Date;
  prevEnd: Date;
  bucket: 'hour' | 'day';
  /** Mốc bắt đầu từng cột biểu đồ (giờ UTC) */
  buckets: Date[];
}

/** 00:00 giờ VN của ngày chứa thời điểm `at`, trả về dưới dạng mốc UTC. */
export function startOfVnDay(at: Date): Date {
  const vn = at.getTime() + VN_OFFSET_MS;
  return new Date(vn - (((vn % DAY_MS) + DAY_MS) % DAY_MS) - VN_OFFSET_MS);
}

export function resolveStatsWindow(range: StatsRange, now: Date): StatsWindow {
  const today = startOfVnDay(now);
  if (range === 'today') {
    return {
      range,
      start: today,
      end: now,
      prevStart: new Date(today.getTime() - DAY_MS),
      prevEnd: new Date(now.getTime() - DAY_MS),
      bucket: 'hour',
      buckets: Array.from({ length: 24 }, (_, i) => new Date(today.getTime() + i * HOUR_MS)),
    };
  }
  const days = range === '7d' ? 7 : 30;
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);
  const span = days * DAY_MS;
  return {
    range,
    start,
    end: now,
    prevStart: new Date(start.getTime() - span),
    prevEnd: new Date(now.getTime() - span),
    bucket: 'day',
    buckets: Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * DAY_MS)),
  };
}

/** Một đơn tối giản đủ để tính số liệu. */
export interface StatsOrderRow {
  createdAt: Date;
  status: string;
  restaurantId: string;
  subtotal: number;
  deliveryFee: number;
  platformCommission: number;
  cancelReason?: string | null;
  failedReason?: string | null;
}

export interface PeriodTotals {
  orders: number;
  delivered: number;
  cancelled: number;
  failed: number;
  /** GMV = tiền món của đơn giao thành công */
  gmv: number;
  deliveryFee: number;
  commission: number;
}

export function summarizePeriod(rows: StatsOrderRow[]): PeriodTotals {
  const t: PeriodTotals = { orders: 0, delivered: 0, cancelled: 0, failed: 0, gmv: 0, deliveryFee: 0, commission: 0 };
  for (const r of rows) {
    t.orders++;
    if (r.status === 'DELIVERED') {
      t.delivered++;
      t.gmv += r.subtotal;
      t.deliveryFee += r.deliveryFee;
      t.commission += r.platformCommission;
    } else if (r.status === 'CANCELLED') {
      t.cancelled++;
    } else if (r.status === 'DELIVERY_FAILED') {
      t.failed++;
    }
  }
  return t;
}

/** % thay đổi so với kỳ trước; null khi kỳ trước bằng 0 (không chia cho 0, giao diện hiện "Mới"). */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Tỉ lệ phần trăm làm tròn 1 chữ số; 0 khi mẫu số bằng 0. */
export function ratio(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export interface KpiValue {
  value: number;
  previous: number;
  changePct: number | null;
}

export type KpiKey =
  | 'gmv'
  | 'orders'
  | 'aov'
  | 'successRate'
  | 'cancelRate'
  | 'deliveryFee'
  | 'commission';

function derive(t: PeriodTotals): Record<KpiKey, number> {
  const finished = t.delivered + t.cancelled + t.failed;
  return {
    gmv: t.gmv,
    orders: t.orders,
    aov: t.delivered ? Math.round(t.gmv / t.delivered) : 0,
    // Chỉ tính trên đơn đã kết thúc: đơn còn đang chạy chưa thể coi là thành công hay thất bại
    successRate: ratio(t.delivered, finished),
    cancelRate: ratio(t.cancelled + t.failed, finished),
    deliveryFee: t.deliveryFee,
    commission: t.commission,
  };
}

export function buildKpis(current: PeriodTotals, previous: PeriodTotals): Record<KpiKey, KpiValue> {
  const cur = derive(current);
  const prev = derive(previous);
  return Object.fromEntries(
    (Object.keys(cur) as KpiKey[]).map((k) => {
      // Tỉ lệ: so sánh bằng điểm phần trăm chênh lệch, không phải % của %
      const isRate = k === 'successRate' || k === 'cancelRate';
      const changePct = isRate
        ? current.orders && previous.orders
          ? Math.round((cur[k] - prev[k]) * 10) / 10
          : null
        : percentChange(cur[k], prev[k]);
      return [k, { value: cur[k], previous: prev[k], changePct }];
    }),
  ) as Record<KpiKey, KpiValue>;
}

export interface SeriesPoint {
  /** Mốc bắt đầu cột (ISO, UTC) */
  at: string;
  /** Nhãn ngắn: "14h" hoặc "02/11" */
  label: string;
  gmv: number;
  orders: number;
}

function bucketLabel(at: Date, bucket: 'hour' | 'day'): string {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  if (bucket === 'hour') return `${vn.getUTCHours()}h`;
  return `${String(vn.getUTCDate()).padStart(2, '0')}/${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function buildSeries(rows: StatsOrderRow[], win: StatsWindow): SeriesPoint[] {
  const step = win.bucket === 'hour' ? HOUR_MS : DAY_MS;
  const points = win.buckets.map((b) => ({ at: b.toISOString(), label: bucketLabel(b, win.bucket), gmv: 0, orders: 0 }));
  const first = win.buckets[0]?.getTime() ?? 0;
  for (const r of rows) {
    const idx = Math.floor((r.createdAt.getTime() - first) / step);
    if (idx < 0 || idx >= points.length) continue;
    points[idx].orders++;
    if (r.status === 'DELIVERED') points[idx].gmv += r.subtotal;
  }
  return points;
}

export interface TopRestaurantRow {
  restaurantId: string;
  gmv: number;
  orders: number;
}

/** Top quán theo GMV (đơn giao thành công); hoà GMV thì quán nhiều đơn hơn đứng trước. */
export function topRestaurantsByGmv(rows: StatsOrderRow[], limit = 5): TopRestaurantRow[] {
  const map = new Map<string, TopRestaurantRow>();
  for (const r of rows) {
    if (r.status !== 'DELIVERED') continue;
    const cur = map.get(r.restaurantId) ?? { restaurantId: r.restaurantId, gmv: 0, orders: 0 };
    cur.gmv += r.subtotal;
    cur.orders++;
    map.set(r.restaurantId, cur);
  }
  return [...map.values()].sort((a, b) => b.gmv - a.gmv || b.orders - a.orders).slice(0, limit);
}

export interface ReasonCount {
  kind: 'cancel' | 'failed';
  reason: string;
  count: number;
}

/** Đếm lý do huỷ / giao thất bại, nhiều nhất trước. Thiếu lý do thì gom vào "OTHER". */
export function countEndReasons(rows: StatsOrderRow[]): ReasonCount[] {
  const map = new Map<string, ReasonCount>();
  for (const r of rows) {
    let kind: ReasonCount['kind'] | null = null;
    let reason = 'OTHER';
    if (r.status === 'CANCELLED') {
      kind = 'cancel';
      reason = r.cancelReason ?? 'OTHER';
    } else if (r.status === 'DELIVERY_FAILED') {
      kind = 'failed';
      reason = r.failedReason ?? 'OTHER';
    }
    if (!kind) continue;
    const key = `${kind}:${reason}`;
    const cur = map.get(key) ?? { kind, reason, count: 0 };
    cur.count++;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
