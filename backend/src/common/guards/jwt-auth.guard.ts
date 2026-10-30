import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard toàn cục: mọi route đều yêu cầu Access Token trừ khi gắn @Public().
 * Với route @Public(), nếu client gửi kèm Bearer token hợp lệ thì vẫn gắn req.user
 * (ví dụ chủ quán hoặc admin xem quán chưa duyệt), còn nếu không có/lỗi token thì bỏ qua.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      const req = context.switchToHttp().getRequest();
      if (req?.headers?.authorization?.startsWith('Bearer ')) {
        try {
          await super.canActivate(context);
        } catch {
          // Route công khai: không chặn khi token hết hạn hoặc không hợp lệ
        }
      }
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
