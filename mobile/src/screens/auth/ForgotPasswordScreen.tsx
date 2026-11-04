import { zodResolver } from '@hookform/resolvers/zod';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import {
  AuthNote,
  AuthShell,
  AuthSubmitButton,
  AuthSwitchLink,
  FormErrorBanner,
  PasswordStrengthBar,
} from '../../components/modules/auth/AuthHeader';
import { OtpCodeInput } from '../../components/modules/auth/OtpCodeInput';
import { cn, FormInput, Icon, IconName, Text, useToast } from '../../components/ui';
import { palette } from '../../theme';
import { AuthStackParamList } from '../../types/navigation';
import { passwordStrength } from '../../utils/password';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type Step = 'email' | 'otp' | 'password' | 'done';

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mật khẩu phải từ 8 ký tự trở lên')
      .max(72, 'Mật khẩu tối đa 72 ký tự')
      .regex(/\S/, 'Mật khẩu không được chỉ gồm dấu cách'),
    confirm: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp' });

const HEADINGS: Record<Step, { title: string; subtitle: string }> = {
  email: { title: 'Quên mật khẩu', subtitle: 'Nhập email đã đăng ký, ZomZom sẽ gửi mã xác nhận cho bạn' },
  otp: { title: 'Nhập mã xác nhận', subtitle: 'Kiểm tra hộp thư và nhập mã 6 số' },
  password: { title: 'Tạo mật khẩu mới', subtitle: 'Chọn mật khẩu mạnh mà bạn chưa từng dùng' },
  done: { title: 'Xong rồi!', subtitle: 'Tài khoản của bạn đã được bảo vệ' },
};

