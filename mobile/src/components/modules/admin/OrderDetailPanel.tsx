import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { adminApi, AdminOrderDetail } from '../../../api/admin';
import { ordersApi } from '../../../api/orders';
import { useNow } from '../../../hooks/useNow';
import { OrderStatus } from '../../../types/api';
import {
  describeHistoryActor,
  formatDuration,
  minutesBetween,
  ORDER_STEP_LABEL,
  stepHealth,
} from '../../../utils/adminOrder';
import { formatDateTime, formatVND, orderCode } from '../../../utils/format';
import { CANCEL_REASON_LABELS, FAILED_DELIVERY_REASON_LABELS } from '../../../utils/orderStatus';
import { AppMapView, MapMarkerItem } from '../../common/AppMapView';
import { Button, cn, ErrorState, Icon, Input, OrderStatusBadge, Skeleton, Text, useToast } from '../../ui';
import { clockTime, dayLabel, Money, NoticeCard, SectionCard, timeAgo } from '../partner/PartnerKit';
import { PartyCard, Timeline, TimelineStep } from './AdminKit';
import { vehicleLabel } from './adminShared';

const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED', 'DELIVERY_FAILED'];
/** Backend chỉ cho gỡ tài xế khi quán chưa giao món cho tài xế. */
const UNASSIGNABLE: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP'];

const CANCEL_CHIPS = ['Quán không phản hồi', 'Không tìm được tài xế', 'Khách yêu cầu huỷ', 'Nghi ngờ gian lận', 'Lỗi hệ thống'];
const UNASSIGN_CHIPS = ['Tài xế không phản hồi', 'Tài xế báo sự cố xe', 'Tài xế đứng yên quá lâu', 'Khách khiếu nại tài xế'];

const PAYMENT_LABEL: Record<string, string> = { COD: 'Tiền mặt (COD)', VNPAY: 'VNPay' };
const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: 'chưa thanh toán',
  PAID: 'đã thanh toán',
  FAILED: 'thanh toán lỗi',
  REFUNDED: 'đã hoàn tiền',
};

type Action = 'CANCEL' | 'UNASSIGN';

/** Giờ kèm ngày khi không phải hôm nay: "14:05" hoặc "Hôm qua 14:05". */
const stamp = (iso: string) => (dayLabel(iso) === 'Hôm nay' ? clockTime(iso) : `${dayLabel(iso)} ${clockTime(iso)}`);

function buildTimeline(order: AdminOrderDetail): TimelineStep[] {
  const history = order.statusHistory ?? [];
  return history.map((h, idx) => {
    const prev = history[idx - 1];
    const minutes = prev ? minutesBetween(prev.createdAt, h.createdAt) : 0;
    return {
      key: h.id ?? `${h.status}-${idx}`,
      status: h.status,
      title: ORDER_STEP_LABEL[h.status] ?? h.status,
      actor: describeHistoryActor(h.actor, order.restaurant?.name),
      time: stamp(h.createdAt),
      delta: prev ? `+${formatDuration(minutes)}` : undefined,
      // Màu theo thời gian đơn nằm ở bước TRƯỚC (vd: chờ tài xế 25 phút → bước "Đang giao" tô đỏ)
      health: prev ? stepHealth(prev.status, minutes) : 'ok',
      note: h.note,
      current: idx === history.length - 1 && !TERMINAL.includes(h.status),
    };
  });
}

const DetailSkeleton: React.FC = () => (
  <View className="gap-4 py-2">
    <Skeleton className="h-20 w-full rounded-2xl" />
    <Skeleton className="h-40 w-full rounded-2xl" />
    <View className="flex-row gap-3">
      <Skeleton className="h-24 flex-1 rounded-2xl" />
      <Skeleton className="h-24 flex-1 rounded-2xl" />
    </View>
  </View>
);

/**
 * Chi tiết + can thiệp một đơn. Dùng trong BottomSheet (điện thoại) và cột phải (màn rộng).
 * Bước xác nhận can thiệp hiển thị ngay trong bảng thay vì mở ConfirmDialog: iOS không mở được
 * Modal chồng lên BottomSheet (cũng là Modal).
 */
