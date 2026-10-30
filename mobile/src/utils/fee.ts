/**
 * Kiểm tra xem thời điểm hiện tại có phải khung giờ cao điểm hay không.
 * Khung giờ cao điểm:
 * - Trưa: 11:00 đến 13:00 (10.000đ / km)
 * - Chiều tối: 17:30 đến 19:30 (10.000đ / km)
 * Giờ thường: 5.000đ / km
 */
export const isPeakHour = (date = new Date()): boolean => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 3600000 * 7);
  const minutes = vnDate.getHours() * 60 + vnDate.getMinutes();

  const isLunchPeak = minutes >= 11 * 60 && minutes <= 13 * 60;
  const isDinnerPeak = minutes >= 17 * 60 + 30 && minutes <= 19 * 60 + 30;

  return isLunchPeak || isDinnerPeak;
};

/**
 * Tính khoảng cách đường chim bay giữa hai toạ độ theo công thức Haversine (km)
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
};

/**
 * Phí giao hàng – PHẢI khớp backend (backend/src/common/utils/geo.util.ts › calcDeliveryFee),
 * vì backend là nơi thu tiền thật:
 *   phí = (phí cơ bản + max(0, km − km miễn phí) × phí/km) × (1,2 nếu giờ cao điểm), làm tròn lên 1.000đ.
 * Giá trị mặc định trùng .env.example của backend (DELIVERY_BASE_FEE, DELIVERY_FEE_PER_KM, DELIVERY_FREE_KM).
 * Nếu đổi cấu hình phí ở backend thì phải đổi DELIVERY_FEE_CONFIG ở đây.
 */
export const DELIVERY_FEE_CONFIG = { baseFee: 15000, feePerKm: 5000, freeKm: 2, peakMultiplier: 1.2 };

export const calculateDeliveryFee = (
  distanceKm: number,
  date = new Date(),
): { fee: number; isPeak: boolean; ratePerKm: number } => {
  const peak = isPeakHour(date);
  const { baseFee, feePerKm, freeKm, peakMultiplier } = DELIVERY_FEE_CONFIG;
  const multiplier = peak ? peakMultiplier : 1;
  const billableKm = Math.max(0, distanceKm - freeKm);
  const fee = Math.ceil(((baseFee + billableKm * feePerKm) * multiplier) / 1000) * 1000;
  return { fee, isPeak: peak, ratePerKm: feePerKm * multiplier };
};

/**
 * Ước tính thời gian giao hàng dựa trên khoảng cách thực tế (km):
 * - Thời gian chuẩn bị món của quán: ~10 - 15 phút
 * - Vận tốc di chuyển tài xế nội thành: ~3 - 4 phút / km
 */
export const estimateDeliveryTime = (distanceKm?: number): string => {
  if (distanceKm === undefined || distanceKm <= 0) return '15 - 20 phút';
  if (distanceKm <= 1.5) return '15 - 20 phút';
  if (distanceKm <= 3) return '20 - 25 phút';
  if (distanceKm <= 5) return '25 - 35 phút';
  if (distanceKm <= 8) return '35 - 45 phút';
  const minTime = Math.round(15 + distanceKm * 3);
  const maxTime = Math.round(20 + distanceKm * 4);
  return `${minTime} - ${maxTime} phút`;
};

/**
 * Kiểm tra xem đơn hàng có được Freeship hay không.
 * BẮT BUỘC: Nhãn "Freeship" chỉ được phép hiển thị khi phí giao hàng thật sự bằng 0
 * hoặc quán có chương trình Freeship rõ ràng.
 */
export const isFreeDelivery = (
  distanceKm: number,
  options?: { hasFreeShipPromo?: boolean; freeShipThresholdKm?: number },
): boolean => {
  if (options?.hasFreeShipPromo) return true;
  if (options?.freeShipThresholdKm && distanceKm <= options.freeShipThresholdKm) return true;
  const { fee } = calculateDeliveryFee(distanceKm);
  return fee === 0;
};
