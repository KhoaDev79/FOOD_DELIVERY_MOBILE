import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { BottomSheet, Button, EmptyState, Input, Skeleton, Text } from '../../ui';
import { useAvailableVouchers } from '../../../services/useVouchers';
import { VoucherView } from '../../../types/api';
import { formatVND } from '../../../utils/format';
import { VoucherTicket } from './VoucherTicket';

export interface VoucherSelection {
  discountCode?: string;
  freeshipCode?: string;
}

const isFreeship = (v: VoucherView) => v.discountType === 'FREE_SHIP';

/**
 * Bảng chọn voucher ở màn Thanh toán: mỗi đơn chọn tối đa 1 mã giảm giá + 1 mã freeship.
 * Mã đủ điều kiện xếp trên (giảm nhiều nhất trước), mã chưa đủ hiện mờ kèm lý do. Có ô nhập mã thủ công.
 */
export const VoucherPickerSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
  subtotal: number;
  deliveryFee: number;
  value: VoucherSelection;
  onApply: (next: VoucherSelection) => void;
}> = ({ visible, onClose, restaurantId, subtotal, deliveryFee, value, onApply }) => {
  // Lựa chọn tạm trong bảng; mỗi lần mở bảng thì bắt đầu lại từ lựa chọn hiện tại (key ở nơi dùng)
  const [draft, setDraft] = useState<VoucherSelection>(value);
  const [typed, setTyped] = useState('');

  const { data, isLoading, isError, refetch } = useAvailableVouchers({ restaurantId, subtotal, deliveryFee }, visible);

  const { discounts, freeships } = useMemo(() => {
    const list = data ?? [];
    return { discounts: list.filter((v) => !isFreeship(v)), freeships: list.filter(isFreeship) };
  }, [data]);

  const toggle = (v: VoucherView) => {
    if (!v.eligible) return;
    setDraft((d) =>
      isFreeship(v)
        ? { ...d, freeshipCode: d.freeshipCode === v.code ? undefined : v.code }
        : { ...d, discountCode: d.discountCode === v.code ? undefined : v.code },
    );
  };

  const applyTyped = () => {
    const code = typed.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) return;
    const known = data?.find((v) => v.code === code);
    // Mã không có trong danh sách: gửi lên server xét, kết quả hiện ở màn Thanh toán
    onApply(known && isFreeship(known) ? { ...draft, freeshipCode: code } : { ...draft, discountCode: code });
    setTyped('');
    onClose();
  };

  const saving = [...discounts, ...freeships]
    .filter((v) => v.code === draft.discountCode || v.code === draft.freeshipCode)
    .reduce((s, v) => s + (v.estimatedSaving ?? 0), 0);

  const renderGroup = (title: string, list: VoucherView[], selectedCode?: string) =>
    list.length > 0 && (
      <View className="gap-2.5">
        <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
          {title}
        </Text>
        {list.map((v) => (
          <VoucherTicket
            key={v.id}
            voucher={v}
            selectable
            selected={selectedCode === v.code}
            disabled={!v.eligible}
            onPress={() => toggle(v)}
          />
        ))}
      </View>
    );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Chọn ưu đãi"
      footer={
        <View className="flex-row items-center gap-3 pb-2">
          <View className="flex-1">
            <Text variant="caption" weight="regular" tone="secondary">
              {saving > 0 ? 'Bạn tiết kiệm' : 'Chưa chọn mã'}
            </Text>
            {saving > 0 && (
              <Text variant="body-lg" weight="bold" tone="success">
                {formatVND(saving)}
              </Text>
            )}
          </View>
          <Button
            label="Áp dụng"
            size="md"
            className="flex-1"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </View>
      }
    >
      <View className="flex-row items-start gap-2 pb-3">
        <View className="flex-1">
          <Input
            placeholder="Nhập mã giảm giá"
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            leftIcon="pricetag-outline"
            returnKeyType="done"
            onSubmitEditing={applyTyped}
          />
        </View>
        <Button label="Dùng" size="md" variant="secondary" disabled={!typed.trim()} onPress={applyTyped} />
      </View>

      <ScrollView className="max-h-[440px]" contentContainerClassName="gap-4 pb-3">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Không tải được ưu đãi"
            actionLabel="Thử lại"
            onAction={() => refetch()}
          />
        ) : discounts.length + freeships.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            title="Chưa có ưu đãi cho đơn này"
            description="Bạn vẫn có thể nhập mã nếu có."
          />
        ) : (
          <>
            {renderGroup('Mã miễn phí vận chuyển', freeships, draft.freeshipCode)}
            {renderGroup('Mã giảm giá', discounts, draft.discountCode)}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
