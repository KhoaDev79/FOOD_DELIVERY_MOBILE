import React from 'react';
import { Pressable, View } from 'react-native';
import { cn, Icon, IconName, IconTone, Text } from '../../ui';
import { OrderStatus } from '../../../types/api';
import { formatDateTime, formatVND } from '../../../utils/format';

/**
 * Bộ khối giao diện dùng chung cho các màn đối tác (tài xế và chủ quán), để thẻ, tiến trình,
 * lộ trình, tab và số tiền trông giống nhau ở mọi màn.
 */

// ---------------- Tiến trình chuyến ----------------

export const TRIP_STEPS = ['Đã nhận', 'Đang nấu', 'Sẵn sàng', 'Đang giao', 'Đã giao'];

export function tripStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'CONFIRMED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY_FOR_PICKUP':
      return 2;
    case 'PICKED_UP':
      return 3;
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
}

/** Thanh 5 bước. compact: chấm nhỏ hơn cho thẻ trong danh sách. */
export const TripStepper: React.FC<{ status: OrderStatus; compact?: boolean }> = ({ status, compact }) => {
  const current = tripStepIndex(status);
  const dot = compact ? 'h-5 w-5' : 'h-7 w-7';
  const lineTop = compact ? 'top-[9px]' : 'top-[13px]';

  return (
    <View className="flex-row">
      {TRIP_STEPS.map((label, idx) => {
        const isDone = idx < current;
        const isCurrent = idx === current;
        const reached = isDone || isCurrent;
        return (
          <View key={label} className="flex-1 items-center">
            <View className="w-full items-center">
              {idx > 0 && (
                <View
                  className={cn('absolute left-0 right-1/2 h-0.5', lineTop, reached ? 'bg-brand-500' : 'bg-line')}
                />
              )}
              {idx < TRIP_STEPS.length - 1 && (
                <View
                  className={cn('absolute left-1/2 right-0 h-0.5', lineTop, isDone ? 'bg-brand-500' : 'bg-line')}
                />
              )}
              <View
                className={cn(
                  'items-center justify-center rounded-full border-2',
                  dot,
                  reached ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
                  isCurrent ? 'shadow-glow' : 'shadow-none',
                )}
              >
                {isDone ? (
                  <Icon name="checkmark" size={compact ? 11 : 14} tone="inverse" />
                ) : (
                  <View className={cn('rounded-full', compact ? 'h-1.5 w-1.5' : 'h-2 w-2', reached ? 'bg-surface' : 'bg-line')} />
                )}
              </View>
            </View>
            <Text
              variant="micro"
              weight={isCurrent ? 'bold' : 'medium'}
              tone={isCurrent ? 'brand' : isDone ? 'default' : 'muted'}
              className="mt-1.5 text-center"
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ---------------- Thẻ & tiêu đề khối ----------------

export const SectionCard: React.FC<{
  title?: string;
  icon?: IconName;
  iconTone?: IconTone;
  iconBox?: string;
  right?: React.ReactNode;
  /** Màu nền thẻ (cn không gộp lớp trùng nên truyền riêng thay vì qua className). */
  surfaceClassName?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({
  title,
  icon,
  iconTone = 'brand',
  iconBox = 'bg-brand-50',
  right,
  surfaceClassName = 'bg-surface',
  className,
  children,
}) => (
  <View className={cn('gap-3 rounded-2xl p-4 shadow-card', surfaceClassName, className)}>
    {(title || right) && (
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2.5">
          {icon && (
            <View className={cn('h-8 w-8 items-center justify-center rounded-full', iconBox)}>
              <Icon name={icon} size="sm" tone={iconTone} />
            </View>
          )}
          {!!title && (
            <Text variant="headline" weight="bold" className="flex-1" numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>
        {right}
      </View>
    )}
    {children}
  </View>
);

// ---------------- Nút tròn gọi / nhắn ----------------

type ActionTone = 'brand' | 'danger' | 'neutral';

const ACTION_BOX: Record<ActionTone, string> = {
  brand: 'bg-brand-50 active:bg-brand-100',
  danger: 'bg-danger-soft active:opacity-70',
  neutral: 'bg-canvas-subtle active:bg-line',
};
const ACTION_ICON: Record<ActionTone, IconTone> = {
  brand: 'brand',
  danger: 'danger',
  neutral: 'secondary',
};

export const RoundAction: React.FC<{
  icon: IconName;
  label: string;
  tone?: ActionTone;
  onPress: () => void;
}> = ({ icon, label, tone = 'brand', onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    hitSlop={4}
    onPress={(e) => {
      // Nút nằm trong thẻ bấm được: không mở luôn thẻ
      e?.stopPropagation?.();
      onPress();
    }}
    className={cn('h-10 w-10 items-center justify-center rounded-full', ACTION_BOX[tone])}
  >
    <Icon name={icon} size={18} tone={ACTION_ICON[tone]} />
  </Pressable>
);

// ---------------- Lộ trình 2 điểm: quán → khách ----------------

export interface RouteStop {
  label: string;
  title: string;
  /** Dòng phụ ngay dưới tên (vd: số điện thoại). */
  meta?: string | null;
  address?: string | null;
  addressLines?: number;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

const StopIcon: React.FC<{ kind: 'pickup' | 'dropoff'; compact?: boolean }> = ({ kind, compact }) => (
  <View
    className={cn(
      'items-center justify-center rounded-full',
      compact ? 'h-7 w-7' : 'h-9 w-9',
      kind === 'pickup' ? 'bg-danger-soft' : 'bg-brand-50',
    )}
  >
    <Icon name={kind === 'pickup' ? 'storefront' : 'location'} size={compact ? 14 : 17} tone={kind === 'pickup' ? 'danger' : 'brand'} />
  </View>
);

/** Nút gọi/nhắn đứng cạnh tên; địa chỉ nằm dưới, dùng hết chiều ngang nên không bị ép dòng. */
const StopBody: React.FC<{ stop: RouteStop; compact?: boolean; className?: string }> = ({
  stop,
  compact,
  className,
}) => (
  <View className={cn('flex-1 gap-1', className)}>
    <View className="flex-row items-center gap-2">
      <View className="flex-1 gap-0.5">
        <Text variant="micro" tone="muted">
          {stop.label}
        </Text>
        <Text variant={compact ? 'body' : 'body-lg'} weight="bold" numberOfLines={1}>
          {stop.title}
        </Text>
        {!!stop.meta && (
          <Text variant="caption" tone="secondary" selectable>
            {stop.meta}
          </Text>
        )}
      </View>
      {stop.actions && <View className="flex-row gap-2">{stop.actions}</View>}
    </View>
    {!!stop.address && (
      <Text variant="caption" weight="regular" tone="secondary" numberOfLines={stop.addressLines}>
        {stop.address}
      </Text>
    )}
    {stop.footer}
  </View>
);

export const RouteStops: React.FC<{ pickup: RouteStop; dropoff: RouteStop; compact?: boolean }> = ({
  pickup,
  dropoff,
  compact,
}) => (
  <View>
    <View className="flex-row gap-3">
      {/* Cột icon: đường nối kéo dài hết chiều cao điểm lấy món */}
      <View className="items-center">
        <StopIcon kind="pickup" compact={compact} />
        <View className="my-1 w-[3px] flex-1 rounded-full bg-brand-200" />
      </View>
      <StopBody stop={pickup} compact={compact} className={compact ? 'pb-3' : 'pb-5'} />
    </View>
    <View className="flex-row gap-3">
      <StopIcon kind="dropoff" compact={compact} />
      <StopBody stop={dropoff} compact={compact} />
    </View>
  </View>
);

// ---------------- Số tiền: ký hiệu ₫ nhỏ hơn con số ----------------

export const Money: React.FC<{
  amount?: number | null;
  sign?: '+' | '';
  variant?: 'display' | 'title' | 'headline' | 'body-lg' | 'body';
  tone?: 'default' | 'brand' | 'danger' | 'success' | 'muted' | 'secondary';
  className?: string;
}> = ({ amount, sign = '', variant = 'body-lg', tone = 'default', className }) => {
  const num = formatVND(amount).replace('₫', '').trim();
  return (
    <Text variant={variant} weight="bold" tone={tone} className={className} numberOfLines={1}>
      {sign}
      {num}
      <Text variant={variant === 'display' || variant === 'title' ? 'body-lg' : 'caption'} weight="bold" tone={tone}>
        {' ₫'}
      </Text>
    </Text>
  );
};

// ---------------- Chip số liệu nhỏ ----------------

type ChipTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const CHIP_BOX: Record<ChipTone, string> = {
  brand: 'bg-brand-50',
  neutral: 'bg-canvas-subtle',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  accent: 'bg-accent-50',
};
const CHIP_TEXT: Record<ChipTone, 'brand' | 'secondary' | 'success' | 'warning' | 'danger' | 'accent'> = {
  brand: 'brand',
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  accent: 'accent',
};
const CHIP_ICON: Record<ChipTone, IconTone> = {
  brand: 'brand',
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  accent: 'accent',
};

export const MetricChip: React.FC<{ icon?: IconName; label: string; tone?: ChipTone }> = ({
  icon,
  label,
  tone = 'neutral',
}) => (
  <View className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', CHIP_BOX[tone])}>
    {icon && <Icon name={icon} size={13} tone={CHIP_ICON[tone]} />}
    <Text variant="micro" weight="semibold" tone={CHIP_TEXT[tone]} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

// ---------------- Tab phân đoạn (giống thanh chọn kỳ ở Hồ sơ) ----------------

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  trackClassName = 'bg-canvas-subtle',
  className,
}: {
  items: { key: T; label: string; icon?: IconName; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  /** Màu nền rãnh; đặt bg-line khi tab nằm trực tiếp trên nền canvas-subtle. */
  trackClassName?: string;
  className?: string;
}) {
  return (
    <View accessibilityRole="tablist" className={cn('flex-row rounded-full p-1', trackClassName, className)}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(it.key)}
            className={cn(
              'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full',
              // Luôn có lớp shadow từ lần render đầu để NativeWind không phải remount khi đổi tab
              selected ? 'bg-surface shadow-card' : 'shadow-none',
            )}
          >
            {it.icon && <Icon name={it.icon} size="sm" tone={selected ? 'brand' : 'muted'} />}
            <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'secondary'} numberOfLines={1}>
              {it.label}
            </Text>
            {typeof it.count === 'number' && (
              <View className={cn('min-w-[20px] items-center rounded-full px-1.5', selected ? 'bg-brand-500' : 'bg-line')}>
                <Text variant="micro" weight="bold" tone={selected ? 'inverse' : 'secondary'}>
                  {it.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------- Thông báo dạng thẻ ----------------

type NoticeTone = 'warning' | 'danger' | 'brand' | 'success';

const NOTICE_BOX: Record<NoticeTone, string> = {
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  brand: 'bg-brand-50',
  success: 'bg-success-soft',
};

export const NoticeCard: React.FC<{
  tone: NoticeTone;
  icon: IconName;
  title: string;
  message?: string | null;
  actionLabel?: string;
  onPress?: () => void;
  className?: string;
}> = ({ tone, icon, title, message, actionLabel, onPress, className }) => {
  const content = (
    <>
      <Icon name={icon} size="md" tone={tone} />
      <View className="flex-1 gap-0.5">
        <Text variant="caption" weight="bold" tone={tone}>
          {title}
        </Text>
        {!!message && (
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={3}>
            {message}
          </Text>
        )}
      </View>
      {!!actionLabel && (
        <View className="flex-row items-center gap-0.5 rounded-full bg-surface px-3 py-1.5">
          <Text variant="caption" weight="bold" tone="brand">
            {actionLabel}
          </Text>
          <Icon name="chevron-forward" size={12} tone="brand" />
        </View>
      )}
    </>
  );
  const box = cn('flex-row items-center gap-3 rounded-2xl p-3.5', NOTICE_BOX[tone], className);
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} className={cn(box, 'active:opacity-80')}>
      {content}
    </Pressable>
  ) : (
    <View className={box}>{content}</View>
  );
};

// ---------------- Thời gian tương đối ----------------

/** "Vừa xong", "5 phút trước", "2 giờ trước"; quá 1 ngày thì hiện ngày giờ đầy đủ. */
export function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} giờ trước`;
  return formatDateTime(iso);
}

export const orderCode = (id: string) => id.slice(0, 8).toUpperCase();

/** "Hôm nay", "Hôm qua" hoặc dd/mm/yyyy. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hôm nay';
  if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** "05:51" */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
