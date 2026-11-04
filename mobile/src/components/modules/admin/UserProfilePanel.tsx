import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { adminApi } from '../../../api/admin';
import { User } from '../../../types/api';
import { formatDate } from '../../../utils/format';
import { Badge, cn, Divider, Icon, ListRow, Skeleton, Text } from '../../ui';
import { Money } from '../partner/PartnerKit';
import { RoleAvatar } from './AdminKit';
import { DRIVER_STATUS_META } from './DriverVerifySheet';
import { RoleBadge } from './adminShared';

export type UserAction = 'role' | 'driver' | 'activity' | 'lock';

/** Mức công nợ COD so với hạn mức: đỏ khi vượt, cam khi từ 80%. */
export function debtTone(balance: number, limit: number): 'danger' | 'warning' | 'default' {
  if (!limit) return 'default';
  if (balance >= limit) return 'danger';
  if (balance >= limit * 0.8) return 'warning';
  return 'default';
}

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <View className="flex-1 items-center gap-0.5 rounded-xl bg-canvas-subtle px-2 py-2.5">
    {typeof value === 'string' || typeof value === 'number' ? (
      <Text variant="headline" weight="bold">
        {value}
      </Text>
    ) : (
      value
    )}
    <Text variant="micro" weight="medium" tone="secondary" numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/**
 * Hồ sơ người dùng cho admin: đầu hồ sơ (avatar lớn, vai trò, ngày tham gia, số đơn/chuyến/quán),
 * danh sách thao tác, và nút khoá màu đỏ ở cuối.
 */
export const UserProfilePanel: React.FC<{
  user: User;
  isSelf: boolean;
  debtLimit: number;
  onAction: (a: UserAction) => void;
}> = ({ user, isSelf, debtLimit, onAction }) => {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['admin', 'user-activity', user.id],
    queryFn: () => adminApi.getUserActivity(user.id),
  });
  const isAdmin = user.role === 'ADMIN';
  const profile = user.driverProfile;
  const debt = profile?.codBalance ?? 0;
  const tone = debtTone(debt, debtLimit);

  return (
    <View className="gap-4 pb-3">
      <View className="items-center gap-2">
        <RoleAvatar name={user.fullName} role={user.role} uri={user.avatarUrl} locked={!user.isActive} size="xl" />
        <Text variant="title" weight="bold" className="text-center" numberOfLines={2}>
          {user.fullName}
        </Text>
        <View className="flex-row flex-wrap items-center justify-center gap-1.5">
          <RoleBadge role={user.role} />
          {!user.isActive && <Badge label="Đã khoá" tone="danger" icon="lock-closed" />}
          {user.role === 'DRIVER' && profile && (
            <Badge
              label={DRIVER_STATUS_META[profile.verificationStatus].label}
              tone={DRIVER_STATUS_META[profile.verificationStatus].tone}
            />
          )}
        </View>
        <Text variant="caption" weight="regular" tone="secondary" className="text-center">
          {user.email} · Tham gia {formatDate(user.createdAt)}
        </Text>
        {!!user.phone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${user.fullName}`}
            onPress={() => void Linking.openURL(`tel:${user.phone}`)}
            className="min-h-touch flex-row items-center gap-2 rounded-full bg-brand-50 px-4 active:bg-brand-100"
          >
            <Icon name="call" size="sm" tone="brand" />
            <Text variant="body" weight="semibold" tone="brand">
              {user.phone}
            </Text>
          </Pressable>
        )}
      </View>

      <View className="flex-row gap-2">
        {isLoading ? (
          <Skeleton className="h-14 flex-1 rounded-xl" />
        ) : (
          <>
            <Stat label="Đơn đã đặt" value={activity?.summary.orderCount ?? 0} />
            {user.role === 'DRIVER' && <Stat label="Chuyến đã giao" value={activity?.summary.deliveryCount ?? 0} />}
            {(user.role === 'RESTAURANT_OWNER' || (activity?.summary.restaurantCount ?? 0) > 0) && (
              <Stat label="Quán sở hữu" value={activity?.summary.restaurantCount ?? 0} />
            )}
            {user.role === 'DRIVER' && (
              <Stat
                label="Công nợ COD"
                value={<Money amount={debt} variant="body" tone={tone === 'danger' ? 'danger' : 'default'} />}
              />
            )}
          </>
        )}
      </View>
      {user.role === 'DRIVER' && tone !== 'default' && (
        <View className={cn('flex-row items-center gap-2 rounded-xl px-3 py-2', tone === 'danger' ? 'bg-danger-soft' : 'bg-warning-soft')}>
          <Icon name="wallet" size="sm" tone={tone === 'danger' ? 'danger' : 'accent'} />
          <Text variant="caption" weight="bold" tone={tone === 'danger' ? 'danger' : 'warning'} className="flex-1">
            {tone === 'danger'
              ? 'Đã vượt hạn mức công nợ – tài xế không nhận được đơn mới'
              : 'Gần chạm hạn mức công nợ – nên nhắc nộp tiền'}
          </Text>
        </View>
      )}

      <View className="rounded-2xl border border-line-subtle px-1">
        <ListRow
          icon="swap-horizontal"
          iconTone="brand"
          title="Đổi vai trò"
          subtitle={isSelf || isAdmin ? 'Không áp dụng cho tài khoản quản trị viên' : 'Khách hàng, chủ quán hoặc tài xế'}
          onPress={isSelf || isAdmin ? undefined : () => onAction('role')}
        />
        {user.role === 'DRIVER' && (
          <>
            <Divider inset />
            <ListRow
              icon="bicycle-outline"
              iconTone="success"
              title="Duyệt xe & công nợ COD"
              subtitle="Kiểm duyệt phương tiện, ghi nhận nộp tiền, điều chỉnh công nợ"
              onPress={() => onAction('driver')}
            />
          </>
        )}
        <Divider inset />
        <ListRow icon="time-outline" iconTone="brand" title="Lịch sử hoạt động" subtitle="Đơn gần đây, nhật ký quản trị" onPress={() => onAction('activity')} />
      </View>

      {user.isActive ? (
        <View className="rounded-2xl border border-danger/30 px-1">
          <ListRow
            icon="lock-closed-outline"
            title="Khoá tài khoản"
            subtitle={isSelf || isAdmin ? 'Không thể khoá tài khoản quản trị viên' : 'Đăng xuất ngay và chặn đăng nhập (cần lý do)'}
            destructive={!(isSelf || isAdmin)}
            showChevron={false}
            onPress={isSelf || isAdmin ? undefined : () => onAction('lock')}
          />
        </View>
      ) : (
        <View className="rounded-2xl border border-success/30 px-1">
          <ListRow icon="lock-open-outline" iconTone="success" title="Mở khoá tài khoản" showChevron={false} onPress={() => onAction('lock')} />
        </View>
      )}
    </View>
  );
};
