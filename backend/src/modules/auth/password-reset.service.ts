import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { hashSecret, verifySecret } from '../../common/utils/password.util';
import { passwordChangedEmail, passwordResetOtpEmail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthStateService } from './auth-state.service';
import {
  checkOtpUsable,
  generateOtp,
  maskEmail,
  OTP_ERROR_MESSAGES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_MINUTES,
  RESET_TOKEN_TTL_MINUTES,
  wrongOtpMessage,
} from './password-reset.util';

interface ResetTokenPayload {
  sub: string;
  otp: string;
  purpose: 'password_reset';
}

const RESET_TOKEN_INVALID = 'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng làm lại từ đầu.';

/**
 * Quên mật khẩu bằng OTP email, 3 bước: gửi mã → nhập mã (nhận resetToken) → đặt mật khẩu mới.
 * Phản hồi bước 1 luôn giống nhau dù email có tồn tại hay không (chống dò tài khoản).
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly rateLimit: RateLimitService,
    private readonly authState: AuthStateService,
  ) {}

  /** Bước 1: gửi mã. */
  async requestOtp(email: string, ip: string, now = new Date()) {
    // Kiểm tra cấu hình trước khi tra tài khoản, để lỗi này không phụ thuộc email có tồn tại không
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException('Tính năng quên mật khẩu tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
    }
    this.rateLimit.assertAllowed('PASSWORD_FORGOT_IP', ip);
    this.rateLimit.assertAllowed('PASSWORD_FORGOT_EMAIL', email);
    this.rateLimit.assertAllowed('PASSWORD_FORGOT_COOLDOWN', email);
    this.rateLimit.record('PASSWORD_FORGOT_IP', ip);
    this.rateLimit.record('PASSWORD_FORGOT_EMAIL', email);
    this.rateLimit.record('PASSWORD_FORGOT_COOLDOWN', email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, isActive: true },
    });
    if (user?.isActive) {
      const code = generateOtp();
      const codeHash = await hashSecret(code);
      await this.prisma.$transaction([
        // Gửi mã mới thì mã cũ hết hiệu lực
        this.prisma.passwordResetOtp.updateMany({
          where: { userId: user.id, consumedAt: null },
          data: { consumedAt: now },
        }),
        this.prisma.passwordResetOtp.create({
          data: { userId: user.id, codeHash, expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000) },
        }),
      ]);
      this.mail.sendInBackground(
        user.email,
        passwordResetOtpEmail({ fullName: user.fullName, code, expiresInMinutes: OTP_TTL_MINUTES }),
        'mã đặt lại mật khẩu',
      );
    }

    return {
      message: 'Nếu email đã đăng ký, mã xác nhận 6 số sẽ được gửi tới hộp thư trong ít phút.',
      maskedEmail: maskEmail(email),
      resendAfterSec: OTP_RESEND_SECONDS,
      expiresInSec: OTP_TTL_MINUTES * 60,
    };
  }

  /** Bước 2: kiểm tra mã. Đúng thì trả resetToken dùng một lần cho bước 3. */
  async verifyOtp(email: string, code: string, ip: string, now = new Date()) {
    this.rateLimit.consume('PASSWORD_OTP_VERIFY_IP', ip);

    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
    const otp = user?.isActive
      ? await this.prisma.passwordResetOtp.findFirst({
          where: { userId: user.id, consumedAt: null },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const usable = checkOtpUsable(otp, now);
    if (!usable.ok || !otp || !user) {
      throw new BadRequestException(OTP_ERROR_MESSAGES[usable.ok ? 'NO_CODE' : usable.reason]);
    }

    // Giữ lượt trước khi so mã (điều kiện attempts < 5 trong câu UPDATE), để gửi dồn nhiều yêu cầu cùng lúc
    // cũng không thử được quá 5 mã
    const reserved = await this.prisma.passwordResetOtp.updateMany({
      where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count === 0) throw new BadRequestException(OTP_ERROR_MESSAGES.LOCKED);

    if (!(await verifySecret(otp.codeHash, code))) {
      throw new BadRequestException(wrongOtpMessage(otp.attempts + 1));
    }

    await this.prisma.passwordResetOtp.update({ where: { id: otp.id }, data: { verifiedAt: now } });
    const resetToken = await this.jwt.signAsync({ sub: user.id, otp: otp.id, purpose: 'password_reset' } satisfies ResetTokenPayload, {
      secret: this.resetSecret(),
      expiresIn: `${RESET_TOKEN_TTL_MINUTES}m`,
    });
    return { resetToken, expiresInSec: RESET_TOKEN_TTL_MINUTES * 60 };
  }

  /** Bước 3: đặt mật khẩu mới, thu hồi mọi phiên đăng nhập cũ. */
  async resetPassword(resetToken: string, newPassword: string, now = new Date()) {
    const payload = await this.verifyResetToken(resetToken);
    const otp = await this.prisma.passwordResetOtp.findUnique({ where: { id: payload.otp } });
    if (!otp || otp.userId !== payload.sub || !otp.verifiedAt || otp.consumedAt) {
      throw new BadRequestException(RESET_TOKEN_INVALID);
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new BadRequestException(RESET_TOKEN_INVALID);

    if (await verifySecret(user.passwordHash, newPassword)) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu cũ.');
    }

    const passwordHash = await hashSecret(newPassword);
    // Chỉ đổi khi mã chưa bị dùng (điều kiện consumedAt = null): dùng lại cùng resetToken lần 2 sẽ thất bại
    const done = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetOtp.updateMany({
        where: { id: otp.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count === 0) return false;
      // refreshTokenHash = null đổi "thế hệ phiên": mọi refresh token cũ hết hiệu lực
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, refreshTokenHash: null } });
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'USER_PASSWORD_RESET',
          targetType: 'USER',
          targetId: user.id,
          metadata: { method: 'EMAIL_OTP' },
        },
      });
      return true;
    });
    if (!done) throw new BadRequestException(RESET_TOKEN_INVALID);

    this.authState.invalidate(user.id);
    // Đã chứng minh sở hữu email: xoá các lần đăng nhập sai trước đó để đăng nhập ngay được
    this.rateLimit.reset('LOGIN_FAIL_ACCOUNT', user.email);
    if (user.username) this.rateLimit.reset('LOGIN_FAIL_ACCOUNT', user.username);
    this.mail.sendInBackground(user.email, passwordChangedEmail({ fullName: user.fullName, changedAt: now }), 'đổi mật khẩu');

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      username: user.username ?? user.email,
    };
  }

  /** Dọn mã đã hết hạn quá 1 ngày (4:15 sáng mỗi ngày). */
  @Cron('15 4 * * *')
  async cleanupExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.passwordResetOtp.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    if (count > 0) this.logger.log(`Đã xoá ${count} mã đặt lại mật khẩu hết hạn.`);
    return count;
  }

  private async verifyResetToken(token: string): Promise<ResetTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<ResetTokenPayload>(token, { secret: this.resetSecret() });
      if (payload.purpose !== 'password_reset' || !payload.sub || !payload.otp) throw new Error('sai mục đích');
      return payload;
    } catch {
      throw new BadRequestException(RESET_TOKEN_INVALID);
    }
  }

  /** Khoá riêng cho resetToken (suy ra từ refresh secret), để token này không dùng được như access/refresh token. */
  private resetSecret(): string {
    return `${this.config.getOrThrow<string>('jwt.refreshSecret')}:password-reset`;
  }
}
