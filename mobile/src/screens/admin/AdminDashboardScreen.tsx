import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi, AdminAttention, AdminOverview, StatsRange } from '../../api/admin';
import {
  AttentionItem,
  AttentionList,
  BarChart,
  ContentWidth,
  HBarChart,
  KpiCard,
  KpiSkeleton,
  TrendChip,
  useIsWide,
} from '../../components/modules/admin/AdminKit';
import { ROLE_META } from '../../components/modules/admin/adminShared';
import { clockTime, Money, SectionCard, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import {
  AppImage,
  cn,
  ErrorState,
  Icon,
  IconButton,
  Skeleton,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { useSocket } from '../../hooks/useSocket';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { OrderStatus, Role } from '../../types/api';
import { formatDuration, minutesBetween, ORDER_STEP_LABEL } from '../../utils/adminOrder';
import { formatVND, orderCode } from '../../utils/format';
import { CANCEL_REASON_LABELS, FAILED_DELIVERY_REASON_LABELS } from '../../utils/orderStatus';

const RANGES: { key: StatsRange; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
];

const RANGE_COMPARE: Record<StatsRange, string> = {
  today: 'So với cùng giờ hôm qua',
  '7d': 'So với 7 ngày trước đó',
  '30d': 'So với 30 ngày trước đó',
};

const FUNNEL: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP'];

/** Nhãn ngắn + màu từng bước của phễu, cùng màu với nhãn trạng thái đơn để admin nhận ra ngay. */
const FUNNEL_META: Record<string, { label: string; box: string; text: string; bar: string }> = {
  PENDING: { label: 'Chờ quán', box: 'bg-warning-soft', text: 'text-warning-strong', bar: 'bg-warning' },
  CONFIRMED: { label: 'Đã nhận', box: 'bg-info-soft', text: 'text-info-strong', bar: 'bg-info' },
  PREPARING: { label: 'Đang làm', box: 'bg-violet-soft', text: 'text-violet-strong', bar: 'bg-violet-strong' },
  READY_FOR_PICKUP: { label: 'Chờ tài xế', box: 'bg-brand-50', text: 'text-brand-800', bar: 'bg-brand-300' },
  PICKED_UP: { label: 'Đang giao', box: 'bg-brand-100', text: 'text-brand-800', bar: 'bg-brand-600' },
};

type InsightTab = 'top' | 'reasons';

const ROLE_ORDER: Role[] = ['CUSTOMER', 'RESTAURANT_OWNER', 'DRIVER', 'ADMIN'];
const ROLE_BAR: Record<Role, string> = {
  CUSTOMER: 'bg-brand-500',
  RESTAURANT_OWNER: 'bg-warning',
  DRIVER: 'bg-success',
  ADMIN: 'bg-danger',
};

const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Làm mới dữ liệu realtime tối đa 1 lần mỗi khoảng này, tránh gọi API liên tục khi nhiều đơn đổi trạng thái. */
const REALTIME_THROTTLE_MS = 3000;

const pct = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

function reasonLabel(kind: 'cancel' | 'failed', reason: string): string {
  if (kind === 'cancel') {
    return CANCEL_REASON_LABELS[reason as keyof typeof CANCEL_REASON_LABELS] ?? 'Huỷ – không rõ lý do';
  }
  return FAILED_DELIVERY_REASON_LABELS[reason as keyof typeof FAILED_DELIVERY_REASON_LABELS] ?? 'Giao thất bại – không rõ lý do';
}

/** Các việc cần xử lý: đỏ = khẩn (đơn kẹt, tài xế vượt hạn mức nợ), cam = chờ duyệt. */
function buildAttention(a: AdminAttention, now: Date, navigation: any): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (a.stalled.count > 0) {
    const longest = a.stalled.oldestSince ? minutesBetween(a.stalled.oldestSince, now) : a.stalled.oldestMinutes;
    items.push({
      key: 'stalled',
      tone: 'danger',
      icon: 'alert-circle',
      title: `${a.stalled.count} đơn ứ đọng — lâu nhất ${formatDuration(longest)}`,
      subtitle: 'Quá thời gian chuẩn hoặc chưa có tài xế nhận',
      onPress: () => navigation.navigate('AdminOrdersTab', { group: 'stalled' }),
    });
  }
  if (a.driversOverDebt > 0) {
    items.push({
      key: 'debt',
      tone: 'danger',
      icon: 'wallet',
      title: `${a.driversOverDebt} tài xế vượt hạn mức công nợ COD`,
      subtitle: `Hạn mức ${formatVND(a.debtLimit)}, không nhận được đơn mới`,
      onPress: () => navigation.navigate('AdminUsersTab', { tab: 'DRIVER' }),
    });
  }
  if (a.roleRequests > 0) {
    items.push({
      key: 'requests',
      tone: 'warning',
      icon: 'person-add',
      title: `${a.roleRequests} yêu cầu mở quán / làm tài xế`,
      subtitle: 'Đang chờ bạn duyệt',
      onPress: () => navigation.navigate('AdminUsersTab', { openRequests: true }),
    });
  }
  if (a.restaurantsPending > 0) {
    items.push({
      key: 'rest-pending',
      tone: 'warning',
      icon: 'storefront',
      title: `${a.restaurantsPending} quán chờ duyệt`,
      onPress: () => navigation.navigate('AdminRestaurantsTab', { filter: 'pending' }),
    });
  }
  if (a.restaurantsUnassigned > 0) {
    items.push({
      key: 'rest-owner',
      tone: 'warning',
      icon: 'key',
      title: `${a.restaurantsUnassigned} quán chưa có chủ`,
      subtitle: 'Cần gán người quản lý',
      onPress: () => navigation.navigate('AdminRestaurantsTab', { filter: 'unassigned' }),
    });
  }
  if (a.vehiclesPending > 0) {
    items.push({
      key: 'vehicles',
      tone: 'warning',
      icon: 'bicycle',
      title: `${a.vehiclesPending} xe tài xế chờ duyệt`,
      onPress: () => navigation.navigate('AdminUsersTab', { tab: 'DRIVER' }),
    });
  }
  if (a.driversNearDebt > 0) {
    items.push({
      key: 'near-debt',
      tone: 'warning',
      icon: 'wallet-outline',
      title: `${a.driversNearDebt} tài xế sắp chạm hạn mức công nợ`,
      subtitle: 'Nhắc nộp tiền COD để không bị chặn nhận đơn',
      onPress: () => navigation.navigate('AdminUsersTab', { tab: 'DRIVER' }),
    });
  }
  return items;
}

/** Khung chờ đúng hình phần header (số GMV + biểu đồ). */
const HeaderSkeleton: React.FC = () => (
  <View className="gap-3 rounded-2xl bg-surface/15 p-4">
    <Skeleton className="h-3 w-32 bg-surface/30" />
    <Skeleton className="h-9 w-48 bg-surface/30" />
    <Skeleton className="h-28 w-full bg-surface/20" />
  </View>
);

export const AdminDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const toast = useToast();
  const wide = useIsWide();
  const now = useNow();
  const user = useAuthStore((s) => s.user);
  // Mặc định 7 ngày: đầu ngày "Hôm nay" gần như luôn trống
  const [range, setRange] = useState<StatsRange>('7d');
  const [insight, setInsight] = useState<InsightTab>('top');
  const [refreshing, setRefreshing] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['admin', 'overview', range],
    queryFn: () => adminApi.getOverview(range),
    placeholderData: (prev) => prev,
  });
  // Cơ cấu người dùng lấy từ thống kê tổng (không phụ thuộc kỳ)
  const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.getStats() });

  const data: AdminOverview | undefined = overviewQuery.data;
  const users = statsQuery.data?.users;

  // Realtime: đơn mới / đổi trạng thái / ứ đọng → làm mới khối "Cần xử lý" và phễu đơn
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      if (throttleRef.current) return;
      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      }, REALTIME_THROTTLE_MS);
    };
    const onStalled = (payload: { id: string }) => {
      toast(`Đơn #${orderCode(payload.id)} bị ứ đọng!`, 'error');
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      refresh();
    };
    socket.on('order:stalled', onStalled);
    socket.on('order:created', refresh);
    socket.on('order:status', refresh);
    return () => {
      socket.off('order:stalled', onStalled);
      socket.off('order:created', refresh);
      socket.off('order:status', refresh);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [socket, toast, queryClient]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([overviewQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  };

  // Tên gọi = chữ cuối của họ tên nếu là tên riêng (viết hoa); tên kiểu "Quản trị viên Hệ thống" → "Admin"
  const lastWord = user?.fullName?.trim().split(/\s+/).pop() ?? '';
  const firstName = lastWord && lastWord[0] === lastWord[0].toUpperCase() && lastWord[0] !== lastWord[0].toLowerCase() ? lastWord : 'Admin';
  const updatedAt = overviewQuery.dataUpdatedAt ? clockTime(new Date(overviewQuery.dataUpdatedAt).toISOString()) : null;
  const dateLine = `${WEEKDAY[now.getDay()]}, ${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}${updatedAt ? ` · Cập nhật ${updatedAt}` : ''}`;

  // Cột "hiện tại" (giờ này / hôm nay) tô đậm hơn
  const series = data?.series ?? [];
  const currentKey = [...series].reverse().find((p) => new Date(p.at).getTime() <= now.getTime())?.at;
  const bars = series.map((p) => ({ key: p.at, label: p.label, value: p.gmv, highlight: p.at === currentKey }));
  const ordersByKey = new Map(series.map((p) => [p.at, p.orders]));

  const attention = data ? buildAttention(data.attention, now, navigation) : [];
  const k = data?.kpis;
  const loading = overviewQuery.isLoading && !data;
  const failed = overviewQuery.isError && !data;

  const kpiGrid = (
    <View className="flex-row flex-wrap gap-3">
      {loading || !k ? (
        Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} wide={wide} />)
      ) : (
        <>
          <KpiCard
            wide={wide}
            label="Đơn hàng"
            value={k.orders.value.toLocaleString('vi-VN')}
            icon="receipt"
            changePct={k.orders.changePct}
            onPress={() => navigation.navigate('AdminOrdersTab', { group: 'active' })}
          />
          <KpiCard
            wide={wide}
            label="Thành công"
            value={pct(k.successRate.value)}
            icon="checkmark-done-circle"
            iconTone="success"
            iconBox="bg-success-soft"
            changePct={k.successRate.changePct}
            unit="pt"
          />
          <KpiCard
            wide={wide}
            label="TB mỗi đơn"
            value={<Money amount={k.aov.value} variant="title" />}
            icon="cart"
            iconTone="accent"
            iconBox="bg-accent-50"
            changePct={k.aov.changePct}
          />
          <KpiCard
            wide={wide}
            label="Huỷ / thất bại"
            value={pct(k.cancelRate.value)}
            icon="close-circle"
            iconTone="danger"
            iconBox="bg-danger-soft"
            changePct={k.cancelRate.changePct}
            unit="pt"
            inverse
            onPress={() => navigation.navigate('AdminOrdersTab', { group: 'failed' })}
          />
        </>
      )}
    </View>
  );

  const funnelTotal = FUNNEL.reduce((sum, st) => sum + (data?.funnel.statuses[st] ?? 0), 0);
  const funnelCard = (
    <SectionCard
      title="Đơn đang chạy"
      icon="pulse"
      right={
        <View className="flex-row items-center gap-1.5">
          <Text variant="headline" weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
            {funnelTotal}
          </Text>
          <View className="flex-row items-center gap-1 rounded-full bg-success-soft px-2 py-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-success" />
            <Text variant="micro" weight="bold" tone="success">
              Trực tiếp
            </Text>
          </View>
        </View>
      }
    >
      {loading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : (
        <>
          {/* Thanh tỉ lệ: đơn đang dồn ở bước nào */}
          <View className="h-2 flex-row overflow-hidden rounded-full bg-canvas-subtle">
            {FUNNEL.map((st) => {
              const n = data?.funnel.statuses[st] ?? 0;
              return n ? <View key={st} className={FUNNEL_META[st].bar} style={{ flex: n }} /> : null;
            })}
          </View>
          <View className="flex-row gap-1.5">
            {FUNNEL.map((st) => {
              const n = data?.funnel.statuses[st] ?? 0;
              const meta = FUNNEL_META[st];
              return (
                <Pressable
                  key={st}
                  accessibilityRole="button"
                  accessibilityLabel={`${ORDER_STEP_LABEL[st]}: ${n} đơn`}
                  onPress={() => navigation.navigate('AdminOrdersTab', { group: 'active', status: st })}
                  className={cn(
                    'min-h-touch flex-1 items-center justify-center gap-0.5 rounded-xl px-0.5 py-2.5 active:opacity-80',
                    n > 0 ? meta.box : 'bg-canvas-subtle',
                  )}
                >
                  <Text
                    variant="title"
                    weight="bold"
                    className={n > 0 ? meta.text : 'text-ink-muted'}
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {n}
                  </Text>
                  <Text variant="micro" weight="semibold" tone="secondary" numberOfLines={1} adjustsFontSizeToFit>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      {!!data?.funnel.stalled && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('AdminOrdersTab', { group: 'stalled' })}
          className="min-h-touch flex-row items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 active:opacity-80"
        >
          <Icon name="alert-circle" size="sm" tone="danger" />
          <Text variant="caption" weight="bold" tone="danger" className="flex-1">
            Trong đó {data.funnel.stalled} đơn ứ đọng
          </Text>
          <Icon name="chevron-forward" size="sm" tone="danger" />
        </Pressable>
      )}
    </SectionCard>
  );

  const topItems = (data?.topRestaurants ?? []).map((r, idx) => ({
    key: r.id,
    label: `${idx + 1}. ${r.name}`,
    value: r.gmv,
    valueLabel: `${formatVND(r.gmv)} · ${r.orders} đơn`,
    barClassName: idx === 0 ? 'bg-accent-500' : 'bg-brand-400',
    leading: <AppImage uri={r.imageUrl} className="h-9 w-9 rounded-lg" />,
  }));
  const reasonItems = (data?.cancelReasons ?? []).slice(0, 6).map((r) => ({
    key: `${r.kind}:${r.reason}`,
    label: reasonLabel(r.kind, r.reason),
    value: r.count,
    valueLabel: `${r.count} đơn`,
    barClassName: r.kind === 'cancel' ? 'bg-danger' : 'bg-warning',
  }));
  const reasonTotal = (data?.cancelReasons ?? []).reduce((sum, r) => sum + r.count, 0);
  const insightCard = (
    <SectionCard>
      <SegmentedTabs
        items={[
          { key: 'top' as InsightTab, label: 'Top quán', icon: 'trophy-outline' },
          { key: 'reasons' as InsightTab, label: 'Lý do huỷ', icon: 'close-circle-outline', count: reasonTotal || undefined },
        ]}
        value={insight}
        onChange={setInsight}
      />
      {loading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : insight === 'top' ? (
        <HBarChart emptyText="Chưa có đơn giao thành công trong kỳ này." items={topItems} />
      ) : (
        <HBarChart emptyText="Không có đơn huỷ hay giao thất bại trong kỳ này. 🎉" items={reasonItems} />
      )}
    </SectionCard>
  );

  const usersCard = (
    <SectionCard title="Cơ cấu người dùng" icon="people-outline">
      {users && users.total > 0 ? (
        <View className="h-2.5 flex-row overflow-hidden rounded-full bg-canvas-subtle">
          {ROLE_ORDER.map((r) =>
            users.roles[r] ? <View key={r} className={ROLE_BAR[r]} style={{ flex: users.roles[r] }} /> : null,
          )}
        </View>
      ) : (
        <Skeleton className="h-2.5 w-full rounded-full" />
      )}
      <View>
        {ROLE_ORDER.map((r) => (
          <View key={r} className="flex-row items-center gap-2 py-1">
            <View className={`h-2.5 w-2.5 rounded-full ${ROLE_BAR[r]}`} />
            <Text variant="body" tone="secondary" className="flex-1">
              {ROLE_META[r].label}
            </Text>
            <Text variant="body" weight="semibold">
              {users?.roles[r] ?? 0}
            </Text>
          </View>
        ))}
        <View className="mt-1 flex-row items-center justify-between border-t border-line-subtle pt-2">
          <Text variant="body" weight="semibold">
            Tổng cộng
          </Text>
          <Text variant="body" weight="bold" tone="brand">
            {users?.total ?? 0}
          </Text>
        </View>
      </View>
    </SectionCard>
  );

  const allClear = !loading && !attention.length && (
    <View className="flex-row items-center gap-3 rounded-2xl bg-success-soft p-4">
      <Icon name="checkmark-circle" size="md" tone="success" />
      <Text variant="body" weight="semibold" tone="success" className="flex-1">
        Không có việc tồn đọng
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView
        contentContainerClassName={TAB_BAR_CLEARANCE}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
      >
        <TabHeader
          title={`Chào ${firstName}`}
          subtitle={dateLine}
          trailing={<IconButton icon="refresh" variant="glass" accessibilityLabel="Làm mới số liệu" onPress={onRefresh} />}
        >
          <ContentWidth className="gap-4">
            <SegmentedTabs items={RANGES} value={range} onChange={setRange} trackClassName="bg-brand-50" />
            {loading ? (
              <HeaderSkeleton />
            ) : failed ? null : (
              <View className="gap-3 rounded-2xl bg-surface/15 p-4">
                <Text variant="caption" tone="inverse" className="opacity-90">
                  Doanh thu món (GMV) – đơn giao thành công
                </Text>
                <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <Text variant="display" tone="inverse" numberOfLines={1} adjustsFontSizeToFit>
                    {formatVND(k?.gmv.value ?? 0)}
                  </Text>
                  <TrendChip changePct={k?.gmv.changePct} onDark />
                </View>
                <Text variant="micro" weight="regular" tone="inverse" className="opacity-90">
                  {RANGE_COMPARE[range]} · Phí ship {formatVND(k?.deliveryFee.value ?? 0)} · Phí sàn{' '}
                  {formatVND(k?.commission.value ?? 0)}
                </Text>
                <BarChart
                  onDark
                  data={bars}
                  height={wide ? 140 : 110}
                  emptyText={range === 'today' ? 'Hôm nay chưa có đơn giao thành công.' : 'Chưa có đơn giao thành công trong kỳ này.'}
                  hint={range === 'today' ? 'Doanh thu theo giờ · chạm cột để xem' : 'Doanh thu theo ngày · chạm cột để xem'}
                  formatValue={(v, d) => `${formatVND(v)} · ${ordersByKey.get(d.key) ?? 0} đơn`}
                />
              </View>
            )}
          </ContentWidth>
        </TabHeader>

        <ContentWidth className="px-4 pt-4">
          {failed ? (
            <ErrorState message="Không tải được số liệu bảng điều khiển." onRetry={() => overviewQuery.refetch()} />
          ) : wide ? (
            <View className="flex-row items-start gap-4">
              <View className="flex-[2] gap-4">
                {kpiGrid}
                {funnelCard}
                {insightCard}
              </View>
              <View className="flex-1 gap-4">
                {attention.length ? <AttentionList items={attention} /> : allClear}
                {usersCard}
              </View>
            </View>
          ) : (
            <View className="gap-4">
              <AttentionList items={attention} />
              {kpiGrid}
              {funnelCard}
              {insightCard}
              {usersCard}
            </View>
          )}
        </ContentWidth>
      </ScrollView>
    </View>
  );
};
