import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, RefreshControl, Text as RNText, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantsApi } from '../../api/restaurants';
import { ErrorState, Gradient, Icon, IconButton, IconName, LoadingSpinner, Text } from '../../components/ui';
import { OwnerRestaurantSelector } from '../../components/modules/owner/OwnerRestaurantSelector';
import { ExportCsvSheet } from '../../components/modules/partner/ExportCsvSheet';
import { useOwnerRestaurantStore } from '../../store/useOwnerRestaurantStore';
import { palette } from '../../theme';
import { OwnerStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerStats'>;
type Range = 1 | 7 | 30;

const RANGES: { label: string; value: Range }[] = [
  { label: 'Hôm nay', value: 1 },
  { label: '7 ngày', value: 7 },
  { label: '30 ngày', value: 30 },
];

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CHART_HEIGHT = 140;

/** "2026-10-30" -> "30/10" */
const dayMonth = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
/** Thứ trong tuần của ngày "YYYY-MM-DD" (tính theo lịch, không phụ thuộc múi giờ máy). */
const weekday = (key: string) => WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
/** Số tiền gọn cho nhãn biểu đồ: 1.250.000 -> "1,3tr", 85.000 -> "85k". */
const compactVND = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}tr` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;

export const OwnerStatsScreen: React.FC<Props> = ({ navigation }) => {
  const [days, setDays] = useState<Range>(7);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data: restaurants } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });
  const getActiveRestaurant = useOwnerRestaurantStore((s) => s.getActiveRestaurant);
  const restaurant = getActiveRestaurant(restaurants);

  const stats = useQuery({
    queryKey: ['owner', 'stats', restaurant?.id, days],
    queryFn: () => restaurantsApi.getStats(restaurant!.id, days),
    enabled: Boolean(restaurant?.id),
  });
  const s = stats.data;

  const maxDaily = Math.max(1, ...(s?.daily.map((d) => d.revenue) ?? [0]));
  const maxQty = Math.max(1, ...(s?.topItems.map((t) => t.quantity) ?? [0]));
  const selected = s?.daily.find((d) => d.date === selectedDay) ?? null;

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="light" />

      {/* Đầu trang: quay lại, chọn khoảng thời gian, doanh thu */}
      <Gradient preset="tabHeader" className="overflow-hidden rounded-b-2xl">
        <SafeAreaView edges={['top']}>
          <View className="gap-4 px-4 pb-5 pt-2">
            <View className="min-h-touch flex-row items-center gap-2">
              <IconButton
                icon="arrow-back"
                variant="glass"
                accessibilityLabel="Quay lại"
                onPress={() => navigation.goBack()}
              />
              <Text variant="title" tone="inverse" accessibilityRole="header" className="flex-1">
                Thống kê bán hàng
              </Text>
              {restaurant && (
                <IconButton
                  icon="download-outline"
                  variant="glass"
                  accessibilityLabel="Xuất doanh thu ra file CSV"
                  onPress={() => setExportOpen(true)}
                />
              )}
            </View>
            {restaurant && (
              <OwnerRestaurantSelector
                restaurants={restaurants}
                currentRestaurant={restaurant}
              />
            )}

            <View className="flex-row gap-2 rounded-full bg-surface/15 p-1">
              {RANGES.map((r) => {
                const active = days === r.value;
                return (
                  <Pressable
                    key={r.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setDays(r.value);
                      setSelectedDay(null);
                    }}
                    className={`min-h-touch flex-1 items-center justify-center rounded-full ${active ? 'bg-surface' : ''}`}
                  >
                    <Text variant="body" weight="semibold" tone={active ? 'brand' : 'inverse'}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              <Text variant="body" tone="inverse" className="opacity-85">
                Doanh thu {s ? (days === 1 ? `hôm nay ${dayMonth(s.to)}` : `${dayMonth(s.from)} – ${dayMonth(s.to)}`) : ''}
              </Text>
              {/* Text của kit không ghi đè được cỡ chữ qua className, nên số lớn dùng Text của RN */}
              <RNText className="font-body-bold text-[34px] leading-[44px] text-white">
                {s ? formatVND(s.revenue) : '—'}
              </RNText>
              <Text variant="caption" tone="inverse" className="opacity-75">
                Tiền món của đơn đã giao thành công, chưa gồm phí giao hàng
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Gradient>

      {!restaurant || stats.isLoading ? (
        <LoadingSpinner message="Đang tính số liệu..." />
      ) : stats.isError || !s ? (
        <ErrorState message="Không tải được số liệu thống kê." onRetry={() => {
            stats.refetch();
          }} />
      ) : (
        <ScrollView
          contentContainerClassName="gap-5 px-4 pb-10 pt-5"
          refreshControl={
            <RefreshControl refreshing={stats.isRefetching} onRefresh={() => {
                stats.refetch();
              }} colors={[palette.brand['500']]} />
          }
        >
          {/* Chỉ số chính */}
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <Kpi icon="checkmark-done-outline" tone="success" label="Đơn hoàn thành" value={String(s.deliveredOrders)} />
            <Kpi icon="fast-food-outline" tone="brand" label="Món đã bán" value={String(s.itemsSold)} />
            <Kpi icon="wallet-outline" tone="accent" label="Trung bình mỗi đơn" value={formatVND(s.averageOrderValue)} />
            <Kpi
              icon="close-circle-outline"
              tone="danger"
              label="Đơn bị huỷ"
              value={String(s.cancelledOrders)}
              note={s.inProgressOrders ? `${s.inProgressOrders} đơn đang xử lý` : undefined}
            />
          </View>

          {/* Biểu đồ doanh thu theo ngày */}
          {days > 1 && (
            <Section title="Doanh thu theo ngày">
              <View className="rounded-xl bg-surface p-4 shadow-card">
                <Text variant="caption" tone="secondary">
                  {selected
                    ? `${weekday(selected.date)}, ${dayMonth(selected.date)}: ${formatVND(selected.revenue)} · ${selected.orders} đơn`
                    : 'Chạm vào cột để xem chi tiết từng ngày'}
                </Text>
                <View className="mt-3 flex-row items-end gap-1" style={{ height: CHART_HEIGHT }}>
                  {s.daily.map((d) => {
                    const active = d.date === selectedDay;
                    // NGOẠI LỆ style: chiều cao cột là giá trị tính động theo doanh thu.
                    const h = d.revenue ? Math.max(6, Math.round((d.revenue / maxDaily) * CHART_HEIGHT)) : 3;
                    return (
                      <Pressable
                        key={d.date}
                        accessibilityRole="button"
                        accessibilityLabel={`${dayMonth(d.date)}: ${formatVND(d.revenue)}, ${d.orders} đơn`}
                        onPress={() => setSelectedDay(active ? null : d.date)}
                        className="h-full flex-1 justify-end"
                      >
                        <View
                          className={`w-full rounded-t-md ${active ? 'bg-accent-500' : d.revenue ? 'bg-brand-500' : 'bg-line'}`}
                          style={{ height: h }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                {days === 7 ? (
                  <View className="mt-2 flex-row gap-1">
                    {s.daily.map((d) => (
                      <Text key={d.date} variant="micro" weight="medium" tone="muted" className="flex-1 text-center">
                        {weekday(d.date)}
                      </Text>
                    ))}
                  </View>
                ) : (
                  // 30 cột quá hẹp để ghi ngày dưới từng cột: chỉ ghi ngày đầu, giữa và cuối
                  <View className="mt-2 flex-row justify-between">
                    {[0, Math.floor(s.daily.length / 2), s.daily.length - 1].map((i) => (
                      <Text key={i} variant="micro" weight="medium" tone="muted">
                        {dayMonth(s.daily[i].date)}
                      </Text>
                    ))}
                  </View>
                )}
                <View className="mt-3 flex-row justify-between border-t border-line-subtle pt-3">
                  <Text variant="caption" tone="secondary">
                    Cao nhất: {compactVND(Math.max(...s.daily.map((d) => d.revenue)))}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {s.deliveredOrders} đơn / {s.totalOrders} đơn đặt
                  </Text>
                </View>
              </View>
            </Section>
          )}

          {/* Món bán chạy */}
          <Section title="Món bán chạy">
            {s.topItems.length === 0 ? (
              <View className="items-center gap-2 rounded-xl bg-surface p-6 shadow-card">
                <Icon name="bar-chart-outline" size="xl" tone="muted" />
                <Text variant="body" tone="secondary" className="text-center">
                  Chưa có món nào được bán trong khoảng thời gian này.
                </Text>
              </View>
            ) : (
              <View className="rounded-xl bg-surface px-4 py-2 shadow-card">
                {s.topItems.map((t, i) => (
                  <View key={t.menuItemId} className={`gap-2 py-3 ${i > 0 ? 'border-t border-line-subtle' : ''}`}>
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'bg-accent-500' : i < 3 ? 'bg-brand-500' : 'bg-canvas-subtle'}`}
                      >
                        <Text variant="caption" weight="bold" tone={i < 3 ? 'inverse' : 'secondary'}>
                          {i + 1}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text variant="body" weight="semibold" numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          Đã bán {t.quantity} phần
                        </Text>
                      </View>
                      <Text variant="body" weight="bold" tone="brand">
                        {formatVND(t.revenue)}
                      </Text>
                    </View>
                    <View className="ml-11 h-1.5 overflow-hidden rounded-full bg-canvas-subtle">
                      {/* NGOẠI LỆ style: độ dài thanh là giá trị tính động theo số lượng bán. */}
                      <View
                        className={`h-full rounded-full ${i === 0 ? 'bg-accent-500' : 'bg-brand-400'}`}
                        style={{ width: `${Math.round((t.quantity / maxQty) * 100)}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Section>
        </ScrollView>
      )}
      {restaurant && (
        <ExportCsvSheet
          visible={exportOpen}
          onClose={() => setExportOpen(false)}
          title="Xuất doanh thu (CSV)"
          description={`Mỗi đơn của ${restaurant.name} một dòng: thời gian, trạng thái, món, thanh toán, doanh thu tiền món; dòng TỔNG ở cuối. Chỉ đơn giao thành công được tính tiền.`}
          filePrefix="zomzom-doanh-thu"
          fetchCsv={(from, to) => restaurantsApi.exportRevenueCsv(restaurant.id, from, to)}
        />
      )}
    </View>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-2">
    <Text variant="headline" accessibilityRole="header" className="px-1">
      {title}
    </Text>
    {children}
  </View>
);

const KPI_BG: Record<'success' | 'brand' | 'accent' | 'danger', string> = {
  success: 'bg-success-soft',
  brand: 'bg-brand-50',
  accent: 'bg-accent-50',
  danger: 'bg-danger-soft',
};

const Kpi: React.FC<{
  icon: IconName;
  tone: 'success' | 'brand' | 'accent' | 'danger';
  label: string;
  value: string;
  note?: string;
}> = ({ icon, tone, label, value, note }) => (
  <View className="w-[48.5%] gap-2 rounded-xl bg-surface p-3.5 shadow-card">
    <View className={`h-9 w-9 items-center justify-center rounded-lg ${KPI_BG[tone]}`}>
      <Icon name={icon} size="md" tone={tone} />
    </View>
    <View>
      <Text variant="headline" weight="bold" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
      {!!note && (
        <Text variant="micro" weight="medium" tone="muted" numberOfLines={1}>
          {note}
        </Text>
      )}
    </View>
  </View>
);
