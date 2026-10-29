/**
 * Tiện ích giới hạn tốc độ gọi API (Rate Limiter) bảo đảm tuân thủ nghiêm ngặt chính sách của nhà cung cấp.
 */
export class RateLimiter {
  private lastRequestTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }
}

/**
 * Bộ nhớ đệm (In-memory Cache) lưu kết quả phân giải địa chỉ và gợi ý tìm kiếm có thời hạn (TTL).
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly defaultTtlMs = 24 * 60 * 60 * 1000) {}

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

