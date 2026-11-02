import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { driversApi } from '../../api/drivers';
import { ordersApi } from '../../api/orders';
import {
  Avatar,
  Badge,
  BadgeTone,
  Button,
  cn,
  Divider,
  Icon,
  LogoutButton,
  IconName,
  IconTone,
  ListRow,
  Skeleton,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
} from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { DriverVerificationStatus } from '../../types/api';
import { formatVND } from '../../utils/format';

const PERIODS: { days: 1 | 7 | 30; label: string }[] = [
  { days: 1, label: 'Hôm nay' },
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
];

const VEHICLE_LABEL: Record<string, string> = {
  MOTORBIKE: 'Xe máy',
  ELECTRIC_MOTORBIKE: 'Xe máy điện',
  BICYCLE: 'Xe đạp',
};

const STATUS_META: Record<
  DriverVerificationStatus,
  { label: string; tone: BadgeTone; icon: IconName; iconTone: IconTone; box: string; text: string }
> = {
  APPROVED: {
    label: 'Đã được duyệt',
    tone: 'success',
    icon: 'shield-checkmark',
    iconTone: 'success',
    box: 'bg-success-soft',
    text: 'Hồ sơ phương tiện đã được kiểm duyệt. Bạn có thể bật trực tuyến và nhận chuyến.',
  },
  PENDING: {
    label: 'Đang chờ duyệt',
    tone: 'warning',
    icon: 'hourglass',
    iconTone: 'accent',
    box: 'bg-warning-soft',
    text: 'Ban quản trị đang xem xét hồ sơ phương tiện của bạn. Bạn sẽ nhận thông báo khi có kết quả.',
  },
  REJECTED: {
    label: 'Bị từ chối',
    tone: 'danger',
    icon: 'close-circle',
    iconTone: 'danger',
    box: 'bg-danger-soft',
    text: 'Hồ sơ chưa đạt yêu cầu. Vui lòng cập nhật lại thông tin xe.',
  },
  SUSPENDED: {
    label: 'Tạm khoá',
    tone: 'danger',
    icon: 'lock-closed',
    iconTone: 'danger',
    box: 'bg-danger-soft',
    text: 'Tài khoản tài xế đang bị tạm khoá, chưa thể nhận chuyến.',
  },
};

/** "2026-10-24" → "24/10" */
const shortDate = (iso?: string) => {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : iso;
};

/** Dòng thông tin: nhãn trái, giá trị phải (tự xuống dòng, không tràn). */
const InfoLine: React.FC<{ icon: IconName; label: string; value?: string | null; highlight?: boolean }> = ({
  icon,
  label,
  value,
  highlight,
}) => (
  <View className="min-h-touch flex-row items-center gap-3 py-2">
    <View className="h-9 w-9 items-center justify-center rounded-full bg-canvas-subtle">
      <Icon name={icon} size="sm" tone="secondary" />
    </View>
    <Text variant="body" tone="secondary" className="flex-1">
      {label}
    </Text>
    <Text
      variant="body"
      weight={value ? 'semibold' : 'regular'}
      tone={!value ? 'muted' : highlight ? 'brand' : 'default'}
      numberOfLines={2}
      className="max-w-[55%] text-right"
    >
      {value || 'Chưa cập nhật'}
    </Text>
  </View>
);

