/** Thông tin cần dùng từ idToken của Google (đã xác minh chữ ký ở service). */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
}

/** Trường trong payload idToken mà ta đọc (tập con của TokenPayload của google-auth-library). */
export interface GoogleTokenFields {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

export class GoogleProfileError extends Error {}

/**
 * Lấy hồ sơ từ payload. Bắt buộc email đã được Google xác minh: nếu không, ai đó có thể tạo
 * tài khoản Google gắn email của người khác rồi đăng nhập vào tài khoản ZomZom của họ.
 */
export function profileFromGooglePayload(p: GoogleTokenFields | undefined): GoogleProfile {
  if (!p?.sub || !p.email) throw new GoogleProfileError('Tài khoản Google không có email.');
  if (p.email_verified !== true) throw new GoogleProfileError('Email Google chưa được xác minh.');
  const email = p.email.trim().toLowerCase();
  const name = (p.name || p.given_name || '').trim().replace(/\s+/g, ' ');
  return {
    sub: p.sub,
    email,
    // Họ tên bắt buộc ≥ 2 ký tự: không có tên thì lấy phần trước @ của email
    name: name.length >= 2 ? name.slice(0, 100) : email.split('@')[0].slice(0, 100),
    picture: p.picture || null,
  };
}

export type GoogleAccountDecision =
  | { action: 'LOGIN' }
  | { action: 'LINK' }
  | { action: 'CREATE' }
  | { action: 'REJECT'; reason: 'LOCKED' | 'OTHER_GOOGLE' };

/**
 * Quyết định làm gì với tài khoản tìm được (theo googleId trước, sau đó theo email):
 * - Đã liên kết đúng Google này → đăng nhập.
 * - Có tài khoản cùng email nhưng chưa liên kết → liên kết rồi đăng nhập (email đã được Google xác minh).
 * - Cùng email nhưng đã liên kết tài khoản Google khác → từ chối.
 * - Không có tài khoản → tạo tài khoản khách hàng mới.
 */
export function decideGoogleAccount(
  existing: { googleId: string | null; isActive: boolean } | null,
  sub: string,
): GoogleAccountDecision {
  if (!existing) return { action: 'CREATE' };
  if (existing.googleId && existing.googleId !== sub) return { action: 'REJECT', reason: 'OTHER_GOOGLE' };
  if (!existing.isActive) return { action: 'REJECT', reason: 'LOCKED' };
  return existing.googleId ? { action: 'LOGIN' } : { action: 'LINK' };
}
