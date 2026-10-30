/**
 * Bộ nhớ đệm LRU (Least Recently Used) có giới hạn kích thước tối đa và thời hạn sống (TTL).
 * Tránh hiện tượng Map phình bộ nhớ vô hạn khi chạy lâu ngày.
 */
export class LruCache<T> {
  private readonly cache = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly defaultTtlMs = 24 * 60 * 60 * 1000,
    private readonly maxSize = 10000,
  ) {}

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Đẩy khoá vừa truy cập lên cuối Map (mới nhất)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

