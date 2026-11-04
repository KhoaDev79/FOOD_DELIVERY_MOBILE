import React from 'react';
import { Pressable, View } from 'react-native';
import { CartCheckResult } from '../../../api/cart';
import { cn, Icon, IconName, Text } from '../../ui';

/** Nhãn nút đặt hàng khi chưa đặt được (null = đặt được). Dùng chung cho Giỏ hàng và Thanh toán. */
export function checkoutBlockedLabel(check: CartCheckResult | undefined, blockingCount: number): string | null {
  if (!check) return null;
  if (check.restaurant.status !== 'OPEN') return 'Quán chưa nhận đơn';
  if (blockingCount > 0) return 'Xoá món không còn bán để tiếp tục';
  return null;
}

const RESTAURANT_ICON: Record<string, IconName> = {
  CLOSED: 'storefront-outline',
  PAUSED: 'pause-circle-outline',
  OUTSIDE_HOURS: 'time-outline',
  HOLIDAY: 'calendar-outline',
  INACTIVE: 'ban-outline',
};

/**
 * Các thẻ báo đầu giỏ hàng sau khi kiểm tra với máy chủ:
 * quán không nhận đơn (cam), món không còn bán (đỏ, nút xoá nhanh), giá thay đổi (vàng, nút cập nhật).
 */
export const CartCheckBanners: React.FC<{
  check?: CartCheckResult;
  blockingCount: number;
  priceChangeCount: number;
  onRemoveBlocked: () => void;
  onApplyPrices: () => void;
  /** Ở màn Thanh toán: thay nút xoá bằng nút quay lại giỏ */
  onOpenCart?: () => void;
}> = ({ check, blockingCount, priceChangeCount, onRemoveBlocked, onApplyPrices, onOpenCart }) => {
  if (!check) return null;
  const closed = check.restaurant.status !== 'OPEN';
  if (!closed && blockingCount === 0 && priceChangeCount === 0) return null;

  return (
    <View className="gap-2.5">
      {closed && (
        <Banner
          tone="accent"
          icon={RESTAURANT_ICON[check.restaurant.status] ?? 'storefront-outline'}
          title={check.restaurant.status === 'PAUSED' ? 'Quán đang tạm nghỉ' : 'Quán chưa nhận đơn lúc này'}
          message={check.restaurant.message ?? 'Bạn có thể giữ giỏ hàng và đặt lại khi quán mở cửa.'}
        />
      )}
      {blockingCount > 0 && (
        <Banner
          tone="danger"
          icon="alert-circle"
          title={`${blockingCount} món không còn bán`}
          message="Quán vừa báo hết hoặc ngừng bán. Xoá các món này để tiếp tục đặt hàng."
          actionLabel={onOpenCart ? 'Về giỏ hàng' : `Xoá ${blockingCount} món`}
          actionIcon={onOpenCart ? 'cart-outline' : 'trash-outline'}
          onAction={onOpenCart ?? onRemoveBlocked}
        />
      )}
      {priceChangeCount > 0 && (
        <Banner
          tone="warning"
          icon="pricetag"
          title={`Giá ${priceChangeCount} món đã thay đổi`}
          message="Quán vừa cập nhật giá. Tạm tính sẽ theo giá mới."
          actionLabel="Cập nhật giá"
          actionIcon="refresh"
          onAction={onApplyPrices}
        />
      )}
    </View>
  );
};

const TONES = {
  danger: { box: 'bg-danger-soft border-danger/20', circle: 'bg-surface', icon: 'danger', button: 'bg-danger' },
  warning: { box: 'bg-warning-soft border-warning/30', circle: 'bg-surface', icon: 'warning', button: 'bg-warning-strong' },
  accent: { box: 'bg-accent-50 border-accent-100', circle: 'bg-surface', icon: 'accent', button: 'bg-accent-600' },
} as const;

const Banner: React.FC<{
  tone: keyof typeof TONES;
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
}> = ({ tone, icon, title, message, actionLabel, actionIcon, onAction }) => {
  const t = TONES[tone];
  return (
    <View accessibilityLiveRegion="polite" className={cn('gap-3 rounded-2xl border p-3.5', t.box)}>
      <View className="flex-row items-start gap-3">
        <View className={cn('h-9 w-9 items-center justify-center rounded-full', t.circle)}>
          <Icon name={icon} size={18} tone={t.icon} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="bold">
            {title}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary">
            {message}
          </Text>
        </View>
      </View>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          className={cn('h-10 flex-row items-center justify-center gap-1.5 self-stretch rounded-full active:opacity-85', t.button)}
        >
          {actionIcon && <Icon name={actionIcon} size={16} tone="inverse" />}
          <Text variant="body" weight="bold" tone="inverse">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
};
