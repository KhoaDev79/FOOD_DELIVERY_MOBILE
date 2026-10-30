import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { AuthStateService } from '../auth-state.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Xác thực Access Token kết hợp kiểm tra trạng thái hoạt động & vai trò qua AuthStateService (có cache ngắn).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authState: AuthStateService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub) throw new UnauthorizedException();
    const state = await this.authState.getUserState(payload.sub);
    if (!state || !state.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }
    if (state.role !== payload.role) {
      throw new UnauthorizedException('Vai trò đã thay đổi, vui lòng đăng nhập lại');
    }
    return { id: payload.sub, email: payload.email, role: state.role };
  }
}
