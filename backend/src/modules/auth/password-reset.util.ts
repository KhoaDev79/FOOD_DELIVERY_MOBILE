import { randomInt } from 'crypto';

/** Mã có hiệu lực 10 phút, tối đa 5 lần nhập sai, gửi lại sau 60 giây; sau khi nhập đúng có 10 phút để đặt mật khẩu. */
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
export const RESET_TOKEN_TTL_MINUTES = 10;

/** 6 chữ số ngẫu nhiên an toàn (crypto), giữ số 0 ở đầu. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** "minhkhoa@gmail.com" → "mi•••oa@gmail.com": cho người dùng biết mã gửi đi đâu mà không lộ trọn email. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}•••@${domain}`;
  if (local.length <= 4) return `${local[0]}•••${local[local.length - 1]}@${domain}`;
  return `${local.slice(0, 2)}•••${local.slice(-2)}@${domain}`;
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: 'NO_CODE' | 'EXPIRED' | 'LOCKED' };

/** Mã còn dùng được không (chưa xét đúng/sai). */
export function checkOtpUsable(
  otp: { expiresAt: Date; attempts: number; consumedAt: Date | null } | null,
  now: Date,
): OtpCheck {
  if (!otp || otp.consumedAt) return { ok: false, reason: 'NO_CODE' };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: 'LOCKED' };
  if (otp.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true };
}

export const OTP_ERROR_MESSAGES: Record<'NO_CODE' | 'EXPIRED' | 'LOCKED', string> = {
  NO_CODE: 'Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng gửi lại mã mới.',
  EXPIRED: 'Mã xác nhận đã hết hạn. Vui lòng gửi lại mã mới.',
  LOCKED: `Bạn đã nhập sai quá ${OTP_MAX_ATTEMPTS} lần. Vui lòng gửi lại mã mới.`,
};

/** Câu báo khi nhập sai, kèm số lần còn lại. */
export function wrongOtpMessage(attemptsAfter: number): string {
  const remaining = OTP_MAX_ATTEMPTS - attemptsAfter;
  if (remaining <= 0) return OTP_ERROR_MESSAGES.LOCKED;
  return `Mã xác nhận không đúng. Bạn còn ${remaining} lần thử.`;
}
