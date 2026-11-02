/**
 * Kiểm tra số di động VN ngay trên form, cùng quy tắc với backend (common/utils/phone.util.ts).
 * Server vẫn là nơi quyết định cuối cùng; ở đây chỉ để báo lỗi sớm cho người dùng.
 */
export const VN_MOBILE_REGEX = /^0[35789]\d{8}$/;

/** "0912 345 678", "+84912345678", "84912345678" → "0912345678". */
export function normalizeVnPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (/^84\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  return compact;
}
