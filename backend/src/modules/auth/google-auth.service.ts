import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { hashSecret } from '../../common/utils/password.util';
import { generateUniqueUsername } from '../../common/utils/username.util';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { decideGoogleAccount, GoogleProfile, GoogleProfileError, GoogleTokenFields, profileFromGooglePayload } from './google-auth.util';

/** Chỉ tách ra để test thay được bước xác minh chữ ký với máy chủ Google. */
export type GoogleTokenVerifier = (idToken: string, audience: string[]) => Promise<GoogleTokenFields | undefined>;

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientIds: string[];
  private verifier: GoogleTokenVerifier;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
    config: ConfigService,
  ) {
    this.clientIds = config.get<string[]>('googleClientIds') ?? [];
    const client = new OAuth2Client();
    // google-auth-library tự tải và cache khoá công khai của Google để kiểm tra chữ ký, hạn dùng, issuer, audience
    this.verifier = async (idToken, audience) => (await client.verifyIdToken({ idToken, audience })).getPayload();
  }

  /** Cho test thay bằng hàm giả. */
  setVerifier(verifier: GoogleTokenVerifier) {
    this.verifier = verifier;
  }

  async login(idToken: string, ip: string, deviceInfo?: string) {
    if (this.clientIds.length === 0) {
      throw new ServiceUnavailableException('Đăng nhập bằng Google chưa được bật trên máy chủ.');
    }
    this.rateLimit.consume('GOOGLE_LOGIN_IP', ip);

    const profile = await this.verify(idToken);
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: profile.sub } })) ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));

    const decision = decideGoogleAccount(user, profile.sub);
    let isNewUser = false;
    switch (decision.action) {
      case 'REJECT':
        if (decision.reason === 'LOCKED') throw new ForbiddenException('Tài khoản đã bị khóa');
        throw new ConflictException('Email này đã liên kết với một tài khoản Google khác.');
      case 'LINK':
        // Giữ ảnh đại diện người dùng đã tự đặt; chỉ lấy ảnh Google khi chưa có
        user = await this.prisma.user.update({
          where: { id: user!.id },
          data: { googleId: profile.sub, ...(user!.avatarUrl ? {} : { avatarUrl: profile.picture }) },
        });
        await this.audit(user.id, 'USER_GOOGLE_LINKED');
        break;
      case 'CREATE':
        user = await this.createUser(profile);
        isNewUser = true;
        break;
    }

    const result = await this.auth.completeLogin(user!, deviceInfo);
    return { ...result, isNewUser };
  }

  private async verify(idToken: string): Promise<GoogleProfile> {
    let payload: GoogleTokenFields | undefined;
    try {
      payload = await this.verifier(idToken, this.clientIds);
    } catch (err) {
      this.logger.warn(`idToken Google không hợp lệ: ${err instanceof Error ? err.message : String(err)}`);
      throw new UnauthorizedException('Không xác minh được tài khoản Google. Vui lòng thử lại.');
    }
    try {
      return profileFromGooglePayload(payload);
    } catch (err) {
      if (err instanceof GoogleProfileError) throw new UnauthorizedException(err.message);
      throw err;
    }
  }

  /** Tài khoản mới luôn là khách hàng, chưa có SĐT (app bắt nhập ở màn "Hoàn tất hồ sơ"). */
  private async createUser(profile: GoogleProfile): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: profile.email,
          username: await generateUniqueUsername(this.prisma, profile.email),
          fullName: profile.name,
          avatarUrl: profile.picture,
          googleId: profile.sub,
          role: 'CUSTOMER',
          // Mật khẩu ngẫu nhiên không ai biết: muốn đăng nhập bằng mật khẩu thì dùng "Quên mật khẩu" để đặt
          passwordHash: await hashSecret(randomBytes(32).toString('hex')),
        },
      });
      await this.audit(user.id, 'USER_REGISTER_GOOGLE');
      return user;
    } catch (err) {
      // Bấm đăng nhập 2 lần cùng lúc: lần sau gặp trùng email/googleId thì lấy tài khoản vừa tạo
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
        if (existing) return existing;
        throw new ConflictException('Email này vừa được đăng ký. Vui lòng thử lại.');
      }
      throw err;
    }
  }

  private audit(userId: string, action: string) {
    return this.prisma.auditLog.create({ data: { actorId: userId, action, targetType: 'USER', targetId: userId } });
  }
}
