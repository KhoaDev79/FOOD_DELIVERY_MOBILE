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
import { normalizeVnPhone, VN_MOBILE_REGEX } from '../../utils/phone';
import { AuthHeader, FormErrorBanner } from '../../components/modules/auth/AuthHeader';
import { Button, FormInput, Text, useToast } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthStackParamList } from '../../types/navigation';

// Cùng quy tắc với backend (auth/dto/auth.dto.ts) để báo lỗi ngay trên form.
const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Họ tên tối thiểu 2 ký tự')
      .max(100, 'Họ tên tối đa 100 ký tự')
      .regex(/\p{L}/u, 'Họ tên phải có chữ cái'),
    email: z.string().trim().toLowerCase().email('Email không đúng định dạng'),
    phone: z
      .string()
      .transform(normalizeVnPhone)
      .refine((v) => v === '' || VN_MOBILE_REGEX.test(v), 'Số điện thoại di động không hợp lệ (10 số, vd. 0912345678)'),
    password: z
      .string()
      .min(8, 'Mật khẩu phải từ 8 ký tự trở lên')
      .max(72, 'Mật khẩu tối đa 72 ký tự')
      .regex(/\S/, 'Mật khẩu không được chỉ gồm dấu cách'),
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  });

type RegisterFormInput = z.input<typeof registerSchema>;
type RegisterFormData = z.output<typeof registerSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Chỉ để đổi màu chữ thanh trạng thái khi màn này đang hiển thị (giống các màn khác).
  const isFocused = useIsFocused();

  const { control, handleSubmit } = useForm<RegisterFormInput, unknown, RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
      });
      await setAuth(res.user, res.accessToken, res.refreshToken);
      toast(`Đăng ký thành công! Chào mừng ${res.user.fullName} đến với ZomZom.`, 'success');
      leaveAuthScreens(navigation as any);
    } catch (err: any) {
      const data = err?.response?.data;
      const reason =
        (Array.isArray(data?.errors) && data.errors.length > 0 ? data.errors.join('\n') : data?.message) ||
        (err?.message === 'Network Error'
          ? 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'
          : 'Có lỗi xảy ra, vui lòng thử lại');
      setError(reason);
    } finally {
      setLoading(false);
    }
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
          title="Tạo tài khoản mới"
          subtitle="Tham gia ZomZom để đặt món ngon quanh bạn"
          onBack={() => navigation.goBack()}
        />

        {/* Khung trắng bo góc lớn chứa form */}
        <View className="-mt-7 flex-1 rounded-t-[32px] bg-surface px-6 pb-8 pt-7">
          <View className="gap-4">
            {!!error && <FormErrorBanner title="Đăng ký thất bại" message={error} />}

            <FormInput
              control={control}
              name="fullName"
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              leftIcon="person-outline"
            />

            <FormInput
              control={control}
              name="email"
              label="Email"
              placeholder="nhap.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail-outline"
            />

            <FormInput
              control={control}
              name="phone"
              label="Số điện thoại (không bắt buộc)"
              placeholder="0901234567"
              keyboardType="phone-pad"
              leftIcon="call-outline"
            />

            <FormInput
              control={control}
              name="password"
              label="Mật khẩu"
              placeholder="Tối thiểu 8 ký tự"
              password
              leftIcon="lock-closed-outline"
            />

            <FormInput
              control={control}
              name="confirmPassword"
              label="Nhập lại mật khẩu"
              placeholder="Nhập lại mật khẩu ở trên"
              password
              leftIcon="lock-closed-outline"
            />

            <Button
              label="Tạo tài khoản"
              rightIcon="arrow-forward"
              onPress={() => handleSubmit(onSubmit)()}
              loading={loading}
              variant="primary"
              size="lg"
              className="mt-2 rounded-full shadow-glow"
            />
          </View>

          <View className="mt-auto flex-row items-center justify-center pt-8">
            <Text variant="body" tone="secondary">
              Đã có tài khoản?{' '}
            </Text>
            <Pressable
              accessibilityRole="link"
              // Thay màn thay vì chồng thêm: qua lại Đăng nhập ↔ Đăng ký không làm dài lịch sử quay lại
              onPress={() => navigation.replace('Login')}
              hitSlop={12}
              className="min-h-touch justify-center"
            >
              <Text variant="body" weight="bold" tone="brand">
                Đăng nhập
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
