import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator';
import { RATE_LIMIT_KEY, SKIP_RATE_LIMIT_KEY } from './rate-limit.decorator';
import { RateLimitPolicyName } from './rate-limit.policies';
import { RateLimitService } from './rate-limit.service';

/** Khoá đếm: đã đăng nhập thì theo id (đổi mạng không thoát được), chưa đăng nhập thì theo IP. */
export function rateLimitSubject(req: { ip?: string; user?: Pick<AuthUser, 'id'> }): string {
  return req.user?.id ? `u:${req.user.id}` : `ip:${req.ip ?? 'unknown'}`;
}

/** Chạy sau JwtAuthGuard để biết người dùng. Mọi route có lưới chung API; route gắn @RateLimit có thêm mức riêng. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const subject = rateLimitSubject(req);
    const extra = this.reflector.getAllAndOverride<RateLimitPolicyName[]>(RATE_LIMIT_KEY, targets) ?? [];
    const policies: RateLimitPolicyName[] = ['API', ...extra];
    // Kiểm tra hết trước rồi mới ghi nhận, để bị chặn ở mức này không làm tốn lượt của mức khác
    for (const name of policies) this.rateLimit.assertAllowed(name, subject);
    for (const name of policies) this.rateLimit.record(name, subject);
    return true;
  }
}
