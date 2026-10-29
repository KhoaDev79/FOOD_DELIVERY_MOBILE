/**
 * Tiện ích xử lý và kiểm định chuỗi địa chỉ giao hàng tại Việt Nam.
 */

/**
 * Kiểm tra xem chuỗi địa chỉ có phải là tọa độ thô hoặc fallback lỗi hay không.
 * Ngăn chặn tuyệt đối việc lưu chuỗi này vào cơ sở dữ liệu làm địa chỉ hiển thị.
 */
export function isCoordinateAddress(address?: string | null): boolean {
  if (!address || typeof address !== 'string') return true;
  const trimmed = address.trim();
  if (!trimmed) return true;

  // Bắt đầu bằng tiền tố Tọa độ, Toạ độ, Coordinates, Vị trí hiện tại (...)
  if (/^(t[oọ][aạ]\s*đ[oộ]|coordinates?|latlng|vị trí hiện tại \(|toạ độ)/i.test(trimmed)) {
    return true;
  }

  // Chứa pattern [Ghi chú: ...] Tọa độ: ...
  if (/t[oọ][aạ]\s*đ[oộ]:\s*[-+]?\d/i.test(trimmed)) {
    return true;
  }

  // Chuỗi chỉ gồm 2 số thập phân cách nhau bởi dấu phẩy, chấm phẩy hoặc khoảng trắng
  const coordRegex = /^\[?\s*[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s*[,;\s]\s*[-+]?(180(\.0+)?|((1[0-7]\d)|(\d{1,2}))(\.\d+)?)\s*\]?$/;
  if (coordRegex.test(trimmed)) {
    return true;
  }

  // Quá ngắn hoặc không có chữ cái
  if (trimmed.length < 5 || !/[a-zA-ZÀ-ỹ]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Kiểm tra xem địa chỉ có phải là địa chỉ suy đoán/mẫu từ code cũ cần xác nhận lại hay không
 * (Ví dụ địa chỉ chứa "496 Dương Quảng Hàm" được hardcode trước đây).
 */
export function isInferredMockAddress(address?: string | null): boolean {
  if (!address || typeof address !== 'string') return false;
  return /496\s*dương\s*quảng\s*hàm/i.test(address);
}

/**
 * Xử lý làm sạch và kiểm định dòng địa chỉ:
 * - Chuẩn hoá loại bỏ lặp cấp hành chính
 * - Phát hiện toạ độ thô và gắn tiền tố [Cần xác nhận]
 * - Phát hiện địa chỉ suy đoán cũ và bật needsConfirmation
 * - Đảm bảo tính Idempotent: chạy lại nhiều lần kết quả không đổi
 */
export function cleanAndValidateAddress(
  rawAddress: string,
  lat: number,
  lng: number,
  currentNeedsConfirmation = false,
): {
  cleanedAddress: string;
  needsConfirmation: boolean;
  isModified: boolean;
  reason?: string;
} {
  let address = (rawAddress || '').trim();
  let needsConfirmation = currentNeedsConfirmation;
  const reasons: string[] = [];

  // 1. Kiểm tra toạ độ thô
  if (isCoordinateAddress(address)) {
    if (!address.startsWith('[Cần xác nhận]')) {
      address = `[Cần xác nhận] Vị trí toạ độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      needsConfirmation = true;
      reasons.push('Toạ độ thô');
    }
  }

  // 2. Kiểm tra địa chỉ suy đoán từ code cũ
  if (isInferredMockAddress(address)) {
    if (!needsConfirmation) {
      needsConfirmation = true;
      reasons.push('Địa chỉ mẫu suy đoán cũ');
    }
  }

  // 3. Khử trùng lặp phường/xã/tỉnh
  const deduplicated = formatAddress(address);
  if (deduplicated !== address) {
    address = deduplicated;
    reasons.push('Khử lặp cấp hành chính');
  }

  const isModified = address !== rawAddress || needsConfirmation !== currentNeedsConfirmation;

  return {
    cleanedAddress: address,
    needsConfirmation,
    isModified,
    reason: reasons.length > 0 ? reasons.join(' & ') : undefined,
  };
}

/**
 * Chuẩn hoá và loại bỏ các thành phần bị lặp lại trong chuỗi địa chỉ.
 * Ví dụ: "6, Hẻm 496/32 Dương Quảng Hàm, P. An Nhơn, P. An Nhơn"
 * -> "6, Hẻm 496/32 Dương Quảng Hàm, P. An Nhơn"
 */
export function formatAddress(rawAddress?: string | null): string {
  if (!rawAddress || typeof rawAddress !== 'string') return '';

  // Tách các thành phần theo dấu phẩy
  const parts = rawAddress
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return '';

  const cleanedParts: string[] = [];
  const normalizedSeen = new Set<string>();

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Chuẩn hoá để so sánh nội dung cốt lõi (bỏ tiền tố hành chính)
    const normalized = part
      .toLowerCase()
      .replace(/^(phường|p\.|xã|x\.|thị trấn|tt\.|quận|q\.|huyện|h\.|thành phố|tp\.|tỉnh)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Kiểm tra trùng với phần tử ngay trước đó
    const prevCleaned = cleanedParts[cleanedParts.length - 1];
    if (prevCleaned) {
      const prevNormalized = prevCleaned
        .toLowerCase()
        .replace(/^(phường|p\.|xã|x\.|thị trấn|tt\.|quận|q\.|huyện|h\.|thành phố|tp\.|tỉnh)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (normalized === prevNormalized) {
        continue;
      }
    }

    // Nếu đã xuất hiện trước đó trong chuỗi hành chính (độ dài >= 2)
    if (normalized.length >= 2 && normalizedSeen.has(normalized)) {
      continue;
    }

    cleanedParts.push(part);
    if (normalized.length >= 2) {
      normalizedSeen.add(normalized);
    }
  }

  return cleanedParts.join(', ');
}

