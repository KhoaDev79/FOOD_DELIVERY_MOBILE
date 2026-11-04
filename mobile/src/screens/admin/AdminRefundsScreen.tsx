import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { FlatList, RefreshControl, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SegmentedTabs } from '../../components/modules/partner/PartnerKit';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { useConfirmRefund, useRefunds } from '../../services/useOrders';
import { palette } from '../../theme';
import { RefundOrder } from '../../types/api';
import { formatDateTime, formatVND, orderCode } from '../../utils/format';
import { formatOrderEndReason } from '../../utils/orderStatus';

type Tab = 'pending' | 'done';

const RefundCard: React.FC<{ o: RefundOrder; onConfirm?: () => void }> = ({ o, onConfirm }) => {
  const tx = o.transactions[0];
  return (
    <View className="gap-2.5 rounded-2xl bg-surface p-4 shadow-card">
      <View className="flex-row items-center justify-between gap-2">
        <Text variant="body" weight="bold">
          Đơn #{orderCode(o.id)}
        </Text>
        <Badge
          label={o.paymentStatus === 'REFUNDED' ? 'Đã hoàn' : 'Chờ hoàn'}
          tone={o.paymentStatus === 'REFUNDED' ? 'success' : 'warning'}
          size="sm"
        />
      </View>
      <View className="flex-row items-end justify-between">
        <View className="flex-1 gap-0.5">
          <Text variant="caption" weight="medium">
            {o.customer.fullName}
            {o.customer.phone ? ` · ${o.customer.phone}` : ''}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            {o.restaurant.name} · {formatDateTime(o.createdAt)}
          </Text>
        </View>
        <Text variant="headline" weight="bold" tone="brand">
          {formatVND(o.total)}
        </Text>
      </View>
      <Text variant="caption" weight="regular" tone="secondary">
        {o.status === 'CANCELLED' ? 'Huỷ: ' : 'Giao thất bại: '}
        {formatOrderEndReason(o) ?? '—'}
      </Text>
      {!!tx && (
        <Text variant="micro" weight="regular" tone="muted">
          Giao dịch VNPay: {tx.providerTxnNo || tx.txnRef}
          {tx.bankCode ? ` · ${tx.bankCode}` : ''}
        </Text>
      )}
      {o.paymentStatus === 'REFUNDED' ? (
        <Text variant="caption" weight="medium" tone="success">
          Đã hoàn {o.refundedAt ? formatDateTime(o.refundedAt) : ''}
          {o.refundNote ? ` · ${o.refundNote}` : ''}
        </Text>
      ) : (
        onConfirm && <Button label="Xác nhận đã hoàn tiền" size="sm" leftIcon="checkmark-done" onPress={onConfirm} />
      )}
    </View>
  );
};

/**
 * Hoàn tiền thủ công: đơn đã thanh toán VNPay nhưng bị huỷ / giao thất bại.
 * Admin hoàn tiền trên cổng VNPay rồi xác nhận ở đây (ghi mã giao dịch hoàn), khách nhận thông báo.
 */
export const AdminRefundsScreen: React.FC = () => {
  const navigation = useNavigation();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('pending');
  const [confirming, setConfirming] = useState<RefundOrder | null>(null);
  const [note, setNote] = useState('');
  const query = useRefunds(tab);
  const confirm = useConfirmRefund();

  const submit = async () => {
    if (!confirming || note.trim().length < 3) {
      toast('Nhập mã giao dịch hoặc ghi chú hoàn tiền (ít nhất 3 ký tự)', 'error');
      return;
    }
    try {
      await confirm.mutateAsync({ orderId: confirming.id, note: note.trim() });
      toast('Đã xác nhận hoàn tiền, khách sẽ nhận thông báo', 'success');
      setConfirming(null);
      setNote('');
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Không xác nhận được', 'error');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar title="Hoàn tiền" onLeadingPress={() => navigation.goBack()} className="bg-canvas-subtle" />
      <View className="px-4 pb-2">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          trackClassName="bg-line"
          items={[
            { key: 'pending', label: 'Chờ hoàn', icon: 'time-outline', count: tab === 'pending' ? query.data?.length : undefined },
            { key: 'done', label: 'Đã hoàn', icon: 'checkmark-done-outline' },
          ]}
        />
      </View>

      {query.isLoading ? (
        <View className="gap-3 p-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(o) => o.id}
          contentContainerClassName="gap-3 p-4 pb-10"
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
          ListHeaderComponent={
            tab === 'pending' ? (
              <Text variant="caption" weight="regular" tone="secondary">
                Hoàn tiền trên cổng VNPay trước, sau đó bấm xác nhận và ghi mã giao dịch hoàn để đối chiếu.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <RefundCard o={item} onConfirm={tab === 'pending' ? () => setConfirming(item) : undefined} />
          )}
          ListEmptyComponent={
            <EmptyState
              variant="card"
              icon="wallet-outline"
              title={tab === 'pending' ? 'Không có đơn chờ hoàn tiền' : 'Chưa có đơn đã hoàn'}
              description="Chỉ đơn thanh toán online (VNPay) bị huỷ hoặc giao thất bại mới cần hoàn tiền."
            />
          }
        />
      )}

      <ConfirmDialog
        visible={Boolean(confirming)}
        title={confirming ? `Hoàn ${formatVND(confirming.total)} cho đơn #${orderCode(confirming.id)}?` : ''}
        message="Chỉ xác nhận sau khi đã hoàn tiền thật trên cổng thanh toán."
        confirmLabel="Đã hoàn tiền"
        cancelLabel="Huỷ"
        loading={confirm.isPending}
        onConfirm={submit}
        onCancel={() => {
          setConfirming(null);
          setNote('');
        }}
      >
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Mã giao dịch hoàn / ghi chú"
          placeholderTextColor={palette.ink.muted}
          maxLength={300}
          accessibilityLabel="Ghi chú hoàn tiền"
          className="mt-2 rounded-xl border border-line bg-surface px-3 py-2.5 font-body text-body text-ink"
        />
      </ConfirmDialog>
    </SafeAreaView>
  );
};
