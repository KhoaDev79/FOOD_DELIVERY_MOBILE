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
 * Ước tính thời gian giao hàng hiển thị trên danh sách quán dựa trên khoảng cách (km).
 * Khi đặt đơn và theo dõi đơn, thời gian thực tế lấy từ báo giá (POST /orders/quote) và Order.estimatedDeliveryAt.
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
