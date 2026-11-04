/**
 * Giới hạn tần suất kiểu "cửa sổ trượt": chỉ giữ các lần ghi nhận trong khoảng windowMs gần nhất.
 * Hàm thuần (không đọc đồng hồ, không giữ trạng thái) để dễ test; RateLimitService lo phần lưu trữ.
 */

export interface RateLimitPolicy {
  /** Số lần tối đa trong một cửa sổ */
  limit: number;
  windowMs: number;
  /** Câu báo khi bị chặn; nhận chuỗi thời gian chờ đã định dạng ("45 giây", "12 phút") */
  message: (retryAfter: string) => string;
}

/** Một lần ghi nhận. `value` dùng khi chỉ đếm giá trị KHÁC NHAU (vd: các mã voucher sai khác nhau). */
export interface RateLimitHit {
  at: number;
  value?: string;
}

export interface RateLimitState {
  hits: RateLimitHit[];
  /** Đã chạm giới hạn chưa (lần tiếp theo sẽ bị chặn) */
  blocked: boolean;
  remaining: number;
  /** Bao lâu nữa mới thử lại được (0 nếu chưa bị chặn) */
  retryAfterMs: number;
}

type WindowSize = Pick<RateLimitPolicy, 'limit' | 'windowMs'>;

/** Bỏ các lần đã trôi ra khỏi cửa sổ rồi tính trạng thái hiện tại. */
export function evaluateWindow(hits: RateLimitHit[], now: number, policy: WindowSize): RateLimitState {
  const fresh = hits.filter((h) => now - h.at < policy.windowMs);
  const blocked = fresh.length >= policy.limit;
  // Hết chặn khi lần cũ nhất trong nhóm "limit lần gần nhất" trôi ra khỏi cửa sổ
  const retryAfterMs = blocked ? Math.max(0, fresh[fresh.length - policy.limit].at + policy.windowMs - now) : 0;
  return { hits: fresh, blocked, remaining: Math.max(0, policy.limit - fresh.length), retryAfterMs };
}

/**
 * Ghi nhận thêm một lần. Nếu có `value` mà giá trị đó đã có trong cửa sổ thì chỉ làm mới thời điểm,
 * không tính thêm lượt (gửi lại cùng mã / cùng idempotency-key không bị phạt).
 */
export function recordHit(hits: RateLimitHit[], now: number, policy: WindowSize, value?: string): RateLimitState {
  const current = evaluateWindow(hits, now, policy);
  const others = value === undefined ? current.hits : current.hits.filter((h) => h.value !== value);
  const next: RateLimitHit[] = [...others, value === undefined ? { at: now } : { at: now, value }];
  // Giữ tối đa `limit` lần gần nhất: đủ để tính chặn, không phình bộ nhớ
  return evaluateWindow(next.slice(-policy.limit), now, policy);
}

/** "45 giây", "3 phút", "1 giờ 5 phút". Làm tròn lên để không báo sớm hơn thực tế. */
export function formatRetryAfter(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}
