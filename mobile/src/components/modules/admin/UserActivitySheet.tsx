import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { adminApi } from '../../../api/admin';
import { Badge, BottomSheet, Icon, OrderStatusBadge, Text } from '../../ui';
import { palette } from '../../../theme';
import { User } from '../../../types/api';
import { formatDateTime, formatVND } from '../../../utils/format';
import { describeAudit, REQUEST_STATUS_META, ROLE_META } from './adminShared';

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View className="flex-1 items-center gap-0.5 rounded-xl bg-canvas-subtle py-2.5">
    <Text variant="headline" weight="bold">
      {value}
    </Text>
    <Text variant="micro" weight="regular" tone="secondary">
      {label}
    </Text>
  </View>
);

/** Lịch sử hoạt động của người dùng: thao tác quản trị, đơn gần đây, yêu cầu nâng cấp. */
export const UserActivitySheet: React.FC<{ user: User | null; onClose: () => void }> = ({ user, onClose }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'user-activity', user?.id],
    queryFn: () => adminApi.getUserActivity(user!.id),
    enabled: !!user,
  });

  return (
    <BottomSheet visible={!!user} onClose={onClose} title={`Hoạt động – ${user?.fullName ?? ''}`}>
      {isLoading ? (
        <View className="py-10">
          <ActivityIndicator color={palette.brand['500']} />
        </View>
      ) : isError || !data ? (
        <Text variant="body" tone="secondary" className="py-8 text-center">
          Không tải được lịch sử hoạt động.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-6">
          <View className="flex-row gap-2">
            <Stat label="Đơn đã đặt" value={data.summary.orderCount} />
            <Stat label="Chuyến đã giao" value={data.summary.deliveryCount} />
            <Stat label="Quán sở hữu" value={data.summary.restaurantCount} />
          </View>

          {data.restaurants.length > 0 && (
            <View className="gap-1.5">
              <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
                Quán đang quản lý
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {data.restaurants.map((r) => (
                  <Badge key={r.id} label={r.name} tone={r.isOpen ? 'success' : 'neutral'} icon="storefront-outline" />
                ))}
              </View>
            </View>
          )}

          <View className="gap-2">
            <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
              Nhật ký quản trị
            </Text>
            {data.auditLogs.length === 0 && data.roleRequests.length === 0 ? (
              <Text variant="caption" weight="regular" tone="muted">
                Chưa có thao tác nào.
              </Text>
            ) : (
              <>
                {data.roleRequests.map((r) => (
                  <View key={r.id} className="flex-row items-start gap-2">
                    <Icon name="person-add-outline" size="sm" tone="brand" />
                    <View className="flex-1">
                      <Text variant="caption" weight="regular">
                        Gửi yêu cầu làm {ROLE_META[r.requestedRole].label}
                      </Text>
                      <Text variant="micro" weight="regular" tone="muted">
                        {formatDateTime(r.createdAt)}
                      </Text>
                    </View>
                    <Badge label={REQUEST_STATUS_META[r.status].label} tone={REQUEST_STATUS_META[r.status].tone} size="sm" />
                  </View>
                ))}
                {data.auditLogs.map((log) => {
                  const d = describeAudit(log);
                  const byThisUser = log.actor?.id === user?.id;
                  return (
                    <View key={log.id} className="flex-row items-start gap-2">
                      <Icon name={d.icon} size="sm" tone={d.tone} />
                      <View className="flex-1">
                        <Text variant="caption" weight="regular">
                          {d.text}
                        </Text>
                        <Text variant="micro" weight="regular" tone="muted">
                          {formatDateTime(log.createdAt)} •{' '}
                          {byThisUser ? 'do người này thực hiện' : `bởi ${log.actor?.fullName ?? 'Hệ thống'}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          <View className="gap-2">
            <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
              Đơn hàng gần đây
            </Text>
            {data.recentOrders.length === 0 ? (
              <Text variant="caption" weight="regular" tone="muted">
                Chưa có đơn hàng.
              </Text>
            ) : (
              data.recentOrders.map((o) => (
                <View key={o.id} className="flex-row items-center gap-2 rounded-xl bg-canvas-subtle p-2.5">
                  <View className="flex-1 gap-0.5">
                    <Text variant="caption" weight="semibold" numberOfLines={1}>
                      {o.restaurant.name}
                    </Text>
                    <Text variant="micro" weight="regular" tone="muted">
                      {formatDateTime(o.createdAt)} • {o.asCustomer ? 'Đặt món' : 'Giao hàng'} • {formatVND(o.total)}
                    </Text>
                  </View>
                  <OrderStatusBadge status={o.status} />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </BottomSheet>
  );
};
