import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LruCache } from '../utils/lru-cache.util';
import { RateLimitedException } from './rate-limit.exception';
import { RATE_LIMIT_POLICIES, RateLimitPolicyName } from './rate-limit.policies';
import { evaluateWindow, formatRetryAfter, RateLimitHit, RateLimitState, recordHit } from './rate-limit.util';

/**
 * Bộ đếm giới hạn tần suất lưu trong bộ nhớ tiến trình.
 * Giới hạn: chạy nhiều instance thì mỗi instance đếm riêng (đủ cho 1 máy chủ; nhiều máy thì chuyển sang Redis).
 */
@Injectable()
export class RateLimitService {
  private readonly store = new LruCache<RateLimitHit[]>(60 * 60 * 1000, 50_000);
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('security.rateLimitEnabled') ?? true;
  }

  /** Xem trạng thái, không ghi nhận. */
  status(name: RateLimitPolicyName, key: string, now = Date.now()): RateLimitState {
    const policy = RATE_LIMIT_POLICIES[name];
    if (!this.enabled) return { hits: [], blocked: false, remaining: policy.limit, retryAfterMs: 0 };
    return evaluateWindow(this.store.get(this.storeKey(name, key)) ?? [], now, policy);
  }

  /** Ném 429 nếu đã chạm giới hạn (gọi trước khi xử lý). */
  assertAllowed(name: RateLimitPolicyName, key: string, now = Date.now()): void {
    const state = this.status(name, key, now);
    if (state.blocked) throw this.toException(name, state.retryAfterMs);
  }

  /** Ghi nhận 1 lần (vd: 1 lần đăng nhập sai). Trả trạng thái sau khi ghi. */
  record(name: RateLimitPolicyName, key: string, value?: string, now = Date.now()): RateLimitState {
    const policy = RATE_LIMIT_POLICIES[name];
    if (!this.enabled) return { hits: [], blocked: false, remaining: policy.limit, retryAfterMs: 0 };
    const storeKey = this.storeKey(name, key);
    const state = recordHit(this.store.get(storeKey) ?? [], now, policy, value);
    this.store.set(storeKey, state.hits, policy.windowMs);
    return state;
  }

  /** Kiểm tra rồi ghi nhận luôn (loại đếm mọi lần gọi). */
  consume(name: RateLimitPolicyName, key: string, value?: string, now = Date.now()): RateLimitState {
    this.assertAllowed(name, key, now);
    return this.record(name, key, value, now);
  }

  /** Xoá bộ đếm (vd: đăng nhập thành công thì xoá đếm sai của tài khoản). */
  reset(name: RateLimitPolicyName, key: string): void {
    this.store.delete(this.storeKey(name, key));
  }

  toException(name: RateLimitPolicyName, retryAfterMs: number): RateLimitedException {
    return new RateLimitedException(
      RATE_LIMIT_POLICIES[name].message(formatRetryAfter(retryAfterMs)),
      Math.max(1, Math.ceil(retryAfterMs / 1000)),
    );
  }

  private storeKey(name: RateLimitPolicyName, key: string): string {
    return `${name}:${key}`;
  }
}
