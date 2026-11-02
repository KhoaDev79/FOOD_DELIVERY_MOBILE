/**
 * Số di động Việt Nam lưu thống nhất dạng 10 chữ số bắt đầu bằng 0 (vd. 0912345678).
 * Nhờ vậy "0912 345 678", "+84912345678", "84912345678" là CÙNG một số khi kiểm tra trùng.
 */

/** Đầu số di động VN hiện hành: 03x, 05x, 07x, 08x, 09x (10 chữ số). */
export const VN_MOBILE_REGEX = /^0[35789]\d{8}$/;

/** Bỏ dấu cách/chấm/gạch/ngoặc và đổi đầu +84 hoặc 84 thành 0. Không đổi được thì trả nguyên chuỗi đã bỏ ký tự phân cách. */
export function normalizeVnPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (/^84\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}

/** Dùng trong @Transform của DTO: chuỗi rỗng coi như không nhập. */
export function transformOptionalPhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = normalizeVnPhone(value);
  return normalized === '' ? undefined : normalized;
}
