const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
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
 * Kiểm tra xem thời điểm hiện tại có thuộc khung giờ cao điểm hay không.
 * Khung giờ cao điểm tại Việt Nam (UTC+7):
 * - Buổi trưa: 11:00 đến 13:00
 * - Buổi chiều tối: 17:30 đến 19:30
 */
export function isPeakHour(date = new Date()): boolean {
  // Chuyển sang múi giờ Việt Nam (UTC+7)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 3600000 * 7);
  const minutesOfDay = vnDate.getHours() * 60 + vnDate.getMinutes();

  const isLunchPeak = minutesOfDay >= 11 * 60 && minutesOfDay <= 13 * 60;
  const isDinnerPeak = minutesOfDay >= 17 * 60 + 30 && minutesOfDay <= 19 * 60 + 30;

  return isLunchPeak || isDinnerPeak;
}

/**
 * Tính phí giao hàng theo khoảng cách và khung giờ:
 * - Giờ cao điểm: 10.000 VNĐ / km
 * - Giờ bình thường: 5.000 VNĐ / km
 * - Làm tròn lên tới 1.000 VNĐ
 */
export function calcDeliveryFee(
  distanceKm: number,
  opts?: { baseFee?: number; feePerKm?: number; freeKm?: number },
  date = new Date(),
): number {
  const baseFee = opts?.baseFee ?? 15000;
  const feePerKm = opts?.feePerKm ?? 5000;
  const freeKm = opts?.freeKm ?? 2;

  const billableKm = Math.max(0, distanceKm - freeKm);
  const peakMultiplier = isPeakHour(date) ? 1.2 : 1.0;
  const fee = (baseFee + billableKm * feePerKm) * peakMultiplier;
  return Math.ceil(fee / 1000) * 1000;
}

export interface DeliveryEstimation {
  distanceKm: number;
  deliveryFee: number;
  estimatedMinutesMin: number;
  estimatedMinutesMax: number;
  estimatedDurationText: string;
  isPeakHour: boolean;
  disclaimer: string;
}

/**
 * Hàm duy nhất tính phí giao và thời gian dự kiến trên server, dùng chung cho
 * Trang chủ (Nearby), Chi tiết quán (Detail), và Thanh toán (Checkout).
 */
export function estimateDelivery(distanceKm: number, date = new Date()): DeliveryEstimation {
  const peak = isPeakHour(date);
  const fee = calcDeliveryFee(distanceKm, undefined, date);

  // Thời gian = Thời gian quán chuẩn bị món (~12 phút) + Thời gian di chuyển xe máy (~2.5 phút/km)
  const transitTime = Math.max(4, Math.round(distanceKm * 2.5));
  const prepTime = 12;
  const baseMinutes = prepTime + transitTime;
  const buffer = peak ? 10 : 5;

  const minMinutes = Math.max(15, baseMinutes);
  const maxMinutes = minMinutes + buffer;

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    deliveryFee: fee,
    estimatedMinutesMin: minMinutes,
    estimatedMinutesMax: maxMinutes,
    estimatedDurationText: `${minMinutes}-${maxMinutes} phút`,
    isPeakHour: peak,
    disclaimer: 'Ước lượng dự kiến dựa trên khoảng cách và tình trạng giao thông.',
  };
}

