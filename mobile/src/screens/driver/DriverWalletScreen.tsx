import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { driversApi } from '../../api/drivers';
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
import { formatDateTime, formatVND } from '../../utils/format';

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

  const renderItem = ({ item }: { item: DriverLedgerEntry }) => {
    const meta = LEDGER_TYPE_META[item.type] ?? LEDGER_TYPE_META.ADJUSTMENT;
    const isIncrease = item.amount > 0;

    return (
      <View className="flex-row items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card">
        <View
          className={cn(
            'mt-0.5 h-10 w-10 items-center justify-center rounded-full',
            isIncrease ? 'bg-danger-soft' : 'bg-success-soft',
          )}
        >
          <Icon name={meta.icon} size="md" tone={isIncrease ? 'danger' : 'success'} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="semibold">
            {meta.label}
          </Text>
          {!!item.note && (
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {item.note}
            </Text>
          )}
          <Text variant="micro" tone="muted">
            {formatDateTime(item.createdAt)} • Số dư nợ sau GD: {formatVND(item.balanceAfter)}
          </Text>
        </View>
        <View className="items-end">
          <Text
            variant="body-lg"
            weight="bold"
            tone={isIncrease ? 'danger' : 'success'}
          >
            {isIncrease ? `+${formatVND(item.amount)}` : formatVND(item.amount)}
          </Text>
          <Text variant="micro" tone="muted">
            {isIncrease ? 'Tăng nợ' : 'Giảm nợ'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar title="Ví & Công nợ COD" onLeadingPress={() => navigation.goBack()} />

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải dữ liệu sổ quỹ COD..." />
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="gap-3 p-4 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[palette.brand['500']]}
            />
          }
          ListHeaderComponent={
            <View className="mb-1 gap-3">
              {/* Thẻ tổng quan công nợ COD */}
              <View className="gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                <View className="flex-row items-center justify-between">
                  <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
                    Công nợ tiền mặt cần nộp
                  </Text>
                  <Badge
                    label={
                      isOverLimit
                        ? 'Đã chạm hạn mức'
                        : isWarning
                        ? 'Sắp chạm hạn mức'
                        : 'Trong hạn mức'
                    }
                    tone={isOverLimit ? 'danger' : isWarning ? 'warning' : 'success'}
                  />
                </View>

                <Text
                  variant="display"
                  weight="bold"
                  tone={isOverLimit ? 'danger' : isWarning ? 'warning' : 'brand'}
                >
                  {formatVND(balance)}
                </Text>

                {/* Thanh tiến độ hạn mức */}
                <View className="gap-1.5">
                  <View className="h-2.5 w-full overflow-hidden rounded-full bg-canvas-subtle">
                    <View
                      className={cn(
                        'h-full rounded-full',
                        isOverLimit
                          ? 'bg-danger'
                          : isWarning
                          ? 'bg-warning'
                          : 'bg-brand-500',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text variant="caption" tone="secondary">
                      Hạn mức tối đa: {formatVND(limit)}
                    </Text>
                    <Text variant="caption" weight="semibold" tone="default">
                      Còn nhận được: {formatVND(remaining)}
                    </Text>
                  </View>
                </View>

                {(isOverLimit || isWarning) && (
                  <View
                    className={cn(
                      'flex-row items-center gap-2 rounded-xl p-3',
                      isOverLimit ? 'bg-danger-soft' : 'bg-warning-soft',
                    )}
                  >
                    <Icon
                      name="alert-circle"
                      size="md"
                      tone={isOverLimit ? 'danger' : 'accent'}
                    />
                    <Text
                      variant="caption"
                      tone={isOverLimit ? 'danger' : 'warning'}
                      className="flex-1"
                    >
                      {isOverLimit
                        ? 'Công nợ tiền mặt đã chạm hạn mức tối đa. Vui lòng nộp tiền mặt về công ty để tiếp tục nhận đơn mới.'
                        : 'Công nợ tiền mặt đã vượt 80% hạn mức. Hãy sắp xếp nộp tiền sớm để không bị gián đoạn nhận chuyến.'}
                    </Text>
                  </View>
                )}
              </View>

              <Text variant="headline" weight="bold" className="mt-1">
                Lịch sử biến động công nợ
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
    </SafeAreaView>
  );
};

