import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ordersApi } from '../../../api/orders';
import { useCancelOrder } from '../../../services/useOrders';
import { CancelReason } from '../../../types/api';
import { BottomSheet, Button, cn, Icon, Input, Skeleton, Text, useToast } from '../../ui';

/**
 * Bảng huỷ đơn của khách: chọn lý do (bắt buộc), ghi chú khi chọn "Lý do khác",
 * lời nhắc khi huỷ nhiều đơn gần đây. Đơn quán đã nhận thì hướng khách gửi yêu cầu hỗ trợ.
 */
export const CancelOrderSheet: React.FC<{
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onCancelled?: () => void;
  /** Quán đã nhận đơn: mở luồng gửi yêu cầu hỗ trợ */
  onRequestSupport?: () => void;
}> = ({ visible, orderId, onClose, onCancelled, onRequestSupport }) => {
  const toast = useToast();
  const cancelMutation = useCancelOrder();
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState('');

  const info = useQuery({
    queryKey: ['orders', 'cancel-info', orderId],
    queryFn: () => ordersApi.getCancelInfo(orderId),
    enabled: visible && Boolean(orderId),
    staleTime: 0,
  });

  const selected = info.data?.reasons.find((r) => r.value === reason);
  const needNote = Boolean(selected?.requiresNote);
  const canSubmit = Boolean(reason) && (!needNote || note.trim().length >= 5);

  const submit = async () => {
    if (!reason) return;
    try {
      await cancelMutation.mutateAsync({ orderId, reason, note: note.trim() || undefined });
      toast('Đã huỷ đơn hàng', 'success');
      onClose();
      onCancelled?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast(Array.isArray(msg) ? msg[0] : msg || 'Không huỷ được đơn, có thể quán vừa nhận đơn.', 'error');
      void info.refetch();
    }
  };

  const data = info.data;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Huỷ đơn hàng"
      footer={
        data && !data.canCancel ? (
          <View className="flex-row gap-3 pb-2">
            <Button label="Đóng" variant="outline" size="md" className="flex-1" onPress={onClose} />
            {onRequestSupport && (
              <Button
                label="Gửi yêu cầu hỗ trợ"
                size="md"
                className="flex-1"
                onPress={() => {
                  onClose();
                  onRequestSupport();
                }}
              />
            )}
          </View>
        ) : (
          <View className="flex-row gap-3 pb-2">
            <Button label="Giữ đơn" variant="outline" size="md" className="flex-1" onPress={onClose} />
            <Button
              label="Huỷ đơn"
              variant="danger"
              size="md"
              className="flex-1"
              disabled={!canSubmit}
              loading={cancelMutation.isPending}
              onPress={submit}
            />
          </View>
        )
      }
    >
      <ScrollView className="max-h-[460px]" contentContainerClassName="gap-3 pb-3" keyboardShouldPersistTaps="handled">
        {info.isLoading || !data ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)
        ) : !data.canCancel ? (
          <View className="flex-row items-start gap-3 rounded-xl bg-canvas-subtle p-3">
            <Icon name="information-circle" size="md" tone="warning" />
            <Text variant="body" weight="regular" className="flex-1">
              {data.reason}
            </Text>
          </View>
        ) : (
          <>
            {!!data.warning && (
              <View className="flex-row items-start gap-2.5 rounded-xl bg-canvas-subtle p-3">
                <Icon name="alert-circle" size="sm" tone="warning" />
                <Text variant="caption" weight="medium" className="flex-1">
                  {data.warning}
                </Text>
              </View>
            )}
            <Text variant="body" weight="semibold">
              Vì sao bạn muốn huỷ đơn?
            </Text>
            {data.reasons.map((r) => {
              const active = r.value === reason;
              return (
                <Pressable
                  key={r.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => setReason(r.value)}
                  className={cn(
                    'flex-row items-center gap-3 rounded-xl border p-3',
                    active ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                  )}
                >
                  <Icon name={active ? 'radio-button-on' : 'radio-button-off'} size="md" tone={active ? 'brand' : 'muted'} />
                  <Text variant="body" weight={active ? 'semibold' : 'regular'} className="flex-1">
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
            {needNote && (
              <Input
                placeholder="Cho ZomZom biết lý do (ít nhất 5 ký tự)"
                value={note}
                onChangeText={setNote}
                maxLength={300}
                multiline
              />
            )}
            {!!data.refundNotice && (
              <Text variant="caption" weight="regular" tone="secondary">
                {data.refundNotice}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
