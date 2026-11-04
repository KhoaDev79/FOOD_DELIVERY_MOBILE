import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { adminApi, AdminRestaurantItem } from '../../../api/admin';
import { useNow } from '../../../hooks/useNow';
import { formatDate } from '../../../utils/format';
import { getStoreStatus } from '../../../utils/openingHours';
import { AppMapView } from '../../common/AppMapView';
import { AppImage, Badge, BadgeTone, Button, ErrorState, Icon, Skeleton, Text } from '../../ui';
import { Money, SectionCard, timeAgo } from '../partner/PartnerKit';
import { BarChart } from './AdminKit';
import { describeAudit, InfoRow, RESTAURANT_STATUS_META, RoleBadge } from './adminShared';

const STORE_TONE: Record<string, BadgeTone> = {
  OPEN: 'success',
  OUT_OF_HOURS: 'warning',
  PAUSED: 'neutral',
  NOT_ACTIVE: 'neutral',
};

/** Nhãn trạng thái dùng chung với màn chủ quán (Đang nhận đơn / Ngoài giờ / Tạm nghỉ) + trạng thái duyệt. */
export const RestaurantStatusBadges: React.FC<{
  r: Pick<AdminRestaurantItem, 'status' | 'isOpen' | 'openTime' | 'closeTime' | 'needsOwner'>;
  now: Date;
  size?: 'sm' | 'md';
}> = ({ r, now, size = 'sm' }) => {
  const store = getStoreStatus(r, now);
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {r.status !== 'ACTIVE' ? (
        <Badge
          label={RESTAURANT_STATUS_META[r.status]?.label ?? r.status}
          tone={RESTAURANT_STATUS_META[r.status]?.tone ?? 'neutral'}
          size={size}
        />
      ) : (
        <Badge label={store.label} tone={STORE_TONE[store.kind] ?? 'neutral'} size={size} />
      )}
      {r.needsOwner && <Badge label="Chưa có chủ" tone="warning" icon="key-outline" size={size} />}
    </View>
  );
};

export interface RestaurantActions {
  onAssignOwner: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onResume: () => void;
  approving?: boolean;
  resuming?: boolean;
}

/**
 * Chi tiết quán cho admin: ảnh bìa, chủ quán (gọi/email), địa chỉ + bản đồ nhỏ, giờ mở cửa,
 * GMV & số đơn 7 ngày, điểm đánh giá, nhật ký thay đổi và các thao tác kiểm duyệt.
 */
