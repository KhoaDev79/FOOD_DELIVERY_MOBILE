import React from 'react';
import { View } from 'react-native';
import { OrderStatus } from '../../types/api';
import { ORDER_STATUS_CONFIG } from '../../utils/orderStatus';
import { cn } from './cn';
import { Icon, IconName, IconTone } from './Icon';
import { Text, TextTone } from './Text';

export type BadgeTone = 'discount' | 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'scrim';

const BOX: Record<BadgeTone, string> = {
  discount: 'bg-accent-500',
  brand: 'bg-brand-500',
  neutral: 'bg-canvas-subtle',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  scrim: 'bg-scrim',
};
const LABEL: Record<BadgeTone, TextTone> = {
  discount: 'inverse',
  brand: 'inverse',
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  scrim: 'inverse',
};
const ICON: Record<BadgeTone, IconTone> = {
  discount: 'inverse',
  brand: 'inverse',
  neutral: 'secondary',
  success: 'success',
  warning: 'accent',
  danger: 'danger',
  scrim: 'rating',
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral', icon, className }) => (
  <View className={cn('flex-row items-center gap-1 self-start rounded-sm px-2 py-0.5', BOX[tone], className)}>
    {icon && <Icon name={icon} size="xs" tone={ICON[tone]} />}
    <Text variant="caption" weight="semibold" tone={LABEL[tone]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Huy hiệu số: không hiển thị gì khi count <= 0 (không có số giả). */
export const CountBadge: React.FC<{ count: number; className?: string }> = ({ count, className }) => {
  if (!count || count <= 0) return null;
  return (
    <View
      accessibilityLabel={`${count} mục`}
      className={cn('h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface bg-danger px-1', className)}
    >
      <Text variant="micro" tone="inverse">
        {count > 99 ? '99+' : String(count)}
      </Text>
    </View>
  );
};

// Bảng màu duy nhất cho trạng thái đơn; nhãn lấy từ ORDER_STATUS_CONFIG (một bảng nhãn duy nhất).
const STATUS_CLASS: Record<OrderStatus, { box: string; text: string }> = {
  PENDING: { box: 'bg-warning-soft', text: 'text-warning-strong' },
  CONFIRMED: { box: 'bg-info-soft', text: 'text-info-strong' },
  PREPARING: { box: 'bg-violet-soft', text: 'text-violet-strong' },
  READY_FOR_PICKUP: { box: 'bg-brand-100', text: 'text-brand-800' },
  PICKED_UP: { box: 'bg-brand-50', text: 'text-brand-700' },
  DELIVERED: { box: 'bg-success-soft', text: 'text-success-strong' },
  CANCELLED: { box: 'bg-danger-soft', text: 'text-danger-strong' },
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus; className?: string }> = ({ status, className }) => {
  const cls = STATUS_CLASS[status];
  return (
    <View className={cn('self-start rounded-full px-2.5 py-1', cls.box, className)}>
      <Text variant="caption" weight="semibold" className={cls.text} numberOfLines={1}>
        {ORDER_STATUS_CONFIG[status].label}
      </Text>
    </View>
  );
};
