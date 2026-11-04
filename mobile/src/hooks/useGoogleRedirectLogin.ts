import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { authApi } from '../api/auth';
import { useToast } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { takeGoogleRedirectResult } from '../utils/googleWebAuth';

/**
 * Bản web: khi Google chuyển về lại app (kèm idToken trên địa chỉ), gửi lên máy chủ để đăng nhập.
 * Đặt ở gốc app vì lúc quay về, app được tải lại từ đầu (màn Đăng nhập không còn mở).
 * Khách chưa có SĐT: AppNavigator tự mở màn "Hoàn tất hồ sơ".
 */
export function useGoogleRedirectLogin() {
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  const handled = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || handled.current) return;
    handled.current = true;
    const result = takeGoogleRedirectResult();
    if (!result) return;
    if ('error' in result) {
      toast(result.error, 'error');
      return;
    }
    authApi
      .googleLogin(result.idToken)
      .then(async (res) => {
        await setAuth(res.user, res.accessToken, res.refreshToken);
        if (res.user.phone || res.user.role !== 'CUSTOMER') {
          toast(`Đăng nhập thành công! Chào mừng ${res.user.fullName || 'bạn'}.`, 'success');
        }
      })
      .catch((err: any) => {
        toast(err?.response?.data?.message || 'Đăng nhập Google chưa thành công. Vui lòng thử lại.', 'error');
      });
  }, [setAuth, toast]);
}