/** Lấy câu báo lỗi tiếng Việt từ phản hồi của máy chủ. */
function errorMessage(err: any): string {
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.join('\n');
  if (data?.message) return data.message;
  if (err?.message === 'Network Error') return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  return 'Có lỗi xảy ra, vui lòng thử lại.';
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const isFocused = useIsFocused();
  const toast = useToast();
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bước 1
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  // Mốc thời gian (ms) được gửi lại mã / mã hết hạn
  const [resendAt, setResendAt] = useState(0);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // Bước 2
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(false);
  // Bước 3
  const [resetToken, setResetToken] = useState('');
  const [username, setUsername] = useState('');

  const emailForm = useForm<z.input<typeof emailSchema>, unknown, z.output<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: route.params?.email ?? '' },
  });
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const newPassword = useWatch({ control: passwordForm.control, name: 'password' });
  const strength = passwordStrength(newPassword ?? '');

  // Đồng hồ đếm ngược chỉ chạy ở bước nhập mã
  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expiresIn = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  const goToStep = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const goBackStep = () => {
    if (step === 'otp' || step === 'password') {
      // Quay lại từ bước mật khẩu thì phải nhập email/mã lại (resetToken bỏ đi)
      setCode('');
      setCodeError(false);
      setResetToken('');
      goToStep('email');
    } else {
      navigation.goBack();
    }
  };

  // Nút quay lại cứng của Android ở bước 2, 3 thì lùi về bước trước, không thoát màn.
  // Chỉ chặn thao tác "lùi"; bấm "Đăng nhập" (popTo) vẫn rời màn bình thường.
  const midFlow = step === 'otp' || step === 'password';
  useEffect(() => {
    if (!midFlow) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') return;
      e.preventDefault();
      setCode('');
      setCodeError(false);
      setResetToken('');
      setError(null);
      setStep('email');
    });
  }, [midFlow, navigation]);

  const sendCode = async (target: string) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.forgotPassword(target);
      const t = Date.now();
      setEmail(target);
      setMaskedEmail(res.maskedEmail);
      setResendAt(t + res.resendAfterSec * 1000);
      setExpiresAt(t + res.expiresInSec * 1000);
      setNow(t);
      setCode('');
      setCodeError(false);
      if (step === 'otp') toast('Đã gửi lại mã xác nhận', 'success');
      goToStep('otp');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (value: string) => {
    if (loading || value.length !== 6) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.verifyResetOtp(email, value);
      setResetToken(res.resetToken);
      goToStep('password');
    } catch (err) {
      setCodeError(true);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (data: z.infer<typeof passwordSchema>) => {
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.resetPassword(resetToken, data.password);
      setUsername(res.username);
      setResetToken('');
      goToStep('done');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => navigation.popTo('Login', username ? { prefillUsername: username } : undefined);

  const heading = HEADINGS[step];

  return (
    <>
      {isFocused && <StatusBar style="light" />}
      <AuthShell
        title={heading.title}
        subtitle={heading.subtitle}
        onBack={step === 'done' ? undefined : goBackStep}
        contentKey={step}
        footer={
          step === 'done' ? null : (
            <AuthSwitchLink question="Đã nhớ ra mật khẩu?" action="Đăng nhập" onPress={() => navigation.popTo('Login')} />
          )
        }
      >
        <View className="gap-5">
          {step !== 'done' && <StepProgress step={step} />}
          {!!error && <FormErrorBanner title={step === 'otp' ? 'Chưa xác nhận được' : 'Chưa thực hiện được'} message={error} />}

          {step === 'email' && (
            <>
              <FormInput
                variant="outlined"
                control={emailForm.control}
                name="email"
                label="Email đã đăng ký"
                placeholder="ban@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                leftIcon="mail-outline"
                returnKeyType="send"
                autoFocus
                onSubmitEditing={() => emailForm.handleSubmit((d) => sendCode(d.email))()}
              />
              <AuthSubmitButton
                label="Gửi mã xác nhận"
                loading={loading}
                onPress={() => emailForm.handleSubmit((d) => sendCode(d.email))()}
              />
              <AuthNote icon="shield-checkmark-outline">
                Vì lý do bảo mật, ZomZom không cho biết email có được đăng ký hay không. Nếu có, mã sẽ đến trong ít phút.
              </AuthNote>
            </>
          )}

          {step === 'otp' && (
            <>
              <View className="flex-row items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3.5">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-card">
                  <Icon name="mail-unread-outline" size={22} color={palette.brand['700']} />
                </View>
                <View className="flex-1">
                  <Text variant="caption" weight="regular" tone="secondary">
                    Mã đã được gửi tới
                  </Text>
                  <Text variant="body" weight="bold" numberOfLines={1}>
                    {maskedEmail}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={goBackStep}
                  hitSlop={8}
                  className="min-h-touch justify-center px-1 active:opacity-70"
                >
                  <Text variant="caption" weight="bold" tone="brand">
                    Đổi email
                  </Text>
                </Pressable>
              </View>

              <View className="gap-2.5">
                <OtpCodeInput
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (codeError) {
                      setCodeError(false);
                      setError(null);
                    }
                  }}
                  onComplete={verifyCode}
                  error={codeError}
                  disabled={loading}
                />
                <View className="flex-row items-center justify-center gap-1.5">
                  <Icon name="time-outline" size="sm" tone={expiresIn > 0 ? 'muted' : 'danger'} />
                  <Text variant="caption" weight="regular" tone={expiresIn > 0 ? 'muted' : 'danger'}>
                    {expiresIn > 0 ? `Mã hết hạn sau ${clock(expiresIn)}` : 'Mã đã hết hạn, vui lòng gửi lại mã mới'}
                  </Text>
                </View>
              </View>

              <AuthSubmitButton label="Xác nhận" loading={loading} onPress={() => verifyCode(code)} />

              <View className="flex-row flex-wrap items-center justify-center">
                <Text variant="body" tone="secondary">
                  Chưa nhận được mã?{' '}
                </Text>
                {resendIn > 0 ? (
                  <Text variant="body" weight="semibold" tone="muted">
                    Gửi lại sau {clock(resendIn)}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => sendCode(email)}
                    disabled={loading}
                    hitSlop={12}
                    className="min-h-touch justify-center active:opacity-70"
                  >
                    <Text variant="body" weight="bold" tone="brand">
                      Gửi lại mã
                    </Text>
                  </Pressable>
                )}
              </View>

              <AuthNote icon="folder-open-outline">
                Không thấy email? Hãy kiểm tra thư mục Spam hoặc Quảng cáo. Không chia sẻ mã cho bất kỳ ai.
              </AuthNote>
            </>
          )}

          {step === 'password' && (
            <>
              <FormInput
                variant="outlined"
                control={passwordForm.control}
                name="password"
                label="Mật khẩu mới"
                placeholder="Tối thiểu 8 ký tự"
                password
                autoComplete="new-password"
                textContentType="newPassword"
                leftIcon="lock-closed-outline"
                returnKeyType="next"
                autoFocus
              />
              <PasswordStrengthBar strength={strength} />
              <FormInput
                variant="outlined"
                control={passwordForm.control}
                name="confirm"
                label="Nhập lại mật khẩu mới"
                placeholder="Nhập lại để chắc chắn"
                password
                autoComplete="new-password"
                textContentType="newPassword"
                leftIcon="lock-closed-outline"
                returnKeyType="go"
                onSubmitEditing={() => passwordForm.handleSubmit(submitPassword)()}
              />
              <AuthSubmitButton
                label="Đặt lại mật khẩu"
                loading={loading}
                onPress={() => passwordForm.handleSubmit(submitPassword)()}
              />
              <AuthNote icon="phone-portrait-outline">
                Sau khi đổi, bạn sẽ được đăng xuất khỏi tất cả thiết bị đang đăng nhập để bảo vệ tài khoản.
              </AuthNote>
            </>
          )}

          {step === 'done' && <SuccessPanel onLogin={goToLogin} />}
        </View>
      </AuthShell>
    </>
  );
};

