import { estimateDeliveryWindow } from './delivery-time';
import { parsePeakWindows, PeakWindow } from '../../config/configuration';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

export function ceil1000(amount: number): number {
  if (amount <= 0) return 0;
  return Math.ceil(amount / 1000) * 1000;
}

/** Khoảng cách đường chim bay giữa 2 tọa độ (km) theo công thức Haversine. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Hình chữ nhật bao quanh vòng tròn bán kính `radiusKm`.
 * Dùng để lọc thô bằng index (latitude, longitude) trước khi tính Haversine chính xác.
 */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const cosLat = Math.cos(toRad(center.lat));
  // Gần cực cosLat -> 0: mở rộng toàn bộ kinh độ
  const lngDelta = cosLat < 1e-6 ? 180 : latDelta / cosLat;
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * Kiểm tra xem thời điểm hiện tại có thuộc khung giờ cao điểm hay không (theo cấu hình DELIVERY_PEAK_WINDOWS, giờ VN UTC+7).
 */
export function isPeakHour(date = new Date(), windows?: PeakWindow[]): boolean {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 3600000 * 7);
  const minutesOfDay = vnDate.getHours() * 60 + vnDate.getMinutes();

  const resolvedWindows =
    windows ?? parsePeakWindows(process.env.DELIVERY_PEAK_WINDOWS ?? '11:00-13:00,17:30-19:30');

  return resolvedWindows.some((w) =>
    w.startMinutes <= w.endMinutes
      ? minutesOfDay >= w.startMinutes && minutesOfDay <= w.endMinutes
      : minutesOfDay >= w.startMinutes || minutesOfDay <= w.endMinutes,
  );
}

export interface DeliveryFeeOptions {
  baseFee?: number;
  feePerKm?: number;
  freeKm?: number;
  peakMultiplier?: number;
  peakWindows?: PeakWindow[];
}

export interface DeliveryFeeBreakdown {
  baseDeliveryFee: number;
  peakSurcharge: number;
  deliveryFee: number;
  isPeak: boolean;
}

/**
 * Tính chi tiết phí giao hàng theo khoảng cách và khung giờ:
 * - baseDeliveryFee = ceil1000(base + max(0, km − freeKm) × perKm)
 * - peakSurcharge = ceil1000((multiplier − 1) × baseDeliveryFee) nếu giờ cao điểm, ngược lại 0
 * - deliveryFee = baseDeliveryFee + peakSurcharge
 */
export function calcDeliveryFeeBreakdown(
  distanceKm: number,
  opts?: DeliveryFeeOptions,
  date = new Date(),
): DeliveryFeeBreakdown {
  const baseFee = opts?.baseFee ?? parseInt(process.env.DELIVERY_BASE_FEE ?? '15000', 10);
  const feePerKm = opts?.feePerKm ?? parseInt(process.env.DELIVERY_FEE_PER_KM ?? '5000', 10);
  const freeKm = opts?.freeKm ?? parseFloat(process.env.DELIVERY_FREE_KM ?? '2');
  const peakMultiplier = opts?.peakMultiplier ?? parseFloat(process.env.DELIVERY_PEAK_MULTIPLIER ?? '1.2');

  const billableKm = Math.max(0, distanceKm - freeKm);
  const baseDeliveryFee = ceil1000(baseFee + billableKm * feePerKm);
  const isPeak = isPeakHour(date, opts?.peakWindows);
  const peakSurcharge = isPeak && peakMultiplier > 1 ? ceil1000((peakMultiplier - 1) * baseDeliveryFee) : 0;
  const deliveryFee = baseDeliveryFee + peakSurcharge;

  return {
    baseDeliveryFee,
    peakSurcharge,
    deliveryFee,
    isPeak,
  };
}

export function calcDeliveryFee(
  distanceKm: number,
  opts?: DeliveryFeeOptions,
  date = new Date(),
): number {
  return calcDeliveryFeeBreakdown(distanceKm, opts, date).deliveryFee;
}

export interface DeliveryEstimation {
  distanceKm: number;
  baseDeliveryFee: number;
  peakSurcharge: number;
  deliveryFee: number;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  estimatedDurationText: string;
  isPeakHour: boolean;
  disclaimer: string;
}

/**
 * Hàm tính phí giao và thời gian dự kiến trên server, dùng chung cho
 * Trang chủ (Nearby), Chi tiết quán (Detail), và Báo giá (Quote).
 */
export function estimateDelivery(
  distanceKm: number,
  date = new Date(),
  opts?: DeliveryFeeOptions,
  roadDurationMinutes?: number,
): DeliveryEstimation {
  const breakdown = calcDeliveryFeeBreakdown(distanceKm, opts, date);

  // Một công thức dùng chung (common/utils/delivery-time.ts): làm món + tài xế tới quán + chạy xe + bàn giao
  const { min: minMinutes, max: maxMinutes } = estimateDeliveryWindow({
    distanceKm,
    roadMinutes: roadDurationMinutes,
    isPeak: breakdown.isPeak,
  });

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseDeliveryFee: breakdown.baseDeliveryFee,
    peakSurcharge: breakdown.peakSurcharge,
    deliveryFee: breakdown.deliveryFee,
    estimatedMinutesMin: minMinutes,
    estimatedMinutesMax: maxMinutes,
    estimatedDurationText: `${minMinutes}-${maxMinutes} phút`,
    isPeakHour: breakdown.isPeak,
    disclaimer: 'Ước lượng dự kiến dựa trên khoảng cách và tình trạng giao thông.',
  };
}
