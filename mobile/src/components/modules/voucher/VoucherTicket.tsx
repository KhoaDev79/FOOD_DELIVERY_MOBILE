import React from 'react';
import { Pressable, View } from 'react-native';
import { cn, Icon, IconName, IconTone, Text } from '../../ui';
import { VoucherType, VoucherView } from '../../../types/api';
import { formatVND } from '../../../utils/format';

/** "Giảm 20.000 ₫", "Giảm 10% tối đa 30.000 ₫", "Miễn phí giao hàng" */
export function voucherHeadline(v: Pick<VoucherView, 'discountType' | 'discountValue' | 'maxDiscountAmount'>): string {
  switch (v.discountType) {
    case 'PERCENTAGE':
      return `Giảm ${v.discountValue}%${v.maxDiscountAmount ? ` tối đa ${formatVND(v.maxDiscountAmount)}` : ''}`;
    case 'FREE_SHIP':
      return v.discountValue > 0 ? `Giảm phí ship tối đa ${formatVND(v.discountValue)}` : 'Miễn phí giao hàng';
    default:
      return `Giảm ${formatVND(v.discountValue)}`;
  }
}

/** Ngày hết hạn ngắn gọn: "Còn 3 giờ", "HSD 30/11" */
export function voucherExpiry(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return 'Đã hết hạn';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `Còn ${Math.max(1, hours)} giờ`;
  const d = new Date(endDate);
  return `HSD ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STUB: Record<VoucherType | 'PERSONAL', { box: string; icon: IconName; label: string }> = {
  FREE_SHIP: { box: 'bg-brand-500', icon: 'bicycle', label: 'FREESHIP' },
  FIXED_AMOUNT: { box: 'bg-accent-500', icon: 'pricetag', label: 'GIẢM GIÁ' },
  PERCENTAGE: { box: 'bg-accent-500', icon: 'pricetag', label: 'GIẢM %' },
  PERSONAL: { box: 'bg-violet-strong', icon: 'gift', label: 'TẶNG BẠN' },
};

/**
 * Thẻ voucher dạng "vé": cuống màu bên trái (loại mã), nội dung + điều kiện ở giữa, hành động bên phải.
 * Mã chưa đủ điều kiện hiện mờ kèm lý do (giống ShopeeFood / GrabFood).
 */
export const VoucherTicket: React.FC<{
  voucher: VoucherView;
  /** Hiện nút chọn tròn (màn Thanh toán) */
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Nội dung bên phải thay cho nút chọn (vd "Dùng ngay") */
  right?: React.ReactNode;
}> = ({ voucher: v, selectable, selected, disabled, onPress, right }) => {
  const stub = v.isPersonal ? STUB.PERSONAL : STUB[v.discountType];
  const muted = disabled || v.status === 'USED' || v.status === 'EXPIRED';
  const radioTone: IconTone = selected ? 'brand' : 'muted';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled: muted }}
      accessibilityLabel={`${v.title}. ${voucherHeadline(v)}`}
      disabled={!onPress || disabled}
      onPress={onPress}
      className={cn(
        'flex-row overflow-hidden rounded-2xl bg-surface shadow-card active:opacity-90',
        selected ? 'border-2 border-brand-500' : 'border border-line-subtle',
      )}
    >
      <View className={cn('w-20 items-center justify-center gap-1 py-3', stub.box, muted ? 'opacity-40' : '')}>
        <Icon name={stub.icon} size="lg" tone="inverse" />
        <Text variant="micro" weight="bold" tone="inverse" className="text-center">
          {stub.label}
        </Text>
      </View>
      {/* Răng cưa giữa cuống và thân vé */}
      <View className="w-0 justify-between py-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} className="-ml-1 h-2 w-2 rounded-full bg-canvas-subtle" />
        ))}
      </View>

      <View className={cn('flex-1 gap-1 px-3 py-2.5', muted ? 'opacity-50' : '')}>
        <Text variant="body" weight="bold" numberOfLines={2}>
          {voucherHeadline(v)}
        </Text>
        <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
          {v.minOrderAmount > 0 ? `Đơn tối thiểu ${formatVND(v.minOrderAmount)}` : 'Không yêu cầu đơn tối thiểu'}
          {v.restaurant ? ` · ${v.restaurant.name}` : ''}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text variant="micro" weight="semibold" tone="muted">
            {v.code}
          </Text>
          <Text variant="micro" weight="regular" tone={v.status === 'EXPIRED' ? 'danger' : 'muted'}>
            {v.status === 'USED' ? 'Đã dùng' : voucherExpiry(v.endDate)}
          </Text>
          {v.onlyNewCustomer && (
            <Text variant="micro" weight="semibold" tone="accent">
              Khách mới
            </Text>
          )}
          {v.remaining > 0 && v.remaining <= 20 && !v.isPersonal && (
            <Text variant="micro" weight="semibold" tone="danger">
              Sắp hết lượt
            </Text>
          )}
        </View>
        {!!v.reason && v.eligible === false && (
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="information-circle" size="xs" tone="warning" />
            <Text variant="micro" weight="medium" tone="warning" className="flex-1">
              {v.reason}
            </Text>
          </View>
        )}
        {v.status === 'USED' && !!v.savedAmount && (
          <Text variant="micro" weight="semibold" tone="success">
            Đã tiết kiệm {formatVND(v.savedAmount)}
          </Text>
        )}
      </View>

      <View className="items-center justify-center pr-3">
        {right ?? (selectable ? <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size="lg" tone={radioTone} /> : null)}
      </View>
    </Pressable>
  );
};
