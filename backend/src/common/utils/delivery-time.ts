/**
 * Thời gian giao dự kiến (phút) — MỘT công thức dùng chung cho trang chủ, chi tiết quán và báo giá
 * (bản sao phía app: mobile/src/utils/fee.ts, phải giữ giống nhau).
 *
 *   Tổng = quán làm món + tài xế tới quán + chạy xe từ quán tới khách + bàn giao
 *
 * - Chạy xe: ưu tiên thời gian thật của tuyến đường (Goong); không có thì ước tính 3 phút/km
 *   (xe máy trong phố ~20 km/h, đã gồm đèn đỏ).
 * - Giờ cao điểm: quán làm chậm hơn (+5 phút) và đường đông hơn (x1.25).
 * - Khoảng (min–max) rộng dần theo quãng đường vì đi xa khó đoán hơn; làm tròn 5 phút cho dễ đọc.
 */
export const PREP_MINUTES = 10;
export const PEAK_EXTRA_PREP_MINUTES = 5;
export const DRIVER_TO_RESTAURANT_MINUTES = 5;
export const HANDOVER_MINUTES = 2;
export const MINUTES_PER_KM = 3;
export const PEAK_TRAFFIC_FACTOR = 1.25;

export interface DeliveryWindow {
  min: number;
  max: number;
}

const roundTo5 = (n: number) => Math.round(n / 5) * 5;

export function estimateDeliveryWindow(input: {
  /** Quãng đường xe chạy (km, theo đường bộ). */
  distanceKm: number;
  /** Thời gian chạy xe thật của tuyến đường (phút), nếu có. */
  roadMinutes?: number;
  isPeak?: boolean;
}): DeliveryWindow {
  const { distanceKm, roadMinutes, isPeak = false } = input;
  const baseTravel = roadMinutes && roadMinutes > 0 ? roadMinutes : Math.max(0, distanceKm) * MINUTES_PER_KM;
  const travel = Math.max(2, baseTravel * (isPeak ? PEAK_TRAFFIC_FACTOR : 1));
  const prep = PREP_MINUTES + (isPeak ? PEAK_EXTRA_PREP_MINUTES : 0);
  const total = prep + DRIVER_TO_RESTAURANT_MINUTES + travel + HANDOVER_MINUTES;

  // Độ dao động: chặng ngắn ±5 phút, chặng vừa ±10, chặng dài ±15
  const spread = travel <= 10 ? 5 : travel <= 25 ? 10 : 15;
  const min = Math.max(15, roundTo5(total));
  const max = Math.max(min + 5, roundTo5(total + spread));
  return { min, max };
}
