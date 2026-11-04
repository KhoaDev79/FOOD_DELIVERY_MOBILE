import { RateLimitPolicy } from './rate-limit.util';

const MINUTE = 60 * 1000;

/**
 * Các mức giới hạn, theo cách các app giao đồ ăn lớn thường làm:
 * - Đăng nhập chỉ đếm lần SAI (đăng nhập đúng không bị ảnh hưởng), khoá tạm chứ không khoá vĩnh viễn.
 * - Khoá theo cặp tài khoản + IP để người ở máy khác khó khoá lây tài khoản của người thật;
 *   thêm mức theo tài khoản (nhiều IP dò cùng 1 tài khoản) và theo IP (1 máy dò nhiều tài khoản).
 */
export const RATE_LIMIT_POLICIES = {
  /** Lưới an toàn cho mọi API: theo người dùng (hoặc IP nếu chưa đăng nhập) */
  API: {
    limit: 600,
    windowMs: MINUTE,
    message: (t) => `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${t}.`,
  },
  LOGIN_FAIL_ACCOUNT_IP: {
    limit: 5,
    windowMs: 15 * MINUTE,
    message: (t) => `Bạn đã nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${t}.`,
  },
  LOGIN_FAIL_ACCOUNT: {
    limit: 20,
    windowMs: 60 * MINUTE,
    message: (t) => `Tài khoản tạm khoá đăng nhập do có nhiều lần nhập sai. Vui lòng thử lại sau ${t}.`,
  },
  LOGIN_FAIL_IP: {
    limit: 30,
    windowMs: 15 * MINUTE,
    message: (t) => `Có quá nhiều lần đăng nhập sai từ thiết bị này. Vui lòng thử lại sau ${t}.`,
  },
  GOOGLE_LOGIN_IP: {
    limit: 30,
    windowMs: 15 * MINUTE,
    message: (t) => `Có quá nhiều lần đăng nhập Google từ thiết bị này. Vui lòng thử lại sau ${t}.`,
  },
  REGISTER_IP: {
    limit: 10,
    windowMs: 60 * MINUTE,
    message: (t) => `Đã tạo quá nhiều tài khoản từ thiết bị này. Vui lòng thử lại sau ${t}.`,
  },
  /** Quên mật khẩu: tính cả email không tồn tại, để phản hồi giống hệt nhau (không lộ tài khoản) */
  PASSWORD_FORGOT_COOLDOWN: {
    limit: 1,
    windowMs: MINUTE,
    message: (t) => `Vui lòng đợi ${t} trước khi gửi lại mã.`,
  },
  PASSWORD_FORGOT_EMAIL: {
    limit: 5,
    windowMs: 60 * MINUTE,
    message: (t) => `Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau ${t}.`,
  },
  PASSWORD_FORGOT_IP: {
    limit: 10,
    windowMs: 60 * MINUTE,
    message: (t) => `Có quá nhiều yêu cầu đặt lại mật khẩu từ thiết bị này. Vui lòng thử lại sau ${t}.`,
  },
  /** Mỗi mã chỉ cho sai 5 lần; mức này chặn 1 máy thử mã của nhiều email */
  PASSWORD_OTP_VERIFY_IP: {
    limit: 30,
    windowMs: 15 * MINUTE,
    message: (t) => `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ${t}.`,
  },
  /** Báo giá gọi lại mỗi khi đổi giỏ/địa chỉ nên mức cao; chủ yếu chặn spam gọi API bản đồ */
  ORDER_QUOTE: {
    limit: 40,
    windowMs: MINUTE,
    message: (t) => `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${t}.`,
  },
  /** Đếm theo idempotency-key: app tự gửi lại cùng một đơn khi mạng chập chờn không bị tính thêm */
  ORDER_CREATE: {
    limit: 5,
    windowMs: 10 * MINUTE,
    message: (t) => `Bạn đặt quá nhiều đơn trong thời gian ngắn. Vui lòng thử lại sau ${t}.`,
  },
  /** Đếm số mã KHÁC NHAU không tồn tại mà khách đã nhập (chống dò mã) */
  VOUCHER_INVALID: {
    limit: 8,
    windowMs: 15 * MINUTE,
    message: (t) => `Bạn đã nhập sai mã nhiều lần. Vui lòng thử lại sau ${t}.`,
  },
} satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
