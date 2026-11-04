import * as Google from 'expo-auth-session/providers/google';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, View } from 'react-native';
import { authApi, AuthResponse } from '../../../api/auth';
import { palette } from '../../../theme';
import { Text } from '../../ui';

const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
};

/**
 * Nền tảng đang chạy đã có Client ID chưa. Thiếu thì expo-auth-session ném lỗi ngay khi gọi hook,
 * nên ẩn hẳn nút (vd: Android chưa tạo Android Client ID).
 */
export const isGoogleSignInAvailable = !!Platform.select({
  web: CLIENT_IDS.webClientId,
  android: CLIENT_IDS.androidClientId,
  ios: CLIENT_IDS.iosClientId,
  default: undefined,
});

const WEB_REDIRECT_URI = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;

export type GoogleLoginResult = AuthResponse & { isNewUser: boolean };

interface Props {
  onSuccess: (res: GoogleLoginResult) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

/** "Tiếp tục với Google": nút trắng viền mảnh + logo G nhiều màu (đúng hướng dẫn thương hiệu của Google). */
export const GoogleSignInButton: React.FC<Props> = (props) =>
  isGoogleSignInAvailable ? <GoogleSignInButtonInner {...props} /> : null;

const GoogleSignInButtonInner: React.FC<Props> = ({ onSuccess, onError, disabled }) => {
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    ...CLIENT_IDS,
    selectAccount: true,
    // Web: cố định về gốc trang (vd http://localhost:8081) thay vì theo trang đang mở, để khớp đúng
    // "Authorized redirect URIs" đã khai báo trên Google Cloud
    ...(WEB_REDIRECT_URI ? { redirectUri: WEB_REDIRECT_URI } : {}),
  });
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const result = await promptAsync();
      // Người dùng đóng cửa sổ chọn tài khoản: không coi là lỗi
      if (result.type === 'cancel' || result.type === 'dismiss') return;
      const idToken = result.type === 'success' ? result.params?.id_token : undefined;
      if (!idToken) {
        onError('Không nhận được thông tin từ Google. Vui lòng thử lại.');
        return;
      }
      onSuccess(await authApi.googleLogin(idToken));
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        (err?.message === 'Network Error'
          ? 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'
          : 'Đăng nhập Google chưa thành công. Vui lòng thử lại.');
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || !request;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tiếp tục với Google"
      accessibilityState={{ disabled: disabled || busy, busy: loading }}
      disabled={disabled || busy}
      onPress={handlePress}
      className="h-14 flex-row items-center justify-center gap-3 rounded-full border-[1.5px] border-line bg-surface active:bg-canvas-subtle"
    >
      {loading ? (
        <ActivityIndicator color={palette.brand['700']} />
      ) : (
        <>
          {/* NGOẠI LỆ style: Image trên web bỏ qua className kích thước → logo bị phóng to theo ảnh gốc */}
          <Image
            source={require('../../../../assets/images/google-g.png')}
            style={{ width: 20, height: 20 }}
            accessibilityIgnoresInvertColors
          />
          <Text variant="body-lg" weight="bold">
            Tiếp tục với Google
          </Text>
        </>
      )}
    </Pressable>
  );
};

/** Đường kẻ "hoặc" giữa đăng nhập thường và đăng nhập Google. Ẩn khi không có nút Google. */
export const AuthOrDivider: React.FC<{ label?: string }> = ({ label = 'hoặc' }) =>
  isGoogleSignInAvailable ? (
    <View className="flex-row items-center gap-3" aria-hidden>
      <View className="h-px flex-1 bg-line" />
      <Text variant="caption" weight="medium" tone="muted">
        {label}
      </Text>
      <View className="h-px flex-1 bg-line" />
    </View>
  ) : null;