export const RestaurantDetailPanel: React.FC<{ restaurantId: string } & RestaurantActions> = ({
  restaurantId,
  onAssignOwner,
  onApprove,
  onReject,
  onSuspend,
  onResume,
  approving,
  resuming,
}) => {
  const now = useNow();
  const detail = useQuery({
    queryKey: ['admin', 'restaurant', restaurantId],
    queryFn: () => adminApi.getRestaurant(restaurantId),
  });
  const week = useQuery({
    queryKey: ['admin', 'restaurant', restaurantId, 'last-7-days'],
    queryFn: () => adminApi.getRestaurantLast7Days(restaurantId),
  });
  const data = detail.data;

  if (detail.isLoading) {
    return (
      <View className="gap-4 pb-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </View>
    );
  }
  if (detail.isError || !data) {
    return <ErrorState message="Không tải được thông tin quán." onRetry={() => detail.refetch()} />;
  }

  const series = week.data?.series ?? [];
  const lastKey = series[series.length - 1]?.at;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-6">
      <AppImage uri={data.imageUrl} className="h-36 w-full rounded-2xl" />
      <View className="gap-1.5">
        <Text variant="title" weight="bold" numberOfLines={2}>
          {data.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <RestaurantStatusBadges r={data} now={now} size="md" />
          <View className="flex-row items-center gap-1">
            <Icon name="star" size="xs" tone="rating" />
            <Text variant="caption" weight="bold">
              {data.rating.toFixed(1)}
            </Text>
            <Text variant="caption" weight="regular" tone="muted">
              ({data.ratingCount ?? data._count.reviews} đánh giá)
            </Text>
          </View>
        </View>
        {!!data.suspendReason && data.status !== 'ACTIVE' && (
          <View className="rounded-xl bg-danger-soft px-3 py-2">
            <Text variant="caption" weight="medium" tone="danger">
              {data.status === 'SUSPENDED' ? 'Lý do tạm khoá' : 'Lý do từ chối'}: {data.suspendReason}
            </Text>
          </View>
        )}
      </View>

      {/* Thao tác kiểm duyệt */}
      <View className="flex-row flex-wrap gap-2">
        {data.status === 'PENDING_APPROVAL' && (
          <>
            <Button label="Duyệt quán" leftIcon="checkmark-circle-outline" size="md" className="min-w-36 flex-1" loading={approving} onPress={onApprove} />
            <Button label="Từ chối" leftIcon="close-circle-outline" variant="outline" size="md" className="min-w-36 flex-1" onPress={onReject} />
          </>
        )}
        {data.status === 'ACTIVE' && (
          <Button label="Tạm khoá quán" leftIcon="pause-circle-outline" variant="outline" size="md" className="min-w-36 flex-1" onPress={onSuspend} />
        )}
        {data.status === 'SUSPENDED' && (
          <Button label="Mở lại quán" leftIcon="play-circle-outline" size="md" className="min-w-36 flex-1" loading={resuming} onPress={onResume} />
        )}
        <Button
          label={data.needsOwner ? 'Gán chủ quán' : 'Bàn giao chủ quán'}
          leftIcon="key-outline"
          variant={data.needsOwner ? 'primary' : 'secondary'}
          size="md"
          className="min-w-36 flex-1"
          onPress={onAssignOwner}
        />
      </View>

      {/* GMV & số đơn 7 ngày */}
      <SectionCard title="7 ngày gần nhất" icon="trending-up" surfaceClassName="bg-canvas-subtle">
        {week.isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-0.5">
                <Text variant="caption" tone="secondary">
                  Doanh thu món (GMV)
                </Text>
                <Money amount={week.data?.gmv ?? 0} variant="headline" tone="brand" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text variant="caption" tone="secondary">
                  Đơn hàng
                </Text>
                <Text variant="headline" weight="bold">
                  {week.data?.delivered ?? 0}/{week.data?.orders ?? 0} giao xong
                </Text>
              </View>
            </View>
            <BarChart
              data={series.map((p) => ({ key: p.at, label: p.label, value: p.gmv, highlight: p.at === lastKey }))}
              height={80}
              formatValue={(v, d) =>
                `${v.toLocaleString('vi-VN')} ₫ · ${series.find((p) => p.at === d.key)?.orders ?? 0} đơn`
              }
            />
          </>
        )}
      </SectionCard>

      {/* Chủ quán */}
      <SectionCard title="Chủ quán" icon="person-circle-outline" right={<RoleBadge role={data.owner.role} />}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight="bold" numberOfLines={1}>
              {data.owner.fullName}
              {!data.owner.isActive ? ' (đã khoá)' : ''}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} selectable>
              {data.owner.email}
            </Text>
            {!!data.owner.phone && (
              <Text variant="caption" weight="regular" tone="secondary" selectable>
                {data.owner.phone}
              </Text>
            )}
          </View>
          {!!data.owner.phone && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Gọi chủ quán ${data.owner.fullName}`}
              onPress={() => void Linking.openURL(`tel:${data.owner.phone}`)}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand-50 active:bg-brand-100"
            >
              <Icon name="call" size="sm" tone="brand" />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gửi email cho chủ quán ${data.owner.fullName}`}
            onPress={() => void Linking.openURL(`mailto:${data.owner.email}`)}
            className="h-11 w-11 items-center justify-center rounded-full bg-accent-50 active:opacity-80"
          >
            <Icon name="mail" size="sm" tone="accent" />
          </Pressable>
        </View>
      </SectionCard>

      {/* Địa chỉ + bản đồ + thông tin */}
      <SectionCard title="Thông tin quán" icon="information-circle-outline">
        <View className="h-36 overflow-hidden rounded-xl bg-canvas-subtle">
          <AppMapView
            initialRegion={{ latitude: data.latitude, longitude: data.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            markers={[{ id: 'r', latitude: data.latitude, longitude: data.longitude, title: data.name, type: 'restaurant' }]}
            autoFit="once"
            style={{ flex: 1 }}
          />
        </View>
        <View>
          <InfoRow label="Địa chỉ" value={data.address} />
          <InfoRow label="Giờ mở cửa" value={`${data.openTime} – ${data.closeTime}`} />
          <InfoRow label="Bán kính giao" value={`${data.deliveryRadiusKm} km`} />
          <InfoRow label="Thực đơn" value={`${data._count.menuItems} món · ${data._count.categories} danh mục`} />
          <InfoRow label="Tổng đơn" value={`${data.stats.deliveredOrders}/${data._count.orders} giao xong`} />
          <InfoRow label="Ngày tham gia" value={formatDate(data.createdAt)} />
        </View>
      </SectionCard>

      {/* Nhật ký thay đổi */}
      <SectionCard title="Nhật ký thay đổi" icon="time-outline">
        {data.history.length === 0 ? (
          <Text variant="caption" weight="regular" tone="muted">
            Chưa có thao tác quản trị nào với quán này.
          </Text>
        ) : (
          data.history.map((log) => {
            const d = describeAudit(log);
            return (
              <View key={log.id} className="flex-row items-start gap-2">
                <Icon name={d.icon} size="sm" tone={d.tone} />
                <View className="flex-1">
                  <Text variant="caption" weight="regular">
                    {d.text}
                  </Text>
                  <Text variant="micro" weight="regular" tone="muted">
                    {timeAgo(log.createdAt)} · {log.actor?.fullName ?? 'Hệ thống'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </SectionCard>
    </ScrollView>
  );
};
