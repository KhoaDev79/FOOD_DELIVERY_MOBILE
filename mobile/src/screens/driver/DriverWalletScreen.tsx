import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
import { clockTime, dayLabel, NoticeCard } from '../../components/modules/partner/PartnerKit';
import {
  Badge,
  cn,
  EmptyState,
  Icon,
  LoadingSpinner,
  Text,
  TopBar,
} from '../../components/ui';
import { palette } from '../../theme';
import { DriverLedgerEntry, DriverLedgerType } from '../../types/api';
import { DriverStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverWallet'>;

const LEDGER_TYPE_META: Record<
  DriverLedgerType,
  { label: string; icon: 'cash-outline' | 'checkmark-done-circle-outline' | 'swap-vertical-outline'; tone: 'danger' | 'success' | 'brand' }
> = {
  COD_COLLECTED: {
    label: 'Thu hộ tiền mặt (COD)',
    icon: 'cash-outline',
    tone: 'danger',
  },
  SETTLEMENT: {
    label: 'Đã nộp tiền về công ty',
    icon: 'checkmark-done-circle-outline',
    tone: 'success',
  },
  ADJUSTMENT: {
    label: 'Điều chỉnh / Công chuyến',
    icon: 'swap-vertical-outline',
    tone: 'brand',
  },
};

type Row = { kind: 'header'; key: string; label: string } | { kind: 'entry'; key: string; entry: DriverLedgerEntry };

export const DriverWalletScreen: React.FC<Props> = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver', 'ledger'],
    queryFn: () => driversApi.getMyLedger({ page: 1, limit: 50 }),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const balance = data?.balance ?? 0;
  const limit = data?.limit ?? 2000000;
  const ratio = limit > 0 ? Math.min(1, Math.max(0, balance / limit)) : 0;
  const isOverLimit = balance >= limit;
  const isWarning = !isOverLimit && ratio >= 0.8;
  const remaining = Math.max(0, limit - balance);

  // Nhóm giao dịch theo ngày (danh sách đã sắp mới nhất trước)
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    for (const entry of data?.items ?? []) {
      const day = new Date(entry.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ kind: 'header', key: `h-${day}`, label: dayLabel(entry.createdAt) });
        lastDay = day;
      }
      out.push({ kind: 'entry', key: entry.id, entry });
    }
    return out;
  }, [data]);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'header') {
      return (
        <Text variant="caption" weight="bold" tone="muted" className="mt-2 uppercase">
          {item.label}
        </Text>
      );
    }
    const entry = item.entry;
    const meta = LEDGER_TYPE_META[entry.type] ?? LEDGER_TYPE_META.ADJUSTMENT;
    const isIncrease = entry.amount > 0;

    return (
      <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
        <View
          className={cn(
            'h-10 w-10 items-center justify-center rounded-full',
            isIncrease ? 'bg-danger-soft' : 'bg-success-soft',
          )}
        >
          <Icon name={meta.icon} size="md" tone={isIncrease ? 'danger' : 'success'} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="semibold" numberOfLines={1}>
            {meta.label}
          </Text>
          {!!entry.note && (
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
              {entry.note}
            </Text>
          )}
          <Text variant="micro" weight="medium" tone="muted">
            {clockTime(entry.createdAt)} • Nợ sau GD: {formatVND(entry.balanceAfter)}
          </Text>
        </View>
        <Text variant="body-lg" weight="bold" tone={isIncrease ? 'danger' : 'success'}>
          {isIncrease ? `+${formatVND(entry.amount)}` : formatVND(entry.amount)}
        </Text>
      </View>
    );
  };

  const statusTone = isOverLimit ? 'danger' : isWarning ? 'warning' : 'brand';

  return (
    <View className="flex-1 bg-canvas-subtle">
      <SafeAreaView edges={['top']} className="bg-canvas">
        <TopBar title="Ví & Công nợ COD" onLeadingPress={() => navigation.goBack()} />
      </SafeAreaView>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải dữ liệu sổ quỹ COD..." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-2.5 p-4 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.brand['500']}
              colors={[palette.brand['500']]}
            />
          }
          ListHeaderComponent={
            <View className="mb-1 gap-3">
              {/* Thẻ tổng quan công nợ COD */}
              <View className="gap-3 rounded-2xl bg-surface p-4 shadow-card">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={cn(
                        'h-8 w-8 items-center justify-center rounded-full',
                        isOverLimit ? 'bg-danger-soft' : isWarning ? 'bg-warning-soft' : 'bg-brand-50',
                      )}
                    >
                      <Icon name="wallet" size="sm" tone={statusTone} />
                    </View>
                    <Text variant="caption" weight="bold" tone="secondary">
                      Công nợ tiền mặt cần nộp
                    </Text>
                  </View>
                  <Badge
                    label={isOverLimit ? 'Đã chạm hạn mức' : isWarning ? 'Sắp chạm hạn mức' : 'Trong hạn mức'}
                    tone={isOverLimit ? 'danger' : isWarning ? 'warning' : 'success'}
                  />
                </View>

                <Text variant="display" weight="bold" tone={statusTone}>
                  {formatVND(balance)}
                </Text>

                {/* Thanh tiến độ hạn mức */}
                <View className="gap-2">
                  <View className="h-2.5 w-full overflow-hidden rounded-full bg-canvas-subtle">
                    <View
                      className={cn(
                        'h-full rounded-full',
                        isOverLimit ? 'bg-danger' : isWarning ? 'bg-warning' : 'bg-brand-500',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1 rounded-xl bg-canvas-subtle p-2.5">
                      <Text variant="micro" tone="muted">
                        Hạn mức tối đa
                      </Text>
                      <Text variant="body" weight="bold">
                        {formatVND(limit)}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-xl bg-canvas-subtle p-2.5">
                      <Text variant="micro" tone="muted">
                        Còn nhận được
                      </Text>
                      <Text variant="body" weight="bold" tone={isOverLimit ? 'danger' : 'success'}>
                        {formatVND(remaining)}
                      </Text>
                    </View>
                  </View>
                </View>

                {(isOverLimit || isWarning) && (
                  <View
                    className={cn(
                      'flex-row items-center gap-2 rounded-xl p-3',
                      isOverLimit ? 'bg-danger-soft' : 'bg-warning-soft',
                    )}
                  >
                    <Icon name="alert-circle" size="md" tone={isOverLimit ? 'danger' : 'accent'} />
                    <Text variant="caption" tone={isOverLimit ? 'danger' : 'warning'} className="flex-1">
                      {isOverLimit
                        ? 'Công nợ tiền mặt đã chạm hạn mức tối đa. Vui lòng nộp tiền mặt về công ty để tiếp tục nhận đơn mới.'
                        : 'Công nợ tiền mặt đã vượt 80% hạn mức. Hãy sắp xếp nộp tiền sớm để không bị gián đoạn nhận chuyến.'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Hướng dẫn nộp tiền (khoản nộp do quản trị viên ghi nhận) */}
              <NoticeCard
                tone="brand"
                icon="information-circle"
                title="Cách nộp tiền COD"
                message="Nộp tiền mặt đã thu hộ cho quản trị viên ZomZom. Sau khi quản trị viên xác nhận, công nợ sẽ giảm ngay và hiện trong lịch sử bên dưới."
              />

              <Text variant="headline" weight="bold" className="mt-1">
                Lịch sử biến động
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title="Chưa có phát sinh công nợ"
              description="Mọi giao dịch thu hộ tiền mặt COD, nộp tiền và điều chỉnh công chuyến sẽ hiển thị tại đây."
            />
          }
        />
      )}
    </View>
  );
};
