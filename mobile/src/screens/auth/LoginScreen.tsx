import { zodResolver } from '@hookform/resolvers/zod';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import {
  AuthShell,
  AuthSubmitButton,
  AuthSwitchLink,
  DemoAccount,
  DevQuickLogin,
  FormErrorBanner,
} from '../../components/modules/auth/AuthHeader';
import { AuthOrDivider, GoogleLoginResult, GoogleSignInButton } from '../../components/modules/auth/GoogleSignInButton';
import { FormInput, Icon, Text, useToast } from '../../components/ui';
import { leaveAuthScreens } from '../../navigation/authFlow';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { AuthStackParamList } from '../../types/navigation';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email'),
  password: z.string().min(8, 'Mật khẩu phải từ 8 ký tự trở lên'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Chỉ phần hiển thị (nhãn, biểu tượng, màu); tên đăng nhập giữ nguyên.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Khách', username: 'customer', icon: 'bag-handle', box: 'bg-brand-50', color: palette.brand['600'] },
  { label: 'Quán', username: 'owner', icon: 'storefront', box: 'bg-accent-50', color: palette.accent['600'] },
  { label: 'Tài xế', username: 'driver', icon: 'bicycle', box: 'bg-info-soft', color: palette.info.strong },
  { label: 'Admin', username: 'admin', icon: 'shield-checkmark', box: 'bg-violet-soft', color: palette.violet.strong },
];

export const LoginScreen: React.FC<Props> = ({ navigation, route }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bị tạm khoá vì nhập sai nhiều lần (429) thì đổi tiêu đề để người dùng hiểu cần chờ, không phải gõ lại
  const [isLocked, setIsLocked] = useState(false);
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Chỉ để đổi màu chữ thanh trạng thái khi màn này đang hiển thị (giống các màn khác).
  const isFocused = useIsFocused();

  const prefillUsername = route.params?.prefillUsername;
  const { control, handleSubmit, setValue, getValues } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: prefillUsername ?? '', password: '' },
  });

  // Quay lại từ "Quên mật khẩu" (màn này vẫn đang mở bên dưới): điền sẵn tên đăng nhập, xoá mật khẩu cũ
  useEffect(() => {
    if (!prefillUsername) return;
    setValue('username', prefillUsername);
    setValue('password', '');
  }, [prefillUsername, setValue]);

  const openForgotPassword = () => {
    // Đang gõ email ở ô đăng nhập thì mang sang luôn, đỡ phải gõ lại
    const typed = getValues('username').trim();
    navigation.navigate('ForgotPassword', typed.includes('@') ? { email: typed } : undefined);
  };

  const onSubmit = async (data: LoginFormData) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.login(data);
      await setAuth(res.user, res.accessToken, res.refreshToken);
      toast(`Đăng nhập thành công! Chào mừng ${res.user.fullName || 'bạn'} quay trở lại.`, 'success');
      // Chủ quán / tài xế / admin: AppNavigator tự chuyển sang giao diện theo vai trò và màn này đã
      // bị gỡ, không còn "MainTabs" để điều hướng tới (trước đây gây lỗi NAVIGATE ... not handled).
      if (res.user.role !== 'CUSTOMER') return;
      leaveAuthScreens(navigation as any);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'
          : err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
      setIsLocked(err.response?.status === 429);
      setError(Array.isArray(errorMsg) ? errorMsg.join('\n') : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string) => {
    setValue('username', username);
    setValue('password', 'Password123!');
    void onSubmit({ username, password: 'Password123!' });
  };

  const handleGoogleSuccess = async (res: GoogleLoginResult) => {
    setError(null);
    await setAuth(res.user, res.accessToken, res.refreshToken);
    // Khách chưa có SĐT: AppNavigator tự mở màn "Hoàn tất hồ sơ", không điều hướng ở đây
    if (res.user.role === 'CUSTOMER' && !res.user.phone) return;
    toast(`Đăng nhập thành công! Chào mừng ${res.user.fullName || 'bạn'}.`, 'success');
    if (res.user.role !== 'CUSTOMER') return;
    leaveAuthScreens(navigation as any);
  };

  return (
    <>
      {isFocused && <StatusBar style="light" />}
      <AuthShell
        title="Chào mừng trở lại"
        subtitle="Đăng nhập để đặt món ngon quanh bạn"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        footer={
          <View className="gap-5">
            <AuthSwitchLink
              question="Chưa có tài khoản?"
              action="Đăng ký ngay"
              onPress={() => navigation.replace('Register')}
            />
            {/* Dùng thử nhanh: chỉ hiện ở bản phát triển (__DEV__), bản phát hành sẽ ẩn */}
            {__DEV__ && <DevQuickLogin accounts={DEMO_ACCOUNTS} disabled={loading} onPick={handleQuickLogin} />}
          </View>
        }
      >
        <View className="gap-5">
          {!!error && <FormErrorBanner title={isLocked ? 'Tạm khoá đăng nhập' : 'Đăng nhập thất bại'} message={error} />}

          <FormInput
            variant="outlined"
            control={control}
            name="username"
            label="Tên đăng nhập hoặc email"
            placeholder="Nhập tên đăng nhập hoặc email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            leftIcon="person-outline"
          />

          <FormInput
            variant="outlined"
            control={control}
            name="password"
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            password
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => handleSubmit(onSubmit)()}
            leftIcon="lock-closed-outline"
          />

          <Pressable
            accessibilityRole="link"
            onPress={openForgotPassword}
            hitSlop={8}
            className="-my-2 min-h-touch justify-center self-end active:opacity-70"
          >
            <Text variant="body" weight="semibold" tone="brand">
              Quên mật khẩu?
            </Text>
          </Pressable>

          <View className="-mt-2">
            <AuthSubmitButton label="Đăng nhập" loading={loading} onPress={() => handleSubmit(onSubmit)()} />
          </View>

          <AuthOrDivider label="hoặc tiếp tục với" />
          <GoogleSignInButton
            disabled={loading}
            onSuccess={handleGoogleSuccess}
            onError={(message) => {
              setIsLocked(false);
              setError(message);
            }}
          />

          <View className="flex-row items-center justify-center gap-1.5">
            <Icon name="shield-checkmark-outline" size="sm" tone="muted" />
            <Text variant="caption" weight="regular" tone="muted">
              Thông tin đăng nhập được mã hoá an toàn
            </Text>
          </View>
        </View>
      </AuthShell>
    </>
  );
};
