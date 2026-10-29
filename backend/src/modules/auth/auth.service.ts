import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashSecret, verifySecret } from '../../common/utils/password.util';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Email hoặc số điện thoại đã được sử dụng');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        fullName: dto.fullName,
        role: dto.role ?? 'CUSTOMER',
        passwordHash: await hashSecret(dto.password),
      },
    });
    const tokens = await this.issueTokens(user);
    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Thông báo chung chung để tránh lộ thông tin email nào tồn tại
    if (!user || !(await verifySecret(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khóa');

    const tokens = await this.issueTokens(user);
    return { user: toPublicUser(user), ...tokens };
  }

  /** Refresh Token Rotation: mỗi refresh token chỉ dùng được 1 lần. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã kết thúc');
    }

    const matches = await verifySecret(user.refreshTokenHash, refreshToken);
    if (!matches) {
      // Token cũ bị dùng lại => có thể đã bị đánh cắp: thu hồi toàn bộ phiên
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, refreshTokenHash: { not: null } },
      data: { refreshTokenHash: null },
    });
  }

  private async issueTokens(user: Pick<User, 'id' | 'email' | 'role'>): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const jwtCfg = this.config.getOrThrow('jwt');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: jwtCfg.accessSecret, expiresIn: jwtCfg.accessExpiresIn }),
      // jwtid ngẫu nhiên đảm bảo mỗi refresh token là duy nhất kể cả khi cấp trong cùng 1 giây
      this.jwt.signAsync(payload, {
        secret: jwtCfg.refreshSecret,
        expiresIn: jwtCfg.refreshExpiresIn,
        jwtid: randomUUID(),
      }),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await hashSecret(refreshToken) },
    });
    return { accessToken, refreshToken };
  }
}
