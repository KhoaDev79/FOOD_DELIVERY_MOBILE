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
import { Button, FormInput, Gradient, Text, useToast } from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { AuthStackParamList } from '../../types/navigation';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
  email: z.string().email('Email không đúng định dạng'),
  phone: z
    .string()
    .regex(/^(\+84|0)\d{9,10}$/, 'Số điện thoại không hợp lệ')
    .optional()
    .or(z.literal('')),
  password: z.string().min(8, 'Mật khẩu phải từ 8 ký tự trở lên'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const setAuth = useAuthStore((s) => s.setAuth);
  // Chỉ để đổi màu chữ thanh trạng thái khi màn này đang hiển thị (giống các màn khác).
  const isFocused = useIsFocused();

  const {
    control,
    handleSubmit,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      const res = await authApi.register({
        ...data,
        phone: data.phone || undefined,
      });
      await setAuth(res.user, res.accessToken, res.refreshToken);
      toast(`Đăng ký thành công! Chào mừng ${res.user.fullName} đến với ZomZom.`, 'success');
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        (navigation as any).navigate('MainTabs', { screen: 'HomeTab' });
      }
    } catch (err: any) {
      Alert.alert('Đăng ký thất bại', err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
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
        {/* Đầu trang: nền xanh cùng tông màn khởi động, logo và lời chào */}
        <Gradient preset="splash" className="overflow-hidden bg-brand-800 pb-14">
          <View aria-hidden pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="absolute h-[400px] w-[400px] rounded-full border border-white/5" />
            <View className="absolute h-[280px] w-[280px] rounded-full border border-white/10" />
            <View className="absolute h-[170px] w-[170px] rounded-full border border-white/15" />
          </View>

          <SafeAreaView edges={['top']}>
            <View className="h-touch flex-row items-center px-4">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                onPress={() => navigation.goBack()}
                className="h-touch w-touch items-center justify-center rounded-full bg-white/15 active:opacity-75"
              >
                <Ionicons name="arrow-back" size={22} color={palette.surface} />
              </Pressable>
            </View>

            <View className="items-center px-6">
              {/* Logo chữ Z, giống màn khởi động */}
              <View
                aria-hidden
                className="h-16 w-16 items-center justify-center rounded-[20px] border-4 border-white/20 bg-intro-teal shadow-float"
              >
                <RNText className="font-display text-[42px] leading-[67px] text-intro-on-teal">Z</RNText>
                <View className="absolute right-[11px] top-[12px] h-2.5 w-2.5 rounded-full bg-intro-orange" />
              </View>

              <RNText accessibilityRole="header" className="mt-3 font-display text-[30px] leading-[48px] text-white">
                Tạo tài khoản mới
              </RNText>
              <Text variant="body" className="text-center text-brand-50">
                Tham gia ZomZom để đặt món ngon quanh bạn
              </Text>
            </View>
          </SafeAreaView>
        </Gradient>

        {/* Khung trắng bo góc lớn chứa form */}
        <View className="-mt-8 flex-1 rounded-t-[32px] bg-surface px-6 pb-8 pt-7">
          <View className="gap-4">
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

          <View className="mt-8 flex-row items-center justify-center">
            <Text variant="body" tone="secondary">
              Đã có tài khoản?{' '}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => navigation.navigate('Login')}
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
