import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { Button, FormInput, Gradient, IconName, Text, useToast } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { AuthStackParamList } from '../../types/navigation';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
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
  { label: 'Khách hàng', hint: 'Đặt món', username: 'customer', icon: 'bag-handle-outline', iconBg: 'bg-brand-50', iconColor: palette.brand['600'] },
  { label: 'Chủ quán', hint: 'Quản lý quán', username: 'owner', icon: 'storefront-outline', iconBg: 'bg-accent-50', iconColor: palette.accent['600'] },
  { label: 'Tài xế', hint: 'Nhận đơn giao', username: 'driver', icon: 'bicycle-outline', iconBg: 'bg-info-soft', iconColor: palette.info.strong },
  { label: 'Quản trị', hint: 'Toàn hệ thống', username: 'admin', icon: 'shield-checkmark-outline', iconBg: 'bg-violet-soft', iconColor: palette.violet.strong },
];

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
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
      const res = await authApi.login(data);
      await setAuth(res.user, res.accessToken, res.refreshToken);
      toast(`Đăng nhập thành công! Chào mừng ${res.user.fullName || 'bạn'} quay trở lại.`, 'success');
      // Chủ quán / tài xế / admin: AppNavigator tự chuyển sang giao diện theo vai trò và màn này đã
      // bị gỡ, không còn "MainTabs" để điều hướng tới (trước đây gây lỗi NAVIGATE ... not handled).
      if (res.user.role !== 'CUSTOMER') return;
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('MainTabs', { screen: 'HomeTab' });
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Không thể kết nối đến máy chủ backend (Network Error). Hãy kiểm tra Backend đang bật.'
          : err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác');
      Alert.alert('Đăng nhập thất bại', errorMsg);
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
        {/* Đầu trang: nền xanh cùng tông màn khởi động, logo và lời chào */}
        <Gradient preset="splash" className="overflow-hidden bg-brand-800 pb-14">
          <View aria-hidden pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="absolute h-[420px] w-[420px] rounded-full border border-white/5" />
            <View className="absolute h-[300px] w-[300px] rounded-full border border-white/10" />
            <View className="absolute h-[190px] w-[190px] rounded-full border border-white/15" />
          </View>

          <SafeAreaView edges={['top']}>
            <View className="h-touch flex-row items-center px-4">
              {navigation.canGoBack() && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  onPress={() => navigation.goBack()}
                  className="h-touch w-touch items-center justify-center rounded-full bg-white/15 active:opacity-75"
                >
                  <Ionicons name="arrow-back" size={22} color={palette.surface} />
                </Pressable>
              )}
            </View>

            <View className="items-center px-6 pt-2">
              {/* Logo chữ Z, giống màn khởi động */}
              <View
                aria-hidden
                className="h-[72px] w-[72px] items-center justify-center rounded-[22px] border-4 border-white/20 bg-intro-teal shadow-float"
              >
                <RNText className="font-display text-[48px] leading-[77px] text-intro-on-teal">Z</RNText>
                <View className="absolute right-[13px] top-[14px] h-2.5 w-2.5 rounded-full bg-intro-orange" />
              </View>

              <RNText accessibilityRole="header" className="mt-4 font-display text-[30px] leading-[48px] text-white">
                Chào mừng trở lại
              </RNText>
              <Text variant="body" className="text-center text-brand-50">
                Đăng nhập để đặt món và theo dõi đơn hàng
              </Text>
            </View>
          </SafeAreaView>
        </Gradient>

        {/* Khung trắng bo góc lớn chứa form */}
        <View className="-mt-8 flex-1 rounded-t-[32px] bg-surface px-6 pb-8 pt-7">
          <View className="gap-4">
            <FormInput
              control={control}
              name="username"
              label="Tên đăng nhập"
              placeholder="VD: customer"
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

          {/* Đường phân cách */}
          <View className="my-7 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line" />
            <Text variant="caption" tone="muted">
              hoặc dùng tài khoản demo
            </Text>
            <View className="h-px flex-1 bg-line" />
          </View>

          {/* Tài khoản demo: lưới 2 cột, chạm một lần để đăng nhập */}
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {DEMO_ACCOUNTS.map((acc) => (
              <Pressable
                key={acc.username}
                accessibilityRole="button"
                accessibilityLabel={`Đăng nhập nhanh bằng tài khoản ${acc.label}`}
                accessibilityState={{ disabled: loading }}
                className="min-h-touch w-[48%] flex-row items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 shadow-card active:opacity-70"
                onPress={() => handleQuickLogin(acc.username)}
                disabled={loading}
              >
                <View className={`h-10 w-10 items-center justify-center rounded-xl ${acc.iconBg}`}>
                  <Ionicons name={acc.icon} size={20} color={acc.iconColor} />
                </View>
                <View className="flex-1">
                  <Text variant="body" weight="semibold" numberOfLines={1}>
                    {acc.label}
                  </Text>
                  <Text variant="micro" tone="muted" weight="medium" numberOfLines={1}>
                    {acc.hint}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View className="mt-8 flex-row items-center justify-center">
            <Text variant="body" tone="secondary">
              Chưa có tài khoản?{' '}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.navigate('Register')}
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
