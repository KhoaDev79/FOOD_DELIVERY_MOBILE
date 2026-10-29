import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';
import { AuthStackParamList } from '../../types/navigation';

const loginSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z.string().min(8, 'Mật khẩu phải từ 8 ký tự trở lên'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const DEMO_ACCOUNTS = [
  { label: '🛒 Khách hàng', email: 'customer@fooddelivery.com', color: '#10B981' },
  { label: '🏪 Chủ quán', email: 'owner@fooddelivery.com', color: '#F59E0B' },
  { label: '🛵 Tài xế', email: 'driver@fooddelivery.com', color: '#3B82F6' },
  { label: '👑 Admin', email: 'admin@fooddelivery.com', color: '#8B5CF6' },
];

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      const res = await authApi.login(data);
      await setAuth(res.user, res.accessToken, res.refreshToken);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        (err.message === 'Network Error'
          ? 'Không thể kết nối đến máy chủ backend (Network Error). Hãy kiểm tra Backend đang bật.'
          : err.message || 'Email hoặc mật khẩu không chính xác');
      Alert.alert('Đăng nhập thất bại', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (email: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
    onSubmit({ email, password: 'Password123!' });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>🍔 Food Delivery</Text>
          <Text style={styles.subtitle}>Đăng nhập để bắt đầu trải nghiệm</Text>
        </View>

        {/* Demo Fast Switch Chips */}
        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>⚡ Chọn nhanh tài khoản Demo (1 chạm):</Text>
          <View style={styles.demoGrid}>
            {DEMO_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[styles.demoChip, { borderColor: acc.color }]}
                onPress={() => handleQuickLogin(acc.email)}
                disabled={loading}
              >
                <Text style={[styles.demoChipText, { color: acc.color }]}>{acc.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              placeholder="nhap.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Mật khẩu"
              placeholder="••••••••"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Button
          title="Đăng nhập"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          style={styles.button}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Đăng ký ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 20, alignItems: 'center' },
  appTitle: { fontSize: 28, fontWeight: '800', color: colors.primary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  demoSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  demoChipText: { fontSize: 12, fontWeight: '700' },
  button: { marginTop: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, color: colors.textSecondary },
  linkText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
