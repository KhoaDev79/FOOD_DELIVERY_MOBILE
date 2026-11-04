/**
 * Kiểm tra số di động VN ngay trên form, cùng quy tắc với backend (common/utils/phone.util.ts).
 * Server vẫn là nơi quyết định cuối cùng; ở đây chỉ để báo lỗi sớm cho người dùng.
 */
export const VN_MOBILE_REGEX = /^0[35789]\d{8}$/;

/** "0912 345 678", "+84912345678", "84912345678", "912345678" (ô có sẵn +84) → "0912345678". */
export function normalizeVnPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
  if (/^84\d{9}$/.test(compact)) return `0${compact.slice(2)}`;
  // Ô nhập đã hiện sẵn +84 nên người dùng hay gõ thiếu số 0 đầu
  if (/^[35789]\d{8}$/.test(compact)) return `0${compact}`;
  return compact;
}

/**
 * Định dạng số khi đang gõ cho dễ đọc: "0912 345 678" (có số 0) hoặc "912 345 678" (không số 0).
 * Chỉ giữ chữ số, cắt bớt phần thừa; giá trị gửi lên server vẫn qua normalizeVnPhone.
 */
export function formatVnPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+84') || (digits.startsWith('84') && digits.length > 10)) digits = digits.slice(2);
  const withZero = digits.startsWith('0');
  digits = digits.slice(0, withZero ? 10 : 9);
  const groups = withZero ? [4, 3, 3] : [3, 3, 3];
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  return parts.join(' ');
}
