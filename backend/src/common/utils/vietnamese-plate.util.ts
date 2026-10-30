/**
 * Chuẩn hoá và kiểm tra định dạng biển số xe Việt Nam.
 * Ví dụ hợp lệ:
 *  - Xe máy 5 số: '59-X1 123.45', '29-H1 888.88', '43-B1 999.99', '59X1-123.45', '59-X1 12345'
 *  - Xe máy 4 số: '29-H1 8888', '51-F2 1234'
 *  - Xe máy điện: '59-MĐ1 123.45', '29-M1 123.45'
 *  - Ô tô: '51A-123.45', '30E-888.88'
 */
export function normalizeLicensePlate(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim().toUpperCase();
  return trimmed || null;
}

const VN_PLATE_REGEX = /^[0-9]{2}[- ]?[A-ZĐ]{1,2}[0-9]?[- ](?:[0-9]{4,5}|[0-9]{3}\.[0-9]{2})$/i;

export function isValidVietnameseLicensePlate(plate?: string | null): boolean {
  if (!plate) return false;
  const normalized = normalizeLicensePlate(plate);
  if (!normalized) return false;
  return VN_PLATE_REGEX.test(normalized);
}

/** Ẩn số tài khoản ngân hàng, chỉ hiển thị 4 số cuối: **** 1234 */
export function maskBankAccountNumber(accountNumber?: string | null): string | null {
  if (!accountNumber) return null;
  const clean = accountNumber.trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `**** ${last4}`;
}