export const DriverProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [statsDays, setStatsDays] = useState<1 | 7 | 30>(7);
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['driver', 'stats', statsDays],
    queryFn: () => ordersApi.getDriverStats({ days: statsDays }),
  });

  const { data: profile, isLoading: loadingProfile, refetch: refetchProfile } = useQuery({
    queryKey: ['driver', 'me'],
    queryFn: () => driversApi.getMe(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchProfile()]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await driversApi.updateStatus({ isOnline: false });
    } catch {
      // Bỏ qua lỗi mạng khi đăng xuất để luôn cho phép thoát
    }
    logout();
  };

  const status = profile ? STATUS_META[profile.verificationStatus] : null;
  const isBicycle = profile?.vehicleType === 'BICYCLE';
  const daily = stats?.daily ?? [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.earnings));

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerClassName={TAB_BAR_CLEARANCE}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
      >
        <TabHeader title="Hồ sơ tài xế">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sửa thông tin cá nhân"
            onPress={() => navigation.navigate('EditProfile')}
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size="lg" className="border-2 border-surface/60" />
            <View className="flex-1 gap-0.5">
              <Text variant="headline" tone="inverse" numberOfLines={1}>
                {user?.fullName || 'Tài xế ZomZom'}
              </Text>
              <Text variant="body" tone="inverse" className="opacity-85" numberOfLines={1}>
                {user?.email}
              </Text>
              {!!user?.phone && (
                <Text variant="caption" weight="regular" tone="inverse" className="opacity-85">
                  {user.phone}
                </Text>
              )}
            </View>
            <View className="rounded-full bg-surface/20 px-3 py-1.5">
              <Text variant="caption" weight="semibold" tone="inverse">
                Sửa
              </Text>
            </View>
          </Pressable>

          <View className="flex-row flex-wrap gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1">
              <Icon name="bicycle" size="xs" tone="inverse" />
              <Text variant="caption" weight="semibold" tone="inverse">
                Đối tác tài xế
              </Text>
            </View>
            {status && (
              <View className="flex-row items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1">
                <View
                  className={cn(
                    'h-2 w-2 rounded-full',
                    profile?.verificationStatus === 'APPROVED'
                      ? 'bg-success'
                      : profile?.verificationStatus === 'PENDING'
                        ? 'bg-warning'
                        : 'bg-danger',
                  )}
                />
                <Text variant="caption" weight="semibold" tone="inverse">
                  Hồ sơ {status.label.toLowerCase()}
                </Text>
              </View>
            )}
          </View>
        </TabHeader>

        <View className="gap-4 px-4 pt-4">
          {/* Trạng thái hồ sơ */}
          {loadingProfile ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : status ? (
            <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-4 shadow-card">
              <View className={cn('h-11 w-11 items-center justify-center rounded-full', status.box)}>
                <Icon name={status.icon} size="md" tone={status.iconTone} />
              </View>
              <View className="flex-1 gap-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text variant="headline">Trạng thái hồ sơ</Text>
                  <Badge label={status.label} tone={status.tone} />
                </View>
                <Text variant="caption" weight="regular" tone="secondary">
                  {status.text}
                </Text>
                {!!profile?.rejectionReason && profile.verificationStatus !== 'APPROVED' && (
                  <View className="mt-1 rounded-lg bg-danger-soft px-3 py-2">
                    <Text variant="caption" tone="danger">
                      Lý do: {profile.rejectionReason}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {/* Thu nhập */}
          <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
            <View className="flex-row items-end justify-between">
              <Text variant="headline">Thu nhập</Text>
              <Text variant="caption" weight="regular" tone="muted">
                {stats ? (stats.days === 1 ? `Hôm nay, ${shortDate(stats.to)}` : `${shortDate(stats.from)} – ${shortDate(stats.to)}`) : ''}
              </Text>
            </View>

            {/* Chọn kỳ: thanh phân đoạn chia đều, không tràn */}
            <View accessibilityRole="tablist" className="flex-row rounded-full bg-canvas-subtle p-1">
              {PERIODS.map((p) => {
                const selected = statsDays === p.days;
                return (
                  <Pressable
                    key={p.days}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setStatsDays(p.days)}
                    className={cn(
                      'h-9 flex-1 items-center justify-center rounded-full',
                      // Luôn có một lớp shadow từ lần render đầu, tránh NativeWind phải remount khi đổi lựa chọn
                      selected ? 'bg-surface shadow-card' : 'shadow-none',
                    )}
                  >
                    <Text variant="caption" weight={selected ? 'semibold' : 'medium'} tone={selected ? 'brand' : 'secondary'}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Công giao thực nhận (phí giao sau hoa hồng nền tảng) */}
            <View className="gap-1 rounded-xl bg-brand-50 p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="wallet" size="sm" tone="brand" />
                <Text variant="caption" tone="secondary">
                  Công giao thực nhận
                </Text>
              </View>
              {loadingStats ? (
                <Skeleton className="h-8 w-36" />
              ) : (
                <Text variant="display" tone="brand">
                  {formatVND(stats?.earnings ?? 0)}
                </Text>
              )}

              {/* Biểu đồ cột thu nhập theo ngày */}
              {statsDays > 1 && daily.length > 1 && (
                <View className="mt-2 h-12 flex-row items-end gap-[3px]">
                  {daily.map((d) => (
                    <View
                      key={d.date}
                      className={cn('flex-1 rounded-t-sm', d.earnings > 0 ? 'bg-brand-400' : 'bg-brand-100')}
                      style={{ height: `${Math.max(6, (d.earnings / maxDaily) * 100)}%` }}
                    />
                  ))}
                </View>
              )}
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-1 rounded-xl bg-success-soft p-3">
                <View className="flex-row items-center gap-1.5">
                  <Icon name="checkmark-done" size="sm" tone="success" />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    Chuyến đã giao
                  </Text>
                </View>
                <Text variant="title" weight="bold" tone="success">
                  {stats?.deliveredTrips ?? 0}
                </Text>
              </View>
              <View className="flex-1 gap-1 rounded-xl bg-accent-50 p-3">
                <View className="flex-row items-center gap-1.5">
                  <Icon name="cash" size="sm" tone="accent" />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    Tiền mặt COD
                  </Text>
                </View>
                <Text variant="title" weight="bold" tone="accent" numberOfLines={1} adjustsFontSizeToFit>
                  {formatVND(stats?.cashCollected ?? 0)}
                </Text>
              </View>
            </View>

            {!!stats?.cancelledTrips && (
              <View className="flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-2">
                <Icon name="close-circle-outline" size="sm" tone="danger" />
                <Text variant="caption" tone="danger" className="flex-1">
                  {stats.cancelledTrips} chuyến bị huỷ trong kỳ
                </Text>
              </View>
            )}
          </View>

          {/* Phương tiện */}
          <View className="rounded-2xl bg-surface px-4 pb-2 pt-4 shadow-card">
            <View className="flex-row items-center justify-between pb-1">
              <Text variant="headline">Phương tiện</Text>
              <Button
                label="Sửa"
                leftIcon="create-outline"
                variant="secondary"
                size="sm"
                onPress={() => navigation.navigate('DriverVehicle')}
              />
            </View>

            {/* Biển số dạng tấm biển */}
            {!isBicycle && !!profile?.licensePlate && (
              <View className="my-2 flex-row items-center gap-3">
                <View className="rounded-md border-2 border-ink bg-surface px-3 py-1">
                  <Text variant="headline" weight="bold" className="tracking-wider">
                    {profile.licensePlate}
                  </Text>
                </View>
                <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
                  {VEHICLE_LABEL[profile.vehicleType] ?? ''}
                  {profile.vehicleColor ? ` • ${profile.vehicleColor}` : ''}
                </Text>
              </View>
            )}

            <InfoLine icon="bicycle-outline" label="Loại xe" value={profile ? VEHICLE_LABEL[profile.vehicleType] : null} />
            {!isBicycle && (
              <>
                <Divider inset />
                <InfoLine
                  icon="car-sport-outline"
                  label="Hãng & dòng xe"
                  value={[profile?.vehicleBrand, profile?.vehicleModel].filter(Boolean).join(' ') || null}
                />
              </>
            )}
            <Divider inset />
            <InfoLine
              icon="card-outline"
              label="Ngân hàng"
              value={
                profile?.bankName
                  ? `${profile.bankName}${profile.maskedBankAccountNumber ? ` • ${profile.maskedBankAccountNumber}` : ''}`
                  : null
              }
            />
            <Divider inset />
            <InfoLine
              icon="call-outline"
              label="Liên hệ khẩn cấp"
              value={
                profile?.emergencyContactName
                  ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ` • ${profile.emergencyContactPhone}` : ''}`
                  : null
              }
            />
          </View>

          {/* Tiện ích */}
          <View className="rounded-2xl bg-surface px-3 shadow-card">
            <ListRow
              icon="wallet-outline"
              iconTone="brand"
              title="Ví & Công nợ tiền mặt COD"
              subtitle={`Số dư nợ hiện tại: ${formatVND(profile?.codBalance ?? 0)}`}
              onPress={() => navigation.navigate('DriverWallet')}
            />
            <Divider inset />
            <ListRow
              icon="person-outline"
              iconTone="brand"
              title="Thông tin cá nhân & mật khẩu"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <Divider inset />
            <ListRow
              icon="star-outline"
              iconTone="accent"
              title="Đánh giá từ khách hàng"
              subtitle="Xem nhận xét và phản hồi đánh giá các chuyến giao"
              onPress={() => navigation.navigate('DriverReviews')}
            />
            <Divider inset />
            <ListRow
              icon="time-outline"
              iconTone="brand"
              title="Lịch sử chuyến giao"
              onPress={() => navigation.navigate('DriverTabs', { screen: 'DriverDeliveriesTab' })}
            />
          </View>

          <LogoutButton
            onLogout={handleLogout}
            message="Bạn sẽ được chuyển sang ngoại tuyến và cần đăng nhập lại để nhận chuyến."
          />
        </View>
      </ScrollView>

    </View>
  );
};
