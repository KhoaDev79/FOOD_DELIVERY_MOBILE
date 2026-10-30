import { LruCache } from '../../../common/utils/lru-cache.util';

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
 * Bộ nhớ đệm (In-memory Cache) lưu kết quả phân giải địa chỉ và gợi ý tìm kiếm có thời hạn (TTL)
 * và giới hạn kích thước LRU (tối đa 10.000 khoá).
 */
export class SimpleCache<T> extends LruCache<T> {
  constructor(defaultTtlMs = 24 * 60 * 60 * 1000, maxSize = 10000) {
    super(defaultTtlMs, maxSize);
  }
}

