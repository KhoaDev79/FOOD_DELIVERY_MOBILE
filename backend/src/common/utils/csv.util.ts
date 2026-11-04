/**
 * Tạo file CSV mở được bằng Excel / Google Sheets với tiếng Việt có dấu.
 * - Có BOM UTF-8 để Excel nhận đúng bảng mã (không có thì chữ Việt bị lỗi font).
 * - Số để nguyên (không dấu chấm ngăn cách) để Excel tính tổng được.
 * - Chặn "CSV injection": ô bắt đầu bằng = + - @ bị Excel hiểu là công thức (tên quán do người dùng nhập).
 */

export const CSV_BOM = '﻿';

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Khoảng xuất tối đa: tránh truy vấn quá nặng trên máy chủ miễn phí. */
export const MAX_EXPORT_DAYS = 366;

/**
 * Chuyển khoảng ngày theo lịch VN "YYYY-MM-DD" (gồm cả 2 đầu) thành mốc UTC [start, end).
 * Không truyền thì mặc định 30 ngày gần nhất tính đến hôm nay.
 */
export function vnDateRange(
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): { start: Date; end: Date; from: string; to: string } {
  const today = new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
  const toKey = to || today;
  const fromKey = from || new Date(Date.parse(`${toKey}T00:00:00Z`) - 29 * DAY_MS).toISOString().slice(0, 10);
  if (!DATE_RE.test(fromKey) || !DATE_RE.test(toKey) || Number.isNaN(Date.parse(fromKey)) || Number.isNaN(Date.parse(toKey))) {
    throw new RangeError('Ngày không hợp lệ, dùng định dạng YYYY-MM-DD');
  }
  const start = new Date(Date.parse(`${fromKey}T00:00:00Z`) - VN_OFFSET_MS);
  const end = new Date(Date.parse(`${toKey}T00:00:00Z`) - VN_OFFSET_MS + DAY_MS);
  if (end <= start) throw new RangeError('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc');
  if ((end.getTime() - start.getTime()) / DAY_MS > MAX_EXPORT_DAYS) {
    throw new RangeError(`Chỉ xuất tối đa ${MAX_EXPORT_DAYS} ngày mỗi lần`);
  }
  return { start, end, from: fromKey, to: toKey };
}

/** "02/11/2026 14:05" theo giờ VN. */
export function vnDateTime(d: Date): string {
  const v = new Date(d.getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(v.getUTCDate())}/${p(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`;
}

export const ORDER_STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ quán nhận',
  CONFIRMED: 'Quán đã nhận',
  PREPARING: 'Đang làm món',
  READY_FOR_PICKUP: 'Chờ tài xế',
  PICKED_UP: 'Đang giao',
  DELIVERED: 'Giao thành công',
  DELIVERY_FAILED: 'Giao thất bại',
  CANCELLED: 'Đã huỷ',
};

export const CANCEL_REASON_VI: Record<string, string> = {
  CUSTOMER_CHANGED_MIND: 'Khách đổi ý',
  CUSTOMER_WRONG_ITEMS: 'Khách đặt nhầm món',
  CUSTOMER_WRONG_ADDRESS: 'Khách nhập sai địa chỉ',
  CUSTOMER_WAIT_TOO_LONG: 'Khách chờ quá lâu',
  CUSTOMER_FOUND_ALTERNATIVE: 'Khách chọn quán khác',
  CUSTOMER_OTHER: 'Khách huỷ (lý do khác)',
  RESTAURANT_TIMEOUT: 'Quán không nhận đúng hạn',
  RESTAURANT_OUT_OF_STOCK: 'Quán hết món',
  RESTAURANT_CLOSED: 'Quán đóng cửa',
  RESTAURANT_OTHER: 'Lý do khác từ quán',
  ADMIN_INTERVENTION: 'Admin can thiệp',
  CUSTOMER_UNREACHABLE: 'Không liên lạc được khách',
  CUSTOMER_REFUSED: 'Khách từ chối nhận',
  WRONG_ADDRESS: 'Sai địa chỉ',
  UNSAFE_LOCATION: 'Khu vực không an toàn',
};

/** Tên file: zomzom-don-hang_2026-10-01_2026-10-31.csv */
export function csvFileName(prefix: string, from: string, to: string): string {
  return `${prefix}_${from}_${to}.csv`;
}
