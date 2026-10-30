import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { adminApi } from '../../../api/admin';
import { Badge, BottomSheet, Button, Icon, OrderStatusBadge, Text } from '../../ui';
import { palette } from '../../../theme';
import { OrderStatus } from '../../../types/api';
import { formatDate, formatDateTime, formatVND } from '../../../utils/format';
import { describeAudit, InfoRow, RoleBadge } from './adminShared';

/** Xem thông tin quán: địa chỉ, giờ mở cửa, chủ quán, doanh thu, đơn hàng, lịch sử quản trị. */
export const RestaurantDetailSheet: React.FC<{
  restaurantId: string | null;
  onClose: () => void;
  onAssignOwner: () => void;
}> = ({ restaurantId, onClose, onAssignOwner }) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'restaurant', restaurantId],
    queryFn: () => adminApi.getRestaurant(restaurantId!),
    enabled: !!restaurantId,
  });

  const statuses = Object.entries(data?.stats.statuses ?? {}) as [OrderStatus, number][];

  return (
    <BottomSheet visible={!!restaurantId} onClose={onClose} title={data?.name ?? 'Chi tiết quán'}>
      {isLoading ? (
        <View className="py-10">
          <ActivityIndicator color={palette.brand['500']} />
        </View>
      ) : isError || !data ? (
        <View className="items-center gap-3 py-8">
          <Text variant="body" tone="secondary">
            Không tải được thông tin quán.
          </Text>
          <Button label="Thử lại" size="md" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-6">
          <View className="flex-row flex-wrap gap-2">
            <Badge label={data.isOpen ? 'Đang hoạt động' : 'Tạm ngưng'} tone={data.isOpen ? 'success' : 'danger'} />
            {data.needsOwner && <Badge label="Chưa có chủ quán" tone="warning" icon="alert-circle" />}
            <Badge label={`★ ${data.rating.toFixed(1)}`} tone="neutral" />
          </View>

          {/* Doanh thu */}
          <View className="flex-row gap-3">
            <View className="flex-1 gap-0.5 rounded-xl bg-brand-50 p-3">
              <Text variant="caption" tone="secondary">
                Doanh thu (đơn giao xong)
              </Text>
              <Text variant="headline" weight="bold" tone="brand" numberOfLines={1} adjustsFontSizeToFit>
                {formatVND(data.stats.revenue)}
              </Text>
            </View>
            <View className="flex-1 gap-0.5 rounded-xl bg-canvas-subtle p-3">
              <Text variant="caption" tone="secondary">
                Đơn hàng
              </Text>
              <Text variant="headline" weight="bold">
                {data.stats.deliveredOrders}/{data._count.orders} hoàn thành
              </Text>
            </View>
          </View>

          {/* Thông tin chung */}
          <View>
            <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
              Thông tin quán
            </Text>
            <InfoRow label="Địa chỉ" value={data.address} />
            <InfoRow label="Giờ mở cửa" value={`${data.openTime} – ${data.closeTime}`} />
            <InfoRow label="Bán kính giao" value={`${data.deliveryRadiusKm} km`} />
            <InfoRow label="Khoảng giá" value={data.priceRange} />
            <InfoRow label="Thực đơn" value={`${data._count.menuItems} món • ${data._count.categories} danh mục`} />
            <InfoRow label="Đánh giá" value={`${data._count.reviews} lượt`} />
            <InfoRow label="Ngày tham gia" value={formatDate(data.createdAt)} />
          </View>

          {/* Chủ quán */}
          <View className="gap-2 rounded-xl border border-line-subtle p-3">
            <View className="flex-row items-center justify-between">
              <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
                Chủ quán
              </Text>
              <RoleBadge role={data.owner.role} />
            </View>
            <Text variant="body" weight="semibold">
              {data.owner.fullName}
              {!data.owner.isActive ? ' (đã khoá)' : ''}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              {data.owner.email}
              {data.owner.phone ? ` • ${data.owner.phone}` : ''}
            </Text>
            <Button label="Gán / bàn giao chủ quán" leftIcon="key-outline" variant="secondary" size="md" onPress={onAssignOwner} />
          </View>

          {/* Phân bổ đơn */}
          {statuses.length > 0 && (
            <View className="gap-2">
              <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
                Phân bổ đơn hàng
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {statuses.map(([s, n]) => (
                  <View key={s} className="flex-row items-center gap-1">
                    <OrderStatusBadge status={s} />
                    <Text variant="caption" weight="semibold">
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Lịch sử quản trị */}
          <View className="gap-2">
            <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
              Lịch sử quản trị
            </Text>
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
                        {formatDateTime(log.createdAt)} • {log.actor?.fullName ?? 'Hệ thống'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
};
