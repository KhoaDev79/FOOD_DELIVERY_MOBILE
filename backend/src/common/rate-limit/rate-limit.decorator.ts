import { SetMetadata } from '@nestjs/common';
import { RateLimitPolicyName } from './rate-limit.policies';

export const RATE_LIMIT_KEY = 'rateLimitPolicies';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

/** Áp thêm mức giới hạn riêng cho route (đếm theo người dùng, chưa đăng nhập thì theo IP). */
export const RateLimit = (...policies: RateLimitPolicyName[]) => SetMetadata(RATE_LIMIT_KEY, policies);

/** Bỏ cả lưới an toàn chung (vd: health check của máy chủ). */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
