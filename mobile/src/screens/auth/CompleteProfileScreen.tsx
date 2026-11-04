import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, View } from 'react-native';
import { z } from 'zod';
import { usersApi } from '../../api/users';
import { AuthShell, AuthSubmitButton, AuthSwitchLink, FormErrorBanner } from '../../components/modules/auth/AuthHeader';
import { Avatar, FormInput, Icon, Input, Text, useToast } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { formatVnPhoneInput, normalizeVnPhone, VN_MOBILE_REGEX } from '../../utils/phone';

const schema = z.object({
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
});

/**
 * Bắt buộc với khách chưa có số điện thoại (thường là tài khoản vừa tạo bằng Google, vì Google không cho SĐT).
 * AppNavigator hiện màn này thay cho cả app nên không bỏ qua được; muốn thoát thì đăng xuất.
 * Không dùng navigation vì màn nằm ngoài các navigator.
 */
export const CompleteProfileScreen: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: user?.fullName ?? '', phone: '' },
  });
  const phone = useWatch({ control, name: 'phone' });
  const phoneValid = VN_MOBILE_REGEX.test(normalizeVnPhone(phone ?? ''));

  const onSubmit = async (data: z.output<typeof schema>) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const updated = await usersApi.updateProfile({ fullName: data.fullName, phone: data.phone });
      // Có SĐT rồi thì AppNavigator tự chuyển vào trang chủ
      updateUser({ fullName: updated.fullName, phone: updated.phone });
      toast(`Chào mừng ${updated.fullName} đến với ZomZom!`, 'success');
    } catch (err: any) {
      const res = err?.response?.data;
      setError(
        (Array.isArray(res?.errors) && res.errors.length ? res.errors.join('\n') : res?.message) ||
          (err?.message === 'Network Error'
            ? 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.'
            : 'Có lỗi xảy ra, vui lòng thử lại.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <AuthShell
        title="Hoàn tất hồ sơ"
        subtitle="Chỉ còn một bước nữa để bắt đầu đặt món"
        footer={<AuthSwitchLink question="Không phải tài khoản của bạn?" action="Đăng xuất" onPress={() => logout()} />}
      >
        <View className="gap-5">
          {/* Thẻ tài khoản vừa đăng nhập */}
          <View className="flex-row items-center gap-3.5 rounded-2xl border border-line-subtle bg-canvas-subtle p-3.5">
            <View>
              <Avatar uri={user?.avatarUrl} name={user?.fullName} size="lg" />
              {user?.hasGoogle && (
                <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border-2 border-canvas-subtle bg-surface">
                  <Image source={require('../../../assets/images/google-g.png')} style={{ width: 14, height: 14 }} />
                </View>
              )}
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="body-lg" weight="bold" numberOfLines={1}>
                {user?.fullName}
              </Text>
              <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
                {user?.email}
              </Text>
              {user?.hasGoogle && (
                <View className="mt-1 flex-row items-center gap-1">
                  <Icon name="checkmark-circle" size={14} tone="success" />
                  <Text variant="micro" weight="semibold" tone="success">
                    Đã liên kết Google
                  </Text>
                </View>
              )}
            </View>
          </View>

          {!!error && <FormErrorBanner title="Chưa lưu được" message={error} />}

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
                autoFocus
                value={value ?? ''}
                onChangeText={(t) => onChange(formatVnPhoneInput(t))}
                onBlur={onBlur}
                onSubmitEditing={() => handleSubmit(onSubmit)()}
                valid={phoneValid}
                error={fieldState.error?.message}
              />
            )}
          />

          <View className="flex-row items-start gap-3 rounded-2xl bg-brand-50 p-3.5">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-surface">
              <Icon name="bicycle" size={18} tone="brand" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="caption" weight="bold">
                Vì sao cần số điện thoại?
              </Text>
              <Text variant="caption" weight="regular" tone="secondary">
                Tài xế và quán sẽ gọi số này khi giao hàng. ZomZom không hiển thị số của bạn cho người khác.
              </Text>
            </View>
          </View>

          <AuthSubmitButton label="Bắt đầu đặt món" loading={loading} onPress={() => handleSubmit(onSubmit)()} />
        </View>
      </AuthShell>
    </>
  );
};
