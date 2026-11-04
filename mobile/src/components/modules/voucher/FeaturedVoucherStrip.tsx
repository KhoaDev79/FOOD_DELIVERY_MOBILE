import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, Text } from '../../ui';
import { useFeaturedVouchers } from '../../../services/useVouchers';
import { formatVND } from '../../../utils/format';
import { voucherHeadline } from './VoucherTicket';

/**
 * Dải "Ưu đãi hôm nay" ở trang chủ: các mã toàn sàn còn hạn, còn lượt.
 * Không có mã nào thì ẩn hẳn (không chiếm chỗ).
 */
export const FeaturedVoucherStrip: React.FC<{ onOpenWallet: () => void }> = ({ onOpenWallet }) => {
  const { data } = useFeaturedVouchers();
  if (!data?.length) return null;

  return (
    <View className="gap-2.5 pt-4">
      <View className="flex-row items-center justify-between px-4">
        <View className="flex-row items-center gap-1.5">
          <Icon name="pricetags" size="sm" tone="accent" />
          <Text variant="headline" weight="bold">
            Ưu đãi hôm nay
          </Text>
        </View>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onOpenWallet} className="flex-row items-center gap-0.5">
          <Text variant="caption" weight="semibold" tone="brand">
            Ví voucher
          </Text>
          <Icon name="chevron-forward" size="xs" tone="brand" />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 px-4 pb-1">
        {data.map((v) => {
          const ship = v.discountType === 'FREE_SHIP';
          return (
            <Pressable
              key={v.id}
              accessibilityRole="button"
              accessibilityLabel={`${voucherHeadline(v)}, mã ${v.code}`}
              onPress={onOpenWallet}
              className={`w-52 flex-row items-center gap-2.5 rounded-2xl border border-dashed p-3 active:opacity-80 ${
                ship ? 'border-brand-300 bg-brand-50' : 'border-accent-500/40 bg-accent-50'
              }`}
            >
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${ship ? 'bg-brand-500' : 'bg-accent-500'}`}
              >
                <Icon name={ship ? 'bicycle' : 'pricetag'} size="md" tone="inverse" />
              </View>
              <View className="flex-1">
                <Text variant="caption" weight="bold" numberOfLines={2}>
                  {voucherHeadline(v)}
                </Text>
                <Text variant="micro" weight="regular" tone="secondary" numberOfLines={1}>
                  {v.minOrderAmount > 0 ? `Đơn từ ${formatVND(v.minOrderAmount)}` : 'Mọi đơn hàng'} · {v.code}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};