const STEPS: { key: Exclude<Step, 'done'>; label: string; icon: IconName }[] = [
  { key: 'email', label: 'Email', icon: 'mail' },
  { key: 'otp', label: 'Xác nhận', icon: 'keypad' },
  { key: 'password', label: 'Mật khẩu', icon: 'key' },
];

/** Thanh 3 bước: bước đã xong có dấu tích, bước hiện tại tô màu thương hiệu. */
const StepProgress: React.FC<{ step: Exclude<Step, 'done'> }> = ({ step }) => {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <View
      className="flex-row items-start"
      accessibilityLabel={`Bước ${current + 1} trên 3: ${STEPS[current].label}`}
      accessibilityRole="progressbar"
    >
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <View className={cn('mt-[17px] h-0.5 flex-1 rounded-full', i <= current ? 'bg-brand-500' : 'bg-line')} />}
            <View className="w-[72px] items-center gap-1.5">
              <View
                className={cn(
                  'h-9 w-9 items-center justify-center rounded-full',
                  done ? 'bg-brand-600' : active ? 'border-2 border-brand-600 bg-brand-50' : 'bg-canvas-subtle',
                )}
              >
                <Icon
                  name={done ? 'checkmark' : s.icon}
                  size={done ? 18 : 16}
                  color={done ? palette.ink.inverse : active ? palette.brand['700'] : palette.ink.muted}
                />
              </View>
              <Text variant="micro" weight={active ? 'bold' : 'semibold'} tone={active ? 'brand' : done ? 'default' : 'muted'}>
                {s.label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
};

const SuccessPanel: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <View className="items-center gap-6 pt-2">
    {/* Vòng tròn đồng tâm quanh dấu tích, bật lên khi xuất hiện */}
    <Animated.View entering={ZoomIn.springify().damping(12).delay(150).reduceMotion(ReduceMotion.System)}>
      <View className="h-32 w-32 items-center justify-center rounded-full bg-success-soft">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-success shadow-raised">
          <Icon name="checkmark" size={52} color={palette.ink.inverse} />
        </View>
      </View>
    </Animated.View>

    <View className="items-center gap-1.5">
      <Text variant="headline" weight="bold" className="text-center">
        Đổi mật khẩu thành công!
      </Text>
      <Text variant="body" tone="secondary" className="text-center">
        Từ giờ hãy đăng nhập bằng mật khẩu mới của bạn.
      </Text>
    </View>

    <View className="w-full gap-3.5 rounded-2xl bg-canvas-subtle p-4">
      <DoneRow icon="log-out-outline" box="bg-info-soft" color={palette.info.strong} text="Đã đăng xuất khỏi tất cả thiết bị khác" />
      <DoneRow icon="mail-outline" box="bg-accent-50" color={palette.accent['600']} text="Email xác nhận đổi mật khẩu đã được gửi" />
      <DoneRow
        icon="shield-checkmark-outline"
        box="bg-success-soft"
        color={palette.success.strong}
        text="Không chia sẻ mật khẩu cho bất kỳ ai, kể cả nhân viên ZomZom"
      />
    </View>

    <View className="w-full">
      <AuthSubmitButton label="Đăng nhập ngay" onPress={onLogin} />
    </View>
  </View>
);

const DoneRow: React.FC<{ icon: IconName; text: string; box: string; color: string }> = ({ icon, text, box, color }) => (
  <View className="flex-row items-center gap-3">
    <View className={cn('h-9 w-9 items-center justify-center rounded-full', box)}>
      <Icon name={icon} size={17} color={color} />
    </View>
    <Text variant="caption" weight="medium" tone="secondary" className="flex-1">
      {text}
    </Text>
  </View>
);
