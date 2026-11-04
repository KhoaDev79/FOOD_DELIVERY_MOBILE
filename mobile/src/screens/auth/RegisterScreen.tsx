import { zodResolver } from '@hookform/resolvers/zod';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import {
  AuthShell,
  AuthSubmitButton,
  AuthSwitchLink,
  FormErrorBanner,
  PasswordStrengthBar,
} from '../../components/modules/auth/AuthHeader';
import { AuthOrDivider, GoogleLoginResult, GoogleSignInButton } from '../../components/modules/auth/GoogleSignInButton';
import { FormInput, Input, Text, useToast } from '../../components/ui';
import { leaveAuthScreens } from '../../navigation/authFlow';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthStackParamList } from '../../types/navigation';
import { passwordStrength } from '../../utils/password';
import { formatVnPhoneInput, normalizeVnPhone, VN_MOBILE_REGEX } from '../../utils/phone';

const emailSchema = z.string().trim().toLowerCase().email('Email không đúng định dạng');

// Cùng quy tắc với backend (auth/dto/auth.dto.ts) để báo lỗi ngay trên form.
const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ tên tối thiểu 2 ký tự')
    .max(100, 'Họ tên tối đa 100 ký tự')
    .regex(/\p{L}/u, 'Họ tên phải có chữ cái'),
  phone: z
    .string()
    .transform(normalizeVnPhone)
    .refine((v) => v !== '', 'Vui lòng nhập số điện thoại')
    .refine((v) => v === '' || VN_MOBILE_REGEX.test(v), 'Số điện thoại di động không hợp lệ (10 số, vd. 0912 345 678)'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mật khẩu phải từ 8 ký tự trở lên')
    .max(72, 'Mật khẩu tối đa 72 ký tự')
    .regex(/\S/, 'Mật khẩu không được chỉ gồm dấu cách'),
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
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });
  const [phone, email, password] = useWatch({ control, name: ['phone', 'email', 'password'] });
  const phoneValid = VN_MOBILE_REGEX.test(normalizeVnPhone(phone ?? ''));
  const emailValid = emailSchema.safeParse(email ?? '').success;
  const strength = passwordStrength(password ?? '');

  const onSubmit = async (data: RegisterFormData) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.register({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        phone: data.phone,
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
        title="Tạo tài khoản"
        subtitle="Chỉ mất 30 giây để bắt đầu đặt món"
        onBack={() => navigation.goBack()}
        footer={
          <AuthSwitchLink
            question="Đã có tài khoản?"
            action="Đăng nhập"
            // Thay màn thay vì chồng thêm: qua lại Đăng nhập ↔ Đăng ký không làm dài lịch sử quay lại
            onPress={() => navigation.replace('Login')}
          />
        }
      >
        <View className="gap-5">
          {!!error && <FormErrorBanner title="Đăng ký thất bại" message={error} />}

          <FormInput
            variant="outlined"
            control={control}
            name="fullName"
            label="Họ và tên"
            placeholder="VD: Nguyễn Văn An"
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            leftIcon="person-outline"
          />

          {/* Số điện thoại: bắt buộc, tự cách số khi gõ; tài xế/quán dùng số này để liên hệ khi giao */}
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value, ref }, fieldState }) => (
              <Input
                variant="outlined"
                ref={ref}
                label="Số điện thoại"
                prefix="🇻🇳 +84"
                placeholder="912 345 678"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={12}
                value={value ?? ''}
                onChangeText={(t) => onChange(formatVnPhoneInput(t))}
                onBlur={onBlur}
                valid={phoneValid}
                error={fieldState.error?.message}
                hint="Tài xế và quán sẽ gọi số này khi giao hàng"
              />
            )}
          />

          <FormInput
            variant="outlined"
            control={control}
            name="email"
            label="Email"
            placeholder="ban@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            leftIcon="mail-outline"
            valid={emailValid}
          />

          <FormInput
            variant="outlined"
            control={control}
            name="password"
            label="Mật khẩu"
            placeholder="Tối thiểu 8 ký tự"
            password
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => handleSubmit(onSubmit)()}
            leftIcon="lock-closed-outline"
          />
          <PasswordStrengthBar strength={strength} />

          <View className="mt-1">
            <AuthSubmitButton label="Tạo tài khoản" loading={loading} onPress={() => handleSubmit(onSubmit)()} />
          </View>

          {/* Cùng thứ tự với màn Đăng nhập: nút chính trước, cách khác sau */}
          <AuthOrDivider label="hoặc tiếp tục với" />
          <GoogleSignInButton disabled={loading} onSuccess={handleGoogleSuccess} onError={setError} />

          <View>
            <View className="px-2">
              <Text variant="caption" weight="regular" tone="muted" className="text-center">
                Bằng việc tạo tài khoản, bạn đồng ý với{' '}
                <Text variant="caption" weight="semibold" tone="secondary">
                  Điều khoản sử dụng
                </Text>{' '}
                và{' '}
                <Text variant="caption" weight="semibold" tone="secondary">
                  Chính sách bảo mật
                </Text>{' '}
                của ZomZom.
              </Text>
            </View>
          </View>
        </View>
      </AuthShell>
    </>
  );
};
