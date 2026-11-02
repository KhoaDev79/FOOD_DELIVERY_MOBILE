import { zodResolver } from '@hookform/resolvers/zod';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { leaveAuthScreens } from '../../navigation/authFlow';
import { AuthHeader, FormErrorBanner } from '../../components/modules/auth/AuthHeader';
import { Button, FormInput, Icon, IconName, Text, useToast } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { AuthStackParamList } from '../../types/navigation';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập hoặc email'),
  password: z.string().min(8, 'Mật khẩu phải từ 8 ký tự trở lên'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Chỉ phần hiển thị (nhãn, mô tả, biểu tượng, màu); tên đăng nhập giữ nguyên.
const DEMO_ACCOUNTS: {
  label: string;
  hint: string;
  username: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
}[] = [
  { label: 'Khách', hint: 'Đặt món', username: 'customer', icon: 'bag-handle-outline', iconBg: 'bg-brand-50', iconColor: palette.brand['600'] },
  { label: 'Quán', hint: 'Quản lý quán', username: 'owner', icon: 'storefront-outline', iconBg: 'bg-accent-50', iconColor: palette.accent['600'] },
  { label: 'Tài xế', hint: 'Nhận đơn giao', username: 'driver', icon: 'bicycle-outline', iconBg: 'bg-info-soft', iconColor: palette.info.strong },
  { label: 'Admin', hint: 'Toàn hệ thống', username: 'admin', icon: 'shield-checkmark-outline', iconBg: 'bg-violet-soft', iconColor: palette.violet.strong },
];

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Chỉ để đổi màu chữ thanh trạng thái khi màn này đang hiển thị (giống các màn khác).
  const isFocused = useIsFocused();

  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
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
          ? 'Không thể kết nối đến máy chủ backend (Network Error). Hãy kiểm tra Backend đang bật.'
          : err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
      setError(Array.isArray(errorMsg) ? errorMsg.join('\n') : errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (username: string) => {
    setValue('username', username);
    setValue('password', 'Password123!');
    onSubmit({ username, password: 'Password123!' });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-surface"
    >
      {isFocused && <StatusBar style="light" />}

      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <AuthHeader
          title="Chào mừng trở lại 👋"
          subtitle="Đăng nhập để đặt món ngon quanh bạn"
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />

        {/* Khung trắng bo góc lớn chứa form */}
        <View className="-mt-7 flex-1 rounded-t-[32px] bg-surface px-6 pb-8 pt-7">
          <View className="gap-4">
            {!!error && <FormErrorBanner title="Đăng nhập thất bại" message={error} />}

            <FormInput
              control={control}
              name="username"
              label="Tên đăng nhập hoặc email"
              placeholder="VD: customer hoặc ban@gmail.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              leftIcon="person-outline"
            />

            <FormInput
              control={control}
              name="password"
              label="Mật khẩu"
              placeholder="••••••••"
              password
              leftIcon="lock-closed-outline"
            />

            <Button
              label="Đăng nhập"
              rightIcon="arrow-forward"
              onPress={() => handleSubmit(onSubmit)()}
              loading={loading}
              variant="primary"
              size="lg"
              className="mt-2 rounded-full shadow-glow"
            />
          </View>

          {/* Dùng thử nhanh: chỉ hiện ở bản phát triển (__DEV__), bản phát hành sẽ ẩn */}
          {__DEV__ && (
            <View className="mt-7 gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-line" />
                <Text variant="caption" weight="medium" tone="muted">
                  Dùng thử nhanh
                </Text>
                <View className="h-px flex-1 bg-line" />
              </View>
              <View className="flex-row gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <Pressable
                    key={acc.username}
                    accessibilityRole="button"
                    accessibilityLabel={`Đăng nhập nhanh bằng tài khoản ${acc.label}`}
                    accessibilityState={{ disabled: loading }}
                    className="flex-1 items-center gap-1.5 rounded-2xl border border-line-subtle bg-surface py-3 active:bg-canvas-subtle"
                    onPress={() => handleQuickLogin(acc.username)}
                    disabled={loading}
                  >
                    <View className={`h-10 w-10 items-center justify-center rounded-full ${acc.iconBg}`}>
                      <Icon name={acc.icon} size={20} color={acc.iconColor} />
                    </View>
                    <Text variant="micro" weight="semibold" numberOfLines={1}>
                      {acc.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View className="mt-auto flex-row items-center justify-center pt-8">
            <Text variant="body" tone="secondary">
              Chưa có tài khoản?{' '}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.replace('Register')}
              hitSlop={12}
              className="min-h-touch justify-center"
            >
              <Text variant="body" weight="bold" tone="brand">
                Đăng ký ngay
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
