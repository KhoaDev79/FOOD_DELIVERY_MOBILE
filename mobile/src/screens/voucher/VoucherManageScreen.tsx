import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoucherFormSheet } from '../../components/modules/voucher/VoucherFormSheet';
import { voucherHeadline } from '../../components/modules/voucher/VoucherTicket';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FilterBar,
  Icon,
  Skeleton,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { VoucherManageStatus } from '../../api/vouchers';
import { useManagedVouchers, useSaveVoucher } from '../../services/useVouchers';
import { palette } from '../../theme';
import { VoucherAdmin } from '../../types/api';
import { formatVND } from '../../utils/format';

type Filter = VoucherManageStatus | 'compensation';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Trạng thái hiển thị của mã: đang chạy / tạm tắt / hết hạn / hết lượt */
function statusOf(v: VoucherAdmin): { label: string; tone: 'success' | 'neutral' | 'danger' | 'warning' } {
  if (!v.isActive) return { label: 'Tạm tắt', tone: 'neutral' };
  if (new Date(v.endDate).getTime() <= Date.now()) return { label: 'Hết hạn', tone: 'danger' };
  if (v.usedCount >= v.maxUsage) return { label: 'Hết lượt', tone: 'warning' };
  if (new Date(v.startDate).getTime() > Date.now()) return { label: 'Sắp chạy', tone: 'warning' };
  return { label: 'Đang chạy', tone: 'success' };
}

const VoucherRow: React.FC<{
  v: VoucherAdmin;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  busy: boolean;
}> = ({ v, onEdit, onToggle, busy }) => {
  const st = statusOf(v);
  const pct = Math.min(100, Math.round((v.usedCount / Math.max(1, v.maxUsage)) * 100));
  const isComp = v.kind === 'COMPENSATION';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sửa mã ${v.code}`}
      onPress={isComp ? undefined : onEdit}
      className="gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-90"
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl ${
            v.discountType === 'FREE_SHIP' ? 'bg-brand-50' : isComp ? 'bg-violet-soft' : 'bg-accent-50'
          }`}
        >
          <Icon
            name={v.discountType === 'FREE_SHIP' ? 'bicycle' : isComp ? 'gift' : 'pricetag'}
            size="md"
            tone={v.discountType === 'FREE_SHIP' ? 'brand' : isComp ? 'violet' : 'accent'}
          />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="body" weight="bold">
              {v.code}
            </Text>
            <Badge label={st.label} tone={st.tone} size="sm" />
          </View>
          <Text variant="caption" weight="medium" numberOfLines={2}>
            {voucherHeadline(v)}
            {v.minOrderAmount > 0 ? ` · đơn từ ${formatVND(v.minOrderAmount)}` : ''}
          </Text>
          <Text variant="micro" weight="regular" tone="muted">
            {fmtDate(v.startDate)} – {fmtDate(v.endDate)}
            {v.perUserLimit > 1 ? ` · ${v.perUserLimit} lượt/khách` : ' · 1 lượt/khách'}
            {v.onlyNewCustomer ? ' · Khách mới' : ''}
          </Text>
          {(v.restaurant || v.user) && (
            <Text variant="micro" weight="semibold" tone="secondary" numberOfLines={1}>
              {v.user ? `Tặng: ${v.user.fullName}` : `Quán: ${v.restaurant!.name}`}
            </Text>
          )}
        </View>
        {!isComp && (
          <Switch
            value={v.isActive}
            disabled={busy}
            onValueChange={onToggle}
            accessibilityLabel={v.isActive ? `Tắt mã ${v.code}` : `Bật mã ${v.code}`}
            trackColor={{ true: palette.brand['500'], false: palette.line.DEFAULT }}
            thumbColor="#fff"
          />
        )}
      </View>
      <View className="gap-1">
        <View className="h-1.5 overflow-hidden rounded-full bg-canvas-subtle">
          <View className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
        </View>
        <Text variant="micro" weight="regular" tone="secondary">
          Đã dùng {v.usedCount.toLocaleString('vi-VN')}/{v.maxUsage.toLocaleString('vi-VN')} lượt
        </Text>
      </View>
    </Pressable>
  );
};

/**
 * Quản lý voucher.
 * - Admin (không có restaurantId): mã toàn sàn, sàn chịu chi phí; xem thêm voucher bồi thường đã phát.
 * - Chủ quán (route có restaurantId): mã của quán, quán chịu chi phí.
 */
export const VoucherManageScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params ?? {}) as { restaurantId?: string; restaurantName?: string };
  const restaurantId = params.restaurantId;
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('active');
  const [form, setForm] = useState<{ open: boolean; editing: VoucherAdmin | null; key: number }>({
    open: false,
    editing: null,
    key: 0,
  });

  const query = useManagedVouchers(
    restaurantId,
    filter === 'compensation' ? { status: 'all', kind: 'COMPENSATION' } : { status: filter, kind: restaurantId ? undefined : 'CAMPAIGN' },
  );
  const save = useSaveVoucher(restaurantId);

  const openForm = (editing: VoucherAdmin | null) => setForm((f) => ({ open: true, editing, key: f.key + 1 }));

  const toggle = async (v: VoucherAdmin, active: boolean) => {
    try {
      await save.mutateAsync({ id: v.id, data: { isActive: active } });
      toast(active ? `Đã bật mã ${v.code}` : `Đã tắt mã ${v.code}`, 'success');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không cập nhật được mã', 'error');
    }
  };

  const filters: { value: Filter; label: string }[] = [
    { value: 'active', label: 'Đang chạy' },
    { value: 'inactive', label: 'Tạm tắt' },
    { value: 'expired', label: 'Hết hạn' },
    { value: 'all', label: 'Tất cả' },
    ...(restaurantId ? [] : [{ value: 'compensation' as const, label: 'Bồi thường' }]),
  ];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar
        title={restaurantId ? 'Mã giảm giá của quán' : 'Voucher & khuyến mãi'}
        onLeadingPress={() => navigation.goBack()}
        className="bg-canvas-subtle"
      />
      {!!params.restaurantName && (
        <Text variant="caption" weight="regular" tone="secondary" className="-mt-1 px-4 text-center">
          {params.restaurantName}
        </Text>
      )}
      <FilterBar options={filters} value={filter} onChange={setFilter} />

      {query.isLoading ? (
        <View className="gap-3 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(v) => v.id}
          contentContainerClassName="gap-3 p-4 pb-28"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
          renderItem={({ item }) => (
            <VoucherRow v={item} busy={save.isPending} onEdit={() => openForm(item)} onToggle={(a) => toggle(item, a)} />
          )}
          ListEmptyComponent={
            <EmptyState
              variant="card"
              icon="pricetags-outline"
              title={filter === 'active' ? 'Chưa có mã nào đang chạy' : 'Không có mã nào'}
              description={
                restaurantId
                  ? 'Tạo mã giảm giá để thu hút khách đặt món ở quán bạn. Số tiền giảm được trừ vào doanh thu quán.'
                  : 'Tạo mã giảm giá, freeship cho toàn sàn.'
              }
              actionLabel={filter === 'compensation' ? undefined : 'Tạo mã mới'}
              onAction={filter === 'compensation' ? undefined : () => openForm(null)}
            />
          }
        />
      )}

      {filter !== 'compensation' && (
        <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <Button label="Tạo mã giảm giá" leftIcon="add" size="lg" onPress={() => openForm(null)} />
        </SafeAreaView>
      )}

      <VoucherFormSheet
        key={form.key}
        visible={form.open}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        restaurantId={restaurantId}
        editing={form.editing}
      />
    </SafeAreaView>
  );
};
