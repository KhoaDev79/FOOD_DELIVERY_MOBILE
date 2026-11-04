import { apiClient } from './client';
import { User } from '../types/api';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  /** username: tên đăng nhập (backend cũng chấp nhận email). */
  login: (data: { username: string; password: string }) =>
    apiClient.post<any, AuthResponse>('/auth/login', data),

  /** Tài khoản mới luôn là khách hàng; server từ chối nếu gửi kèm "role". */
  register: (data: { email: string; password: string; fullName: string; phone: string }) =>
    apiClient.post<any, AuthResponse>('/auth/register', data),

  logout: (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),

  /** Đăng nhập / đăng ký bằng Google (idToken lấy từ expo-auth-session). */
  googleLogin: (idToken: string) =>
    apiClient.post<any, AuthResponse & { isNewUser: boolean }>('/auth/google', { idToken }),

  /** Quên mật khẩu bước 1: gửi mã 6 số tới email (phản hồi như nhau dù email có đăng ký hay không). */
  forgotPassword: (email: string) =>
    apiClient.post<any, ForgotPasswordResponse>('/auth/password/forgot', { email }),

  /** Bước 2: kiểm tra mã, đúng thì nhận resetToken (hiệu lực 10 phút). */
  verifyResetOtp: (email: string, otp: string) =>
    apiClient.post<any, { resetToken: string; expiresInSec: number }>('/auth/password/verify-otp', { email, otp }),

  /** Bước 3: đặt mật khẩu mới; mọi thiết bị bị đăng xuất. */
  resetPassword: (resetToken: string, newPassword: string) =>
    apiClient.post<any, { message: string; username: string }>('/auth/password/reset', { resetToken, newPassword }),
};

export interface ForgotPasswordResponse {
  message: string;
  maskedEmail: string;
  resendAfterSec: number;
  expiresInSec: number;
};

