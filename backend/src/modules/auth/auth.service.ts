import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DriverVerificationStatus, Prisma, RestaurantStatus, Role, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { hashSecret, verifySecret } from '../../common/utils/password.util';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { generateUniqueUsername } from '../../common/utils/username.util';

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
    const [emailTaken, phoneTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
      dto.phone ? this.prisma.user.findUnique({ where: { phone: dto.phone }, select: { id: true } }) : null,
    ]);
    if (emailTaken) throw new ConflictException('Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.');
    if (phoneTaken) throw new ConflictException('Số điện thoại này đã được đăng ký cho tài khoản khác.');

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: await generateUniqueUsername(this.prisma, dto.email),
          phone: dto.phone,
          fullName: dto.fullName,
          role: 'CUSTOMER',
          passwordHash: await hashSecret(dto.password),
        },
      });
    } catch (err) {
      // Hai yêu cầu đăng ký cùng lúc cùng email/SĐT/tên đăng nhập: bên chậm hơn nhận 409 rõ nghĩa
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email hoặc số điện thoại vừa được đăng ký. Vui lòng thử lại.');
      }
      throw err;
    }
    const tokens = await this.issueTokens(user);
    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    // Ô đăng nhập nhận tên đăng nhập; có "@" thì coi là email (tài khoản/client cũ vẫn dùng được)
    const identifier = (dto.username || dto.email || '').trim().toLowerCase();
    const user = identifier.includes('@')
      ? await this.prisma.user.findUnique({ where: { email: identifier } })
      : await this.prisma.user.findUnique({ where: { username: identifier } });
    // Thông báo chung chung để tránh lộ tài khoản nào tồn tại
    if (!user || !(await verifySecret(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khóa');

    // Mặc định trực tuyến khi đăng nhập:
    if (user.role === Role.DRIVER) {
      await this.prisma.driverProfile.updateMany({
        where: { userId: user.id, verificationStatus: DriverVerificationStatus.APPROVED },
        data: { isOnline: true },
      });
    } else if (user.role === Role.RESTAURANT_OWNER) {
      await this.prisma.restaurant.updateMany({
        where: { ownerId: user.id, status: RestaurantStatus.ACTIVE },
        data: { isOpen: true },
      });
    }

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
