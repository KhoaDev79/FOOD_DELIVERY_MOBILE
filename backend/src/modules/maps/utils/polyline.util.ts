/**
 * Giải mã chuỗi "encoded polyline" (định dạng của Google/Goong, độ chính xác 5 chữ số)
 * thành danh sách toạ độ để vẽ đường đi trên bản đồ.
 */
export function decodePolyline(encoded: string, precision = 5): { latitude: number; longitude: number }[] {
  const factor = Math.pow(10, precision);
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const nextValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
      // Hết chuỗi giữa chừng thì charCodeAt trả NaN, so sánh sai nên vòng lặp tự dừng
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += nextValue();
    lng += nextValue();
    points.push({ latitude: lat / factor, longitude: lng / factor });
  }
  return points;
}