export const OrderDetailPanel: React.FC<{ orderId: string }> = ({ orderId }) => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const [action, setAction] = useState<Action | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'order-detail', orderId],
    queryFn: () => adminApi.getOrderDetail(orderId),
  });

  const resetAction = () => {
    setAction(null);
    setChip(null);
    setNote('');
    setConfirming(false);
  };

  const afterChange = (msg: string) => {
    toast(msg, 'success');
    resetAction();
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'order-detail', orderId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };
  const onFail = (fallback: string) => (err: any) => {
    const msg = err?.response?.data?.message;
    toast((Array.isArray(msg) ? msg.join(', ') : msg) || fallback, 'error');
    setConfirming(false);
  };

  const reason = [chip, note.trim()].filter(Boolean).join(': ');

  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.updateStatus(orderId, 'CANCELLED', { cancelReason: 'ADMIN_INTERVENTION', cancelNote: reason }),
    onSuccess: () => afterChange('Đã huỷ đơn hàng.'),
    onError: onFail('Không thể huỷ đơn hàng'),
  });
  const unassignMutation = useMutation({
    mutationFn: () => adminApi.unassignDriver(orderId, reason),
    onSuccess: () => afterChange('Đã gỡ tài xế và phát lại đơn cho tài xế khác.'),
    onError: onFail('Không thể gỡ tài xế'),
  });
  const pending = cancelMutation.isPending || unassignMutation.isPending;

  if (isLoading) return <DetailSkeleton />;
  if (isError || !order) {
    return <ErrorState message="Không tải được chi tiết đơn." onRetry={() => refetch()} />;
  }

  const terminal = TERMINAL.includes(order.status);
  const stalled = !!order.stalledAt && !terminal;
  const lastStep = order.statusHistory?.[order.statusHistory.length - 1];
  const inStepMinutes = lastStep ? minutesBetween(lastStep.createdAt, now) : 0;
  const currentHealth = stepHealth(order.status, inStepMinutes);
  const driverProfile = order.driver?.driverProfile;
  const driverLoc =
    driverProfile?.lastLatitude !== null && driverProfile?.lastLatitude !== undefined && driverProfile?.lastLongitude
      ? { lat: driverProfile.lastLatitude, lng: driverProfile.lastLongitude, at: driverProfile.lastLocationAt }
      : null;

  const markers: MapMarkerItem[] = [
    {
      id: 'restaurant',
      latitude: order.restaurant.latitude,
      longitude: order.restaurant.longitude,
      title: order.restaurant.name,
      type: 'restaurant',
    },
    { id: 'delivery', latitude: order.deliveryLat, longitude: order.deliveryLng, title: 'Khách', type: 'delivery' },
    ...(driverLoc && !terminal
      ? [{ id: 'driver', latitude: driverLoc.lat, longitude: driverLoc.lng, title: order.driver?.fullName, type: 'driver' as const }]
      : []),
  ];
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.01, (Math.max(...lats) - Math.min(...lats)) * 1.8),
    longitudeDelta: Math.max(0.01, (Math.max(...lngs) - Math.min(...lngs)) * 1.8),
  };

  const canUnassign = !!order.driverId && UNASSIGNABLE.includes(order.status);
  const chips = action === 'CANCEL' ? CANCEL_CHIPS : UNASSIGN_CHIPS;
  const reasonOk = reason.length >= 5;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-6">
      {/* 1. Đầu: mã, trạng thái, tổng tiền, thời gian, thanh toán */}
      <View className="gap-2 rounded-2xl bg-canvas-subtle p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="headline" weight="bold" selectable>
            #{orderCode(order.id)}
          </Text>
          <OrderStatusBadge status={order.status} role="admin" />
        </View>
        <View className="flex-row items-end justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text variant="caption" weight="regular" tone="secondary">
              Đặt lúc {formatDateTime(order.createdAt)} · {timeAgo(order.createdAt)}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} · {PAYMENT_STATUS[order.paymentStatus] ?? order.paymentStatus}
            </Text>
          </View>
          <Money amount={order.total} variant="title" tone="brand" />
        </View>
      </View>

      {stalled && (
        <NoticeCard
          tone="danger"
          icon="alert-circle"
          title={`Kẹt ${formatDuration(inStepMinutes)} ở bước ${ORDER_STEP_LABEL[order.status]}`}
          message={order.driverId ? 'Đã có tài xế nhưng đơn chưa tiến triển.' : 'Chưa có tài xế nhận. Hệ thống đã mở rộng bán kính tìm tài xế.'}
        />
      )}
      {!stalled && !terminal && currentHealth !== 'ok' && (
        <NoticeCard
          tone="warning"
          icon="time"
          title={`Đã ${formatDuration(inStepMinutes)} ở bước ${ORDER_STEP_LABEL[order.status]}`}
          message="Lâu hơn thời gian chuẩn, nên theo dõi."
        />
      )}

      {/* Lý do kết thúc */}
      {(order.cancelReason || order.failedReason || order.cancelNote) && (
        <View className="gap-1 rounded-2xl bg-danger-soft p-3">
          {!!order.cancelReason && (
            <Text variant="caption" weight="bold" tone="danger">
              Lý do huỷ: {CANCEL_REASON_LABELS[order.cancelReason]}
            </Text>
          )}
          {!!order.failedReason && (
            <Text variant="caption" weight="bold" tone="danger">
              Giao thất bại: {FAILED_DELIVERY_REASON_LABELS[order.failedReason]}
            </Text>
          )}
          {!!order.cancelNote && (
            <Text variant="caption" weight="regular" tone="default">
              Ghi chú: {order.cancelNote}
            </Text>
          )}
        </View>
      )}

      {/* 2. Dòng thời gian */}
      <SectionCard title="Dòng thời gian" icon="git-commit-outline" surfaceClassName="bg-surface">
        <Timeline steps={buildTimeline(order)} />
      </SectionCard>

      {/* 3. Ba bên */}
      <View className="flex-row flex-wrap gap-3">
        <PartyCard
          kind="restaurant"
          name={order.restaurant.name}
          imageUri={order.restaurant.imageUrl}
          phone={order.restaurant.phone}
          lines={[order.restaurant.address]}
        />
        <PartyCard
          kind="customer"
          name={order.customer?.fullName}
          imageUri={order.customer?.avatarUrl}
          phone={order.customer?.phone}
          lines={[
            order.deliveryAddress,
            order.contactAttempts?.length ? `Tài xế đã gọi ${order.contactAttempts.length} lần` : null,
          ]}
        />
        <PartyCard
          kind="driver"
          name={order.driver?.fullName}
          imageUri={order.driver?.avatarUrl}
          phone={order.driver?.phone}
          emptyText="Chưa có tài xế"
          lines={
            order.driver
              ? [
                  [vehicleLabel(driverProfile?.vehicleType), driverProfile?.licensePlate].filter(Boolean).join(' · '),
                ]
              : []
          }
        />
      </View>

      {/* 4. Bản đồ nhỏ */}
      <View className="gap-2">
        <View className="h-44 overflow-hidden rounded-2xl bg-canvas-subtle">
          <AppMapView initialRegion={region} markers={markers} autoFit="once" style={{ flex: 1 }} />
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon name="navigate-circle-outline" size="sm" tone={driverLoc ? 'success' : 'muted'} />
          <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
            {!order.driver
              ? 'Chưa có tài xế nhận đơn.'
              : driverLoc?.at
                ? `Vị trí tài xế cập nhật ${timeAgo(driverLoc.at).toLowerCase()}`
                : 'Chưa có vị trí tài xế.'}
            {' · '}
            {order.distanceKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km quán → khách
          </Text>
        </View>
      </View>

      {/* 5. Món */}
      <SectionCard title={`Món (${order.items.reduce((s, i) => s + i.quantity, 0)})`} icon="fast-food-outline">
        {order.items.map((it) => {
          const extras = [
            it.options?.size?.name,
            ...(it.options?.toppings ?? []).map((t) => `+ ${t.name}`),
            it.options?.level,
          ].filter(Boolean);
          return (
            <View key={it.id} className="flex-row items-start gap-2">
              <Text variant="body" weight="bold" tone="brand" className="w-8">
                {it.quantity}×
              </Text>
              <View className="flex-1">
                <Text variant="body" weight="medium">
                  {it.name}
                </Text>
                {extras.length > 0 && (
                  <Text variant="caption" weight="regular" tone="secondary">
                    {extras.join(', ')}
                  </Text>
                )}
                {!!it.note && (
                  <Text variant="caption" weight="regular" tone="muted">
                    “{it.note}”
                  </Text>
                )}
              </View>
              <Text variant="body" weight="medium">
                {formatVND(it.lineTotal ?? it.unitPrice * it.quantity)}
              </Text>
            </View>
          );
        })}
        {!!order.note && (
          <View className="rounded-xl bg-warning-soft px-3 py-2">
            <Text variant="caption" weight="medium">
              Ghi chú của khách: {order.note}
            </Text>
          </View>
        )}
        <View className="gap-1 border-t border-line-subtle pt-2">
          <Row label="Tiền món" value={formatVND(order.subtotal)} />
          <Row label="Phí giao hàng" value={formatVND(order.deliveryFee)} />
          {!!order.peakSurcharge && <Row label="Phụ phí giờ cao điểm" value={formatVND(order.peakSurcharge)} />}
          {!!order.platformCommission && <Row label="Hoa hồng nền tảng" value={formatVND(order.platformCommission)} muted />}
          <View className="flex-row items-center justify-between pt-1">
            <Text variant="body" weight="bold">
              Tổng cộng
            </Text>
            <Money amount={order.total} variant="body-lg" tone="brand" />
          </View>
        </View>
      </SectionCard>

      {/* 6. Can thiệp */}
      {!terminal && (
        <View className="gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4">
          <View className="flex-row items-center gap-2">
            <Icon name="construct" size="sm" tone="accent" />
            <Text variant="body" weight="bold" className="flex-1">
              Can thiệp điều hành
            </Text>
          </View>

          {!action ? (
            <View className="flex-row flex-wrap gap-2">
              {canUnassign && (
                <Button
                  label="Gỡ tài xế & phát lại"
                  leftIcon="person-remove-outline"
                  variant="secondary"
                  size="md"
                  className="min-w-40 flex-1"
                  onPress={() => setAction('UNASSIGN')}
                />
              )}
              <Button
                label="Huỷ đơn"
                leftIcon="close-circle-outline"
                variant="danger"
                size="md"
                className="min-w-40 flex-1"
                onPress={() => setAction('CANCEL')}
              />
            </View>
          ) : !confirming ? (
            <View className="gap-3">
              <Text variant="caption" weight="semibold" tone="secondary">
                {action === 'CANCEL' ? 'Lý do huỷ đơn' : 'Lý do gỡ tài xế'} (bắt buộc, lưu nhật ký)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {chips.map((c) => {
                  const on = chip === c;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setChip(on ? null : c)}
                      className={cn(
                        'min-h-9 justify-center rounded-full border px-3 py-1.5',
                        on ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
                      )}
                    >
                      <Text variant="caption" weight="semibold" tone={on ? 'inverse' : 'secondary'}>
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input placeholder="Ghi chú thêm cho nhật ký..." value={note} onChangeText={setNote} multiline />
              <View className="flex-row justify-end gap-2">
                <Button label="Quay lại" variant="secondary" size="sm" fullWidth={false} onPress={resetAction} />
                <Button
                  label="Tiếp tục"
                  variant={action === 'CANCEL' ? 'danger' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  disabled={!reasonOk}
                  onPress={() => setConfirming(true)}
                />
              </View>
            </View>
          ) : (
            <View className="gap-3 rounded-xl bg-surface p-3">
              <Text variant="body" weight="bold" tone={action === 'CANCEL' ? 'danger' : 'default'}>
                {action === 'CANCEL' ? `Huỷ đơn #${orderCode(order.id)}?` : `Gỡ tài xế ${order.driver?.fullName ?? ''}?`}
              </Text>
              <Text variant="caption" weight="regular" tone="secondary">
                {action === 'CANCEL'
                  ? 'Khách, quán và tài xế sẽ nhận thông báo. Không thể hoàn tác.'
                  : 'Đơn sẽ được phát lại cho các tài xế gần quán.'}
                {'\n'}Lý do: {reason}
              </Text>
              <View className="flex-row justify-end gap-2">
                <Button label="Quay lại" variant="secondary" size="sm" fullWidth={false} disabled={pending} onPress={() => setConfirming(false)} />
                <Button
                  label={action === 'CANCEL' ? 'Xác nhận huỷ đơn' : 'Xác nhận gỡ'}
                  variant={action === 'CANCEL' ? 'danger' : 'primary'}
                  size="sm"
                  fullWidth={false}
                  loading={pending}
                  onPress={() => (action === 'CANCEL' ? cancelMutation.mutate() : unassignMutation.mutate())}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const Row: React.FC<{ label: string; value: string; muted?: boolean }> = ({ label, value, muted }) => (
  <View className="flex-row items-center justify-between">
    <Text variant="caption" weight="regular" tone={muted ? 'muted' : 'secondary'}>
      {label}
    </Text>
    <Text variant="caption" weight="medium" tone={muted ? 'muted' : 'default'}>
      {value}
    </Text>
  </View>
);
