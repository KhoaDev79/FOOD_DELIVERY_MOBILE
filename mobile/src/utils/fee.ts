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
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
};

/**
 * Tính biểu phí giao hàng động:
 * - Giờ cao điểm: 10.000 VNĐ / km
 * - Giờ thường: 5.000 VNĐ / km
 * - Tối thiểu 1km
 */
export const calculateDeliveryFee = (
  distanceKm: number,
  date = new Date(),
): { fee: number; isPeak: boolean; ratePerKm: number } => {
  const peak = isPeakHour(date);
  const ratePerKm = peak ? 10000 : 5000;
  const effectiveDistance = Math.max(1, distanceKm);
  const fee = Math.ceil((effectiveDistance * ratePerKm) / 1000) * 1000;
  return { fee, isPeak: peak, ratePerKm };
};

