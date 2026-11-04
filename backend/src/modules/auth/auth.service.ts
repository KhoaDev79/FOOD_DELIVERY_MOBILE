import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { RateLimitPolicyName } from '../../common/rate-limit/rate-limit.policies';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { formatRetryAfter } from '../../common/rate-limit/rate-limit.util';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Refresh token mang thêm sid = id phiên (thiết bị). Token cũ (trước khi có phiên) không có sid. */
type RefreshPayload = JwtPayload & { sid?: string; exp?: number };

/** Số phiên (thiết bị) tối đa cùng lúc của một tài khoản; vượt thì đăng xuất thiết bị cũ nhất. */
export const MAX_SESSIONS_PER_USER = 10;

/** Ba bộ đếm đăng nhập sai: theo tài khoản + IP, theo tài khoản, theo IP. */
export function loginFailKeys(identifier: string, ip: string): [RateLimitPolicyName, string][] {
  return [
    ['LOGIN_FAIL_ACCOUNT_IP', `${identifier}|${ip}`],
    ['LOGIN_FAIL_ACCOUNT', identifier],
    ['LOGIN_FAIL_IP', ip],
  ];
}

/** Sai mật khẩu: còn ít lượt thì nhắc trước, giống các app lớn (không lộ tài khoản có tồn tại hay không). */
export function loginFailMessage(remaining: number, retryAfterMs = 0): string {
  const base = 'Tên đăng nhập hoặc mật khẩu không đúng';
  if (remaining <= 0) return `${base}. Bạn đã bị tạm khoá đăng nhập ${formatRetryAfter(retryAfterMs)}.`;
  if (remaining <= 2) return `${base}. Còn ${remaining} lần thử trước khi bị tạm khoá.`;
  return base;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async register(dto: RegisterDto, deviceInfo?: string) {
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
    const tokens = await this.issueTokens(user, { deviceInfo });
    return { user: toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto, deviceInfo?: string, ip = 'unknown') {
    // Ô đăng nhập nhận tên đăng nhập; có "@" thì coi là email (tài khoản/client cũ vẫn dùng được)
    const identifier = (dto.username || dto.email || '').trim().toLowerCase();
    const failKeys = loginFailKeys(identifier, ip);
    // Đang bị khoá tạm thì chặn trước khi kiểm tra mật khẩu (không cho dò tiếp kể cả khi đoán đúng)
    for (const [policy, key] of failKeys) this.rateLimit.assertAllowed(policy, key);

    const user = identifier.includes('@')
      ? await this.prisma.user.findUnique({ where: { email: identifier } })
      : await this.prisma.user.findUnique({ where: { username: identifier } });
    // Thông báo chung chung để tránh lộ tài khoản nào tồn tại (tài khoản không có cũng bị đếm sai như nhau)
    if (!user || !(await verifySecret(user.passwordHash, dto.password))) {
      const states = failKeys.map(([policy, key]) => this.rateLimit.record(policy, key));
      const remaining = Math.min(...states.map((s) => s.remaining));
      const retryAfterMs = Math.max(...states.map((s) => s.retryAfterMs));
      throw new UnauthorizedException(loginFailMessage(remaining, retryAfterMs));
    }
    // Đúng mật khẩu: xoá đếm sai của tài khoản (giữ đếm theo IP để 1 máy không dò xen kẽ được)
    this.rateLimit.reset('LOGIN_FAIL_ACCOUNT_IP', `${identifier}|${ip}`);
    this.rateLimit.reset('LOGIN_FAIL_ACCOUNT', identifier);
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khóa');
    return this.completeLogin(user, deviceInfo);
  }

  /**
   * Phần chung sau khi đã xác thực xong (mật khẩu hoặc Google): bật trực tuyến cho tài xế / mở quán, cấp token.
   */
  async completeLogin(user: User, deviceInfo?: string) {
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

    const tokens = await this.issueTokens(user, { deviceInfo });
    return { user: toPublicUser(user), ...tokens };
  }

  /**
   * Làm mới phiên (xoay vòng refresh token, mỗi token chỉ dùng 1 lần) cho đúng thiết bị đó.
   * Đăng nhập ở thiết bị khác không làm phiên này hết hạn.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);
    if (!payload) throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập đã kết thúc');
    }

    // Token cấp trước khi có bảng phiên (không có sid): refreshTokenHash lúc đó là băm của chính token.
    // Khớp thì chuyển sang phiên mới để người đang đăng nhập không bị đăng xuất khi nâng cấp.
    if (!payload.sid) {
      if (!(await verifySecret(user.refreshTokenHash, refreshToken))) {
        throw new UnauthorizedException('Phiên đăng nhập đã kết thúc');
      }
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: null } });
      return this.issueTokens({ ...user, refreshTokenHash: null }, { deviceInfo: 'Thiết bị cũ' });
    }

    const session = await this.prisma.authSession.findUnique({ where: { id: payload.sid } });
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.epoch !== user.refreshTokenHash
    ) {
      throw new UnauthorizedException('Phiên đăng nhập đã kết thúc');
    }
    if (!(await verifySecret(session.tokenHash, refreshToken))) {
      // Token cũ của phiên bị dùng lại => có thể đã bị đánh cắp: thu hồi phiên này
      await this.prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      this.logger.warn(`Refresh token bị dùng lại, đã thu hồi phiên ${session.id} của user ${user.id}`);
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    return this.issueTokens(user, { sessionId: session.id });
  }

  /** Đăng xuất thiết bị hiện tại (thu hồi đúng phiên của refresh token gửi lên). Không lỗi nếu token đã hết hạn. */
  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const payload = await this.verifyRefresh(refreshToken, true);
    if (payload?.sid) {
      await this.prisma.authSession.updateMany({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  /** Dọn phiên đã hết hạn / đã thu hồi quá 30 ngày (4:00 sáng mỗi ngày). */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupSessions(now = new Date()): Promise<number> {
    const { count } = await this.prisma.authSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return count;
  }

  private async verifyRefresh(token: string, ignoreExpiration = false): Promise<RefreshPayload | null> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        ignoreExpiration,
      });
    } catch {
      return null;
    }
  }

  /**
   * Cấp cặp token cho một phiên. Không có sessionId thì tạo phiên mới (đăng nhập ở thiết bị mới).
   * users.refreshTokenHash giữ "thế hệ phiên" (epoch): null nghĩa là mọi phiên cũ đã bị thu hồi,
   * khi đó tạo thế hệ mới.
   */
  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'role'> & { refreshTokenHash?: string | null },
    opts: { sessionId?: string; deviceInfo?: string } = {},
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const jwtCfg = this.config.getOrThrow('jwt');

    let epoch = user.refreshTokenHash;
    if (epoch === undefined) {
      const fresh = await this.prisma.user.findUnique({ where: { id: user.id }, select: { refreshTokenHash: true } });
      epoch = fresh?.refreshTokenHash ?? null;
    }
    // Băm argon2 là dữ liệu kiểu cũ (một phiên duy nhất): thay bằng thế hệ phiên mới
    if (!epoch || epoch.startsWith('$')) {
      epoch = randomUUID();
      await this.prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: epoch } });
    }

    const sessionId = opts.sessionId ?? randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: jwtCfg.accessSecret, expiresIn: jwtCfg.accessExpiresIn }),
      // jwtid ngẫu nhiên đảm bảo mỗi refresh token là duy nhất kể cả khi cấp trong cùng 1 giây
      this.jwt.signAsync({ ...payload, sid: sessionId }, {
        secret: jwtCfg.refreshSecret,
        expiresIn: jwtCfg.refreshExpiresIn,
        jwtid: randomUUID(),
      }),
    ]);

    const exp = (this.jwt.decode(refreshToken) as RefreshPayload | null)?.exp;
    const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const tokenHash = await hashSecret(refreshToken);

    if (opts.sessionId) {
      await this.prisma.authSession.update({
        where: { id: sessionId },
        data: { tokenHash, lastUsedAt: new Date(), expiresAt },
      });
    } else {
      await this.prisma.authSession.create({
        data: { id: sessionId, userId: user.id, tokenHash, epoch, deviceInfo: opts.deviceInfo?.slice(0, 200), expiresAt },
      });
      await this.trimSessions(user.id);
    }
    return { accessToken, refreshToken };
  }

  /** Giữ tối đa MAX_SESSIONS_PER_USER phiên đang hoạt động: thu hồi các phiên dùng gần nhất cũ nhất. */
  private async trimSessions(userId: string) {
    const active = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true },
    });
    const extra = active.slice(MAX_SESSIONS_PER_USER).map((s) => s.id);
    if (extra.length) {
      await this.prisma.authSession.updateMany({ where: { id: { in: extra } }, data: { revokedAt: new Date() } });
    }
  }
}
