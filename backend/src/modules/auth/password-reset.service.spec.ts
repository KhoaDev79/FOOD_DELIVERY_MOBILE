import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RateLimitedException } from '../../common/rate-limit/rate-limit.exception';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { hashSecret } from '../../common/utils/password.util';
import { passwordChangedEmail, passwordResetOtpEmail } from '../mail/mail-templates';
import { PasswordResetService } from './password-reset.service';
import { checkOtpUsable, generateOtp, maskEmail, wrongOtpMessage } from './password-reset.util';

describe('password-reset.util', () => {
  it('generateOtp luôn đủ 6 chữ số', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('maskEmail che phần giữa', () => {
    expect(maskEmail('minhkhoa@gmail.com')).toBe('mi•••oa@gmail.com');
    expect(maskEmail('abc@x.vn')).toBe('a•••c@x.vn');
    expect(maskEmail('a@x.vn')).toBe('a•••@x.vn');
  });

  it('checkOtpUsable: hết hạn / đã dùng / bị khoá', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    const base = { expiresAt: new Date('2026-11-04T10:05:00Z'), attempts: 0, consumedAt: null };
    expect(checkOtpUsable(base, now)).toEqual({ ok: true });
    expect(checkOtpUsable(null, now)).toEqual({ ok: false, reason: 'NO_CODE' });
    expect(checkOtpUsable({ ...base, consumedAt: now }, now)).toEqual({ ok: false, reason: 'NO_CODE' });
    expect(checkOtpUsable({ ...base, attempts: 5 }, now)).toEqual({ ok: false, reason: 'LOCKED' });
    expect(checkOtpUsable({ ...base, expiresAt: now }, now)).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('wrongOtpMessage báo số lần còn lại', () => {
    expect(wrongOtpMessage(1)).toBe('Mã xác nhận không đúng. Bạn còn 4 lần thử.');
    expect(wrongOtpMessage(5)).toMatch(/sai quá 5 lần/);
  });

  it('mẫu email có mã, thời hạn và thoát ký tự HTML trong tên', () => {
    const mail = passwordResetOtpEmail({ fullName: '<b>Khoa</b>', code: '012345', expiresInMinutes: 10 });
    expect(mail.subject).toBe('012345 là mã đặt lại mật khẩu ZomZom');
    expect(mail.html).toContain('&lt;b&gt;Khoa&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>Khoa</b>');
    expect(mail.text).toContain('012345');
    expect(passwordChangedEmail({ fullName: 'Khoa', changedAt: new Date() }).subject).toMatch(/đã được thay đổi/);
  });
});

describe('PasswordResetService', () => {
  const now = new Date('2026-11-04T10:00:00Z');
  const user = {
    id: 'u1',
    email: 'khoa@gmail.com',
    username: 'khoa',
    fullName: 'Khoa',
    isActive: true,
    passwordHash: '',
  };
  let otpRow: { id: string; userId: string; codeHash: string; attempts: number; expiresAt: Date; verifiedAt: Date | null; consumedAt: Date | null } | null;
  let prisma: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mail: { isConfigured: jest.Mock; sendInBackground: jest.Mock };
  let service: PasswordResetService;
  const authState = { invalidate: jest.fn() };

  beforeAll(async () => {
    user.passwordHash = await hashSecret('MatKhauCu123');
  });

  beforeEach(() => {
    otpRow = null;
    const tx = {
      passwordResetOtp: {
        updateMany: jest.fn(({ where }) => {
          if (otpRow && where.id === otpRow.id && !otpRow.consumedAt) {
            otpRow.consumedAt = now;
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      tx,
      user: {
        findUnique: jest.fn(({ where }) =>
          Promise.resolve(where.email === user.email || where.id === user.id ? { ...user } : null),
        ),
      },
      passwordResetOtp: {
        updateMany: jest.fn(({ where, data }) => {
          // Giữ lượt nhập: chỉ tăng khi attempts < 5
          if (data.attempts && otpRow && where.id === otpRow.id && otpRow.attempts < where.attempts.lt) {
            otpRow.attempts += 1;
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: data.attempts ? 0 : 1 });
        }),
        create: jest.fn(async ({ data }) => {
          otpRow = { id: 'otp1', attempts: 0, verifiedAt: null, consumedAt: null, ...data };
          return otpRow;
        }),
        findFirst: jest.fn(() => Promise.resolve(otpRow && !otpRow.consumedAt ? { ...otpRow } : null)),
        findUnique: jest.fn(() => Promise.resolve(otpRow ? { ...otpRow } : null)),
        update: jest.fn(({ data }) => {
          Object.assign(otpRow!, data);
          return Promise.resolve(otpRow);
        }),
      },
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function' ? (arg as (t: unknown) => Promise<unknown>)(tx) : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    mail = { isConfigured: jest.fn().mockReturnValue(true), sendInBackground: jest.fn() };
    const config = { getOrThrow: jest.fn().mockReturnValue('refresh-secret'), get: () => true };
    service = new PasswordResetService(
      prisma,
      new JwtService({}),
      config as never,
      mail as never,
      new RateLimitService(config as never),
      authState as never,
    );
  });

  /** Lấy mã OTP thật từ email đã "gửi". */
  const sentCode = () => (mail.sendInBackground.mock.calls[0][1].text as string).match(/\d{6}/)![0];

  it('chưa cấu hình SMTP thì báo 503', async () => {
    mail.isConfigured.mockReturnValue(false);
    await expect(service.requestOtp(user.email, 'ip', now)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('phản hồi giống hệt nhau dù email có tồn tại hay không; chỉ gửi mail khi có tài khoản', async () => {
    const a = await service.requestOtp(user.email, 'ip1', now);
    const b = await service.requestOtp('khongco@gmail.com', 'ip2', now);
    expect(Object.keys(a)).toEqual(Object.keys(b));
    expect(a.message).toBe(b.message);
    expect(mail.sendInBackground).toHaveBeenCalledTimes(1);
    expect(mail.sendInBackground.mock.calls[0][0]).toBe(user.email);
    // Không lưu mã gốc, chỉ lưu bản băm
    expect(otpRow!.codeHash).not.toBe(sentCode());
  });

  it('gửi lại trong vòng 60 giây bị chặn', async () => {
    await service.requestOtp(user.email, 'ip', now);
    await expect(service.requestOtp(user.email, 'ip', now)).rejects.toBeInstanceOf(RateLimitedException);
  });

  it('luồng đầy đủ: nhập sai còn lượt → nhập đúng → đặt mật khẩu mới, đăng xuất mọi thiết bị', async () => {
    await service.requestOtp(user.email, 'ip', now);
    const code = sentCode();
    const wrong = code === '000000' ? '111111' : '000000';

    await expect(service.verifyOtp(user.email, wrong, 'ip', now)).rejects.toThrow('Bạn còn 4 lần thử');
    const { resetToken } = await service.verifyOtp(user.email, code, 'ip', now);
    expect(otpRow!.verifiedAt).toEqual(now);

    const res = await service.resetPassword(resetToken, 'MatKhauMoi456', now);
    expect(res.username).toBe('khoa');
    expect(prisma.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ refreshTokenHash: null }),
    });
    expect(prisma.tx.authSession.updateMany).toHaveBeenCalled();
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_PASSWORD_RESET' }) }));
    expect(authState.invalidate).toHaveBeenCalledWith('u1');
    // Email báo đổi mật khẩu
    expect(mail.sendInBackground).toHaveBeenCalledTimes(2);

    // Dùng lại resetToken lần 2 thất bại
    await expect(service.resetPassword(resetToken, 'MatKhauKhac789', now)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sai 5 lần thì mã bị khoá, nhập đúng cũng không được', async () => {
    await service.requestOtp(user.email, 'ip', now);
    const code = sentCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await expect(service.verifyOtp(user.email, wrong, 'ip', now)).rejects.toThrow('lần thử');
    await expect(service.verifyOtp(user.email, wrong, 'ip', now)).rejects.toThrow('sai quá 5 lần');
    await expect(service.verifyOtp(user.email, code, 'ip', now)).rejects.toThrow('sai quá 5 lần');
  });

  it('mã hết hạn sau 10 phút', async () => {
    await service.requestOtp(user.email, 'ip', now);
    const later = new Date(now.getTime() + 10 * 60_000 + 1);
    await expect(service.verifyOtp(user.email, sentCode(), 'ip', later)).rejects.toThrow('đã hết hạn');
  });

  it('email không tồn tại: báo chung chung, không lộ tài khoản', async () => {
    await expect(service.verifyOtp('khongco@gmail.com', '123456', 'ip', now)).rejects.toThrow('không đúng hoặc đã hết hạn');
  });

  it('mật khẩu mới trùng mật khẩu cũ thì từ chối; token giả bị từ chối', async () => {
    await service.requestOtp(user.email, 'ip', now);
    const { resetToken } = await service.verifyOtp(user.email, sentCode(), 'ip', now);
    await expect(service.resetPassword(resetToken, 'MatKhauCu123', now)).rejects.toThrow('khác mật khẩu cũ');
    await expect(service.resetPassword('token.gia.mao', 'MatKhauMoi456', now)).rejects.toThrow('hết hạn');
  });
});
