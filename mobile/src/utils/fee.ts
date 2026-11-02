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
 * Thời gian giao dự kiến (phút): CÙNG công thức với backend (backend/src/common/utils/delivery-time.ts).
 *   Tổng = quán làm món (10') + tài xế tới quán (5') + chạy xe (3'/km) + bàn giao (2')
 * Khoảng rộng dần theo quãng đường, làm tròn 5 phút. Màn đặt đơn / theo dõi đơn dùng số từ báo giá
 * (POST /orders/quote) và Order.estimatedDeliveryAt, vốn cũng tính bằng công thức này.
 */
const ROAD_FACTOR = 1.3; // quy đổi đường chim bay -> đường bộ, giống ROAD_DISTANCE_FALLBACK_FACTOR ở backend
const roundTo5 = (n: number) => Math.round(n / 5) * 5;

export function estimateDeliveryWindow(distanceKm: number, isPeak = false): { min: number; max: number } {
  const travel = Math.max(2, Math.max(0, distanceKm) * 3 * (isPeak ? 1.25 : 1));
  const total = 10 + (isPeak ? 5 : 0) + 5 + travel + 2;
  const spread = travel <= 10 ? 5 : travel <= 25 ? 10 : 15;
  const min = Math.max(15, roundTo5(total));
  return { min, max: Math.max(min + 5, roundTo5(total + spread)) };
}

/**
 * Nhãn "25 - 30 phút".
 * @param straightLine true khi distanceKm là đường chim bay (danh sách quán, chi tiết quán) để quy đổi ra đường bộ.
 */
export const estimateDeliveryTime = (distanceKm?: number, straightLine = false): string => {
  const d = distanceKm === undefined || distanceKm < 0 ? 0 : distanceKm;
  const { min, max } = estimateDeliveryWindow(straightLine ? d * ROAD_FACTOR : d);
  return `${min} - ${max} phút`;
};

/**
 * Kiểm tra xem đơn hàng có được Freeship hay không.
 * Nhãn "Freeship" chỉ được phép hiển thị khi phí giao hàng ước tính từ server bằng 0
 * hoặc quán có chương trình Freeship rõ ràng.
 */
export const isFreeDelivery = (
  distanceKm: number,
  options?: { hasFreeShipPromo?: boolean; freeShipThresholdKm?: number; estimatedDeliveryFee?: number },
): boolean => {
  if (options?.hasFreeShipPromo) return true;
  if (options?.freeShipThresholdKm && distanceKm <= options.freeShipThresholdKm) return true;
  if (options?.estimatedDeliveryFee !== undefined) return options.estimatedDeliveryFee === 0;
  return false;
};
