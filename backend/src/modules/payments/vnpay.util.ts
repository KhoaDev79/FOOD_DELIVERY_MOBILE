import { createHmac, timingSafeEqual } from 'crypto';

export type VnpParams = Record<string, string>;

/** Encode giống thư viện mẫu của VNPay (querystring + khoảng trắng thành '+'). */
const vnpEncode = (v: string) => encodeURIComponent(v).replace(/%20/g, '+');

/** Chuỗi dữ liệu ký: sắp xếp key tăng dần, nối `key=value` đã encode bằng '&'. */
export function buildSignData(params: VnpParams): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${vnpEncode(k)}=${vnpEncode(params[k])}`)
    .join('&');
}

export function signVnp(params: VnpParams, secret: string): string {
  return createHmac('sha512', secret).update(Buffer.from(buildSignData(params), 'utf-8')).digest('hex');
}

/** Tạo URL thanh toán đầy đủ (đã gắn vnp_SecureHash). */
export function buildPaymentUrl(baseUrl: string, params: VnpParams, secret: string): string {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const hash = signVnp(clean, secret);
  return `${baseUrl}?${buildSignData(clean)}&vnp_SecureHash=${hash}`;
}

/** Xác thực chữ ký của request VNPay gửi về (IPN / Return). So sánh constant-time. */
export function verifyVnpSignature(query: Record<string, unknown>, secret: string): boolean {
  const received = typeof query.vnp_SecureHash === 'string' ? query.vnp_SecureHash.toLowerCase() : '';
  if (!received || !secret) return false;

  const params: VnpParams = {};
  for (const [k, v] of Object.entries(query)) {
    if (!k.startsWith('vnp_') || k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    if (typeof v === 'string') params[k] = v;
  }
  const expected = signVnp(params, secret);
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(received, 'utf-8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** yyyyMMddHHmmss theo múi giờ GMT+7 (yêu cầu của VNPay). */
export function formatVnpDate(date: Date): string {
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

/** Thanh toán thành công khi cả ResponseCode và TransactionStatus đều là '00'. */
export const isVnpSuccess = (q: Record<string, unknown>) =>
  q.vnp_ResponseCode === '00' && (q.vnp_TransactionStatus === undefined || q.vnp_TransactionStatus === '00');

