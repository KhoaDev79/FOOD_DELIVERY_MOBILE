import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { AppImage, Avatar, cn, Icon, IconName, IconTone, Skeleton, Text } from '../../ui';
import { OrderStatus, Role } from '../../../types/api';
import { StepHealth } from '../../../utils/adminOrder';

/**
 * Bộ khối giao diện cho khu vực quản trị: KPI có xu hướng, biểu đồ cột/thanh vẽ bằng View,
 * khối "Cần xử lý", dòng thời gian đơn, thẻ 3 bên (quán/khách/tài xế), khung chờ đúng hình
 * và tiện ích bố cục màn rộng (Expo web). Thẻ theo kiểu PartnerKit: rounded-2xl bg-surface shadow-card.
 */

// ---------------- Màn hình rộng ----------------

/** Ngưỡng chuyển sang bố cục máy tính (KPI 4 cột, danh sách + chi tiết cạnh nhau). */
export const WIDE_BREAKPOINT = 900;

export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

/** Giới hạn chiều rộng nội dung ~1200px và canh giữa trên màn rộng. */
export const ContentWidth: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <View className={cn('w-full max-w-[1200px] self-center', className)}>{children}</View>
);

// ---------------- Chip xu hướng ----------------

/**
 * ▲ xanh lá khi tăng, ▼ đỏ khi giảm. `inverse`: chỉ số mà giảm là tốt (tỉ lệ huỷ) → đảo màu.
 * `unit = 'pt'`: chênh lệch điểm phần trăm (dùng cho các chỉ số dạng tỉ lệ).
 */
export const TrendChip: React.FC<{
  changePct: number | null | undefined;
  inverse?: boolean;
  unit?: '%' | 'pt';
  onDark?: boolean;
  className?: string;
}> = ({ changePct, inverse, unit = '%', onDark, className }) => {
  // Không có kỳ trước để so sánh: ẩn hẳn thay vì lặp chữ "Chưa có kỳ trước" ở mọi ô
  if (changePct === null || changePct === undefined) return null;
  const up = changePct > 0;
  const flat = changePct === 0;
  const good = flat ? null : inverse ? !up : up;
  const box = onDark
    ? 'bg-surface/20'
    : good === null
      ? 'bg-canvas-subtle'
      : good
        ? 'bg-success-soft'
        : 'bg-danger-soft';
  const tone = onDark ? 'inverse' : good === null ? 'secondary' : good ? 'success' : 'danger';
  const abs = Math.abs(changePct).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const label = `${flat ? '' : up ? '▲ ' : '▼ '}${abs}${unit === 'pt' ? ' điểm' : '%'}`;
  return (
    <View
      accessibilityLabel={`${flat ? 'Không đổi' : up ? 'Tăng' : 'Giảm'} ${abs}${unit === 'pt' ? ' điểm phần trăm' : ' phần trăm'} so với kỳ trước`}
      className={cn('self-start rounded-full px-2 py-0.5', box, className)}
    >
      <Text variant="micro" weight="bold" tone={tone}>
        {label}
      </Text>
    </View>
  );
};

// ---------------- Thẻ KPI ----------------

export const KpiCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: IconName;
  iconTone?: IconTone;
  iconBox?: string;
  changePct?: number | null;
  inverse?: boolean;
  unit?: '%' | 'pt';
  caption?: string;
  onPress?: () => void;
  /** Bề rộng thẻ trong lưới: mặc định 2 cột (điện thoại); 4 cột trên màn rộng. */
  wide?: boolean;
}> = ({ label, value, icon, iconTone = 'brand', iconBox = 'bg-brand-50', changePct, inverse, unit, caption, onPress, wide }) => (
  <Pressable
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={`${label}${typeof value === 'string' ? `: ${value}` : ''}`}
    disabled={!onPress}
    onPress={onPress}
    className={cn(
      'min-w-36 flex-1 gap-2 rounded-2xl bg-surface p-4 shadow-card active:opacity-90',
      wide ? 'basis-[22%]' : 'basis-[45%]',
    )}
  >
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
        {label}
      </Text>
      <View className={cn('h-8 w-8 items-center justify-center rounded-full', iconBox)}>
        <Icon name={icon} size="sm" tone={iconTone} />
      </View>
    </View>
    {typeof value === 'string' ? (
      <Text variant="title" weight="bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    ) : (
      value
    )}
    <View className="min-h-[18px] flex-row flex-wrap items-center gap-1.5">
      {changePct !== undefined && <TrendChip changePct={changePct} inverse={inverse} unit={unit} />}
      {!!caption && (
        <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
          {caption}
        </Text>
      )}
    </View>
  </Pressable>
);

export const KpiSkeleton: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <View className={cn('min-w-36 flex-1 gap-3 rounded-2xl bg-surface p-4 shadow-card', wide ? 'basis-[22%]' : 'basis-[45%]')}>
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-6 w-1/2" />
    <Skeleton className="h-4 w-1/3 rounded-full" />
  </View>
);

// ---------------- Biểu đồ cột ----------------

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Cột nổi bật (vd hôm nay / giờ hiện tại): màu đậm hơn. */
  highlight?: boolean;
}

/** Chọn vài mốc nhãn trục X cho thoáng: theo giờ thì 0h · 6h · 12h · 18h · 23h, theo ngày thì thưa dần. */
function axisIndices(n: number): number[] {
  if (n <= 8) return Array.from({ length: n }, (_, i) => i);
  if (n === 24) return [0, 6, 12, 18, 23];
  const step = Math.ceil(n / 5);
  const idx = Array.from({ length: Math.ceil(n / step) }, (_, i) => i * step).filter((i) => n - 1 - i >= step / 2);
  return [...idx, n - 1];
}

const AXIS_LABEL_W = 44;

/**
 * Biểu đồ cột vẽ bằng View (không cần thư viện). Chạm vào cột để xem số liệu ở dòng trên biểu đồ.
 * Nhãn trục X đặt theo vị trí đo được nên không bị cắt chữ; không có dữ liệu thì chỉ hiện một dòng.
 */
export const BarChart: React.FC<{
  data: BarDatum[];
  height?: number;
  formatValue: (v: number, d: BarDatum) => string;
  /** Dòng mô tả mặc định khi chưa chọn cột. */
  hint?: string;
  /** Có giá trị: khi mọi cột bằng 0 thì thay biểu đồ bằng một dòng thông báo. */
  emptyText?: string;
  onDark?: boolean;
}> = ({ data, height = 120, formatValue, hint = 'Chạm vào cột để xem số liệu', emptyText, onDark }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const max = Math.max(0, ...data.map((d) => d.value));
  const picked = data.find((d) => d.key === selected);

  if (max === 0 && emptyText) {
    return (
      <View className={cn('flex-row items-center gap-2 rounded-xl px-3 py-3', onDark ? 'bg-surface/10' : 'bg-canvas-subtle')}>
        <Icon name="bar-chart-outline" size="sm" tone={onDark ? 'inverse' : 'muted'} />
        <Text variant="caption" weight="medium" tone={onDark ? 'inverse' : 'muted'} className="flex-1">
          {emptyText}
        </Text>
      </View>
    );
  }

  const n = data.length || 1;
  return (
    <View className="gap-2">
      <Text
        variant="caption"
        weight={picked ? 'bold' : 'regular'}
        tone={onDark ? 'inverse' : picked ? 'default' : 'muted'}
        numberOfLines={1}
      >
        {picked ? `${picked.label} · ${formatValue(picked.value, picked)}` : hint}
      </Text>
      <View className="flex-row items-end gap-[3px]" style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {data.map((d) => {
          const isSel = d.key === selected;
          const pct = d.value > 0 ? Math.max(4, (d.value / Math.max(1, max)) * 100) : 0;
          const bar = onDark
            ? isSel
              ? 'bg-surface'
              : d.highlight
                ? 'bg-surface/90'
                : 'bg-surface/45'
            : isSel
              ? 'bg-brand-800'
              : d.highlight
                ? 'bg-brand-600'
                : 'bg-brand-300';
          return (
            <Pressable
              key={d.key}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${formatValue(d.value, d)}`}
              onPress={() => setSelected(isSel ? null : d.key)}
              className="h-full flex-1 justify-end"
            >
              <View
                className={cn('w-full rounded-t-md', pct === 0 ? (onDark ? 'bg-surface/20' : 'bg-line-subtle') : bar)}
                style={{ height: pct === 0 ? 2 : `${pct}%` }}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="h-4">
        {width > 0 &&
          axisIndices(data.length).map((i) => {
            const center = ((i + 0.5) * width) / n;
            const left = Math.min(Math.max(0, center - AXIS_LABEL_W / 2), width - AXIS_LABEL_W);
            return (
              <View key={data[i].key} className="absolute top-0 items-center" style={{ left, width: AXIS_LABEL_W }}>
                <Text variant="micro" weight="medium" tone={onDark ? 'inverse' : 'muted'} numberOfLines={1}>
                  {data[i].label}
                </Text>
              </View>
            );
          })}
      </View>
    </View>
  );
};

// ---------------- Biểu đồ thanh ngang ----------------

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  valueLabel?: string;
  /** Lớp màu thanh, mặc định bg-brand-400. */
  barClassName?: string;
  leading?: React.ReactNode;
  onPress?: () => void;
}

export const HBarChart: React.FC<{ items: HBarItem[]; emptyText?: string }> = ({ items, emptyText = 'Chưa có dữ liệu' }) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) {
    return (
      <Text variant="caption" weight="regular" tone="muted" className="py-2">
        {emptyText}
      </Text>
    );
  }
  return (
    <View className="gap-3">
      {items.map((it) => {
        const body = (
          <View className="flex-row items-center gap-3">
            {it.leading}
            <View className="flex-1 gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="caption" weight="medium" numberOfLines={1} className="flex-1">
                  {it.label}
                </Text>
                <Text variant="caption" weight="bold">
                  {it.valueLabel ?? it.value}
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-canvas-subtle">
                <View className={cn('h-full rounded-full', it.barClassName ?? 'bg-brand-400')} style={{ width: `${(it.value / max) * 100}%` }} />
              </View>
            </View>
          </View>
        );
        return it.onPress ? (
          <Pressable key={it.key} accessibilityRole="button" onPress={it.onPress} className="active:opacity-80">
            {body}
          </Pressable>
        ) : (
          <View key={it.key}>{body}</View>
        );
      })}
    </View>
  );
};

// ---------------- Khối "Cần xử lý" ----------------

export interface AttentionItem {
  key: string;
  tone: 'danger' | 'warning';
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

/** Danh sách việc cần xử lý, xếp theo mức khẩn (đỏ trước cam). Không có việc thì ẩn hẳn. */
export const AttentionList: React.FC<{ items: AttentionItem[]; className?: string }> = ({ items, className }) => {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1));
  const urgent = sorted.some((i) => i.tone === 'danger');
  return (
    <View className={cn('overflow-hidden rounded-2xl bg-surface shadow-card', className)}>
      <View className={cn('flex-row items-center gap-2 px-4 py-3', urgent ? 'bg-danger-soft' : 'bg-warning-soft')}>
        <View className={cn('h-2.5 w-2.5 rounded-full', urgent ? 'bg-danger' : 'bg-warning')} />
        <Text variant="caption" weight="bold" tone={urgent ? 'danger' : 'warning'} className="flex-1 uppercase">
          Cần xử lý
        </Text>
        <Text variant="caption" weight="bold" tone={urgent ? 'danger' : 'warning'}>
          {items.length} việc
        </Text>
      </View>
      {sorted.map((it, idx) => (
        <Pressable
          key={it.key}
          accessibilityRole={it.onPress ? 'button' : undefined}
          accessibilityLabel={`${it.title}${it.subtitle ? `. ${it.subtitle}` : ''}`}
          disabled={!it.onPress}
          onPress={it.onPress}
          className={cn('min-h-touch flex-row items-center gap-3 px-4 py-3 active:bg-canvas-subtle', idx > 0 && 'border-t border-line-subtle')}
        >
          <View className={cn('h-9 w-9 items-center justify-center rounded-full', it.tone === 'danger' ? 'bg-danger-soft' : 'bg-warning-soft')}>
            <Icon name={it.icon} size="sm" tone={it.tone === 'danger' ? 'danger' : 'accent'} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight="semibold" numberOfLines={2}>
              {it.title}
            </Text>
            {!!it.subtitle && (
              <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
                {it.subtitle}
              </Text>
            )}
          </View>
          {it.onPress && <Icon name="chevron-forward" size="sm" tone="muted" />}
        </Pressable>
      ))}
    </View>
  );
};

// ---------------- Dòng thời gian trạng thái đơn ----------------

export const STEP_ICON: Record<OrderStatus, IconName> = {
  PENDING: 'time-outline',
  CONFIRMED: 'checkmark-circle-outline',
  PREPARING: 'flame-outline',
  READY_FOR_PICKUP: 'bag-check-outline',
  PICKED_UP: 'bicycle-outline',
  DELIVERED: 'checkmark-done-circle',
  DELIVERY_FAILED: 'alert-circle',
  CANCELLED: 'close-circle',
};

export interface TimelineStep {
  key: string;
  status: OrderStatus;
  title: string;
  actor: string;
  time: string;
  /** "+12 phút" so với bước trước. */
  delta?: string;
  /** Sức khoẻ của khoảng thời gian dẫn tới bước này (quá chuẩn tô cam/đỏ). */
  health?: StepHealth;
  note?: string | null;
  current?: boolean;
}

const HEALTH_TEXT: Record<StepHealth, 'muted' | 'warning' | 'danger'> = { ok: 'muted', slow: 'warning', late: 'danger' };

export const Timeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => (
  <View>
    {steps.map((s, idx) => {
      const bad = s.status === 'CANCELLED' || s.status === 'DELIVERY_FAILED';
      const done = s.status === 'DELIVERED';
      const dotBox = bad ? 'bg-danger-soft' : done ? 'bg-success-soft' : s.current ? 'bg-brand-500' : 'bg-brand-50';
      const dotTone: IconTone = bad ? 'danger' : done ? 'success' : s.current ? 'inverse' : 'brand';
      const last = idx === steps.length - 1;
      return (
        <View key={s.key} className="flex-row gap-3">
          <View className="items-center">
            <View className={cn('h-8 w-8 items-center justify-center rounded-full', dotBox)}>
              <Icon name={STEP_ICON[s.status]} size="sm" tone={dotTone} />
            </View>
            {!last && <View className="my-1 w-0.5 flex-1 rounded-full bg-line" />}
          </View>
          <View className={cn('flex-1 gap-0.5', last ? 'pb-0' : 'pb-4')}>
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="body" weight="bold" tone={bad ? 'danger' : 'default'} className="flex-1" numberOfLines={1}>
                {s.title}
              </Text>
              <Text variant="caption" weight="medium" tone="secondary">
                {s.time}
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-x-2">
              <Text variant="caption" weight="regular" tone="secondary">
                {s.actor}
              </Text>
              {!!s.delta && (
                <Text variant="caption" weight={s.health && s.health !== 'ok' ? 'bold' : 'regular'} tone={HEALTH_TEXT[s.health ?? 'ok']}>
                  {s.delta}
                  {s.health === 'late' ? ' · quá chậm' : s.health === 'slow' ? ' · chậm' : ''}
                </Text>
              )}
            </View>
            {!!s.note && (
              <Text variant="caption" weight="regular" tone="secondary">
                Ghi chú: {s.note}
              </Text>
            )}
          </View>
        </View>
      );
    })}
  </View>
);

// ---------------- Thẻ một bên của đơn (Quán / Khách / Tài xế) ----------------

export type PartyKind = 'restaurant' | 'customer' | 'driver';

const PARTY_META: Record<PartyKind, { label: string; icon: IconName; box: string; tone: IconTone }> = {
  restaurant: { label: 'Quán', icon: 'storefront', box: 'bg-accent-50', tone: 'accent' },
  customer: { label: 'Khách hàng', icon: 'person', box: 'bg-brand-50', tone: 'brand' },
  driver: { label: 'Tài xế', icon: 'bicycle', box: 'bg-success-soft', tone: 'success' },
};

export const PartyCard: React.FC<{
  kind: PartyKind;
  name?: string | null;
  imageUri?: string | null;
  phone?: string | null;
  lines?: (string | null | undefined)[];
  emptyText?: string;
}> = ({ kind, name, imageUri, phone, lines = [], emptyText = 'Chưa có' }) => {
  const meta = PARTY_META[kind];
  return (
    <View className="min-w-48 flex-1 gap-2 rounded-2xl border border-line-subtle bg-surface p-3">
      <View className="flex-row items-center gap-2.5">
        {kind === 'restaurant' && imageUri ? (
          <AppImage uri={imageUri} className="h-10 w-10 rounded-full" />
        ) : name && kind !== 'restaurant' ? (
          <Avatar uri={imageUri} name={name} size="md" />
        ) : (
          <View className={cn('h-10 w-10 items-center justify-center rounded-full', meta.box)}>
            <Icon name={meta.icon} size="md" tone={meta.tone} />
          </View>
        )}
        <View className="flex-1">
          <Text variant="micro" tone="muted">
            {meta.label}
          </Text>
          <Text variant="body" weight="bold" numberOfLines={1}>
            {name || emptyText}
          </Text>
        </View>
        {!!phone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${meta.label.toLowerCase()} ${name ?? ''}`}
            hitSlop={4}
            onPress={() => void Linking.openURL(`tel:${phone}`)}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-50 active:bg-brand-100"
          >
            <Icon name="call" size="sm" tone="brand" />
          </Pressable>
        )}
      </View>
      {!!phone && (
        <Text variant="caption" weight="medium" tone="secondary" selectable>
          {phone}
        </Text>
      )}
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i} variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
          {l}
        </Text>
      ))}
    </View>
  );
};

// ---------------- Thanh tab gạch chân có số đếm ----------------

/**
 * Tab kiểu trang quản trị (Shopify / Grab Merchant): chữ + số đếm, gạch chân màu thương hiệu,
 * cuộn ngang khi nhiều tab nên không bị cắt chữ. `tone`: số đếm tô đỏ/cam khi có việc cần xử lý.
 */
export function TabStrip<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string; count?: number; tone?: 'danger' | 'warning' }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="border-b border-line-subtle bg-surface">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-2">
        <View accessibilityRole="tablist" className="flex-row">
          {items.map((it) => {
            const on = it.key === value;
            const alert = !!it.count && !!it.tone;
            return (
              <Pressable
                key={it.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${it.label}${typeof it.count === 'number' ? `, ${it.count}` : ''}`}
                onPress={() => onChange(it.key)}
                className="min-h-touch justify-center px-3"
              >
                <View className="flex-row items-center gap-1.5 py-2.5">
                  <Text variant="body" weight={on ? 'bold' : 'medium'} tone={on ? 'brand' : 'secondary'} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {typeof it.count === 'number' && (
                    <View
                      className={cn(
                        'min-w-[22px] items-center rounded-full px-1.5',
                        alert ? (it.tone === 'danger' ? 'bg-danger' : 'bg-warning') : on ? 'bg-brand-500' : 'bg-canvas-subtle',
                      )}
                    >
                      <Text variant="micro" weight="bold" tone={alert || on ? 'inverse' : 'secondary'}>
                        {it.count}
                      </Text>
                    </View>
                  )}
                </View>
                <View className={cn('absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full', on ? 'bg-brand-500' : 'bg-transparent')} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------- Avatar tô màu theo vai trò ----------------

const ROLE_AVATAR: Record<Role, { box: string; tone: 'brand' | 'accent' | 'success' | 'danger' }> = {
  CUSTOMER: { box: 'bg-brand-50', tone: 'brand' },
  RESTAURANT_OWNER: { box: 'bg-accent-50', tone: 'accent' },
  DRIVER: { box: 'bg-success-soft', tone: 'success' },
  ADMIN: { box: 'bg-danger-soft', tone: 'danger' },
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';

const ROLE_AVATAR_BOX = { md: 'h-11 w-11', lg: 'h-14 w-14', xl: 'h-20 w-20' } as const;

/** Avatar chữ cái đầu trên nền màu vai trò (có ảnh thì dùng ảnh). Huy hiệu khoá đỏ chỉ khi tài khoản bị khoá. */
export const RoleAvatar: React.FC<{
  name: string;
  role: Role;
  uri?: string | null;
  locked?: boolean;
  size?: 'md' | 'lg' | 'xl';
}> = ({ name, role, uri, locked, size = 'md' }) => (
  <View>
    {uri ? (
      <Avatar uri={uri} name={name} size={size === 'md' ? 'md' : size} />
    ) : (
      <View className={cn('items-center justify-center rounded-full', ROLE_AVATAR_BOX[size], ROLE_AVATAR[role].box)}>
        <Text variant={size === 'xl' ? 'title' : size === 'lg' ? 'headline' : 'body'} weight="bold" tone={ROLE_AVATAR[role].tone}>
          {initialsOf(name)}
        </Text>
      </View>
    )}
    {locked && (
      <View
        accessibilityLabel="Đã khoá"
        className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-danger"
      >
        <Icon name="lock-closed" size={9} tone="inverse" />
      </View>
    )}
  </View>
);

// ---------------- Hàng người dùng & khung chờ danh sách ----------------

export const UserAvatarRow: React.FC<{
  name: string;
  subtitle?: string | null;
  avatarUri?: string | null;
  online?: boolean | null;
  trailing?: React.ReactNode;
}> = ({ name, subtitle, avatarUri, online, trailing }) => (
  <View className="flex-row items-center gap-3">
    <View>
      <Avatar uri={avatarUri} name={name} size="lg" />
      {online !== null && online !== undefined && (
        <View
          accessibilityLabel={online ? 'Đang hoạt động' : 'Đã khoá'}
          className={cn('absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface', online ? 'bg-success' : 'bg-danger')}
        />
      )}
    </View>
    <View className="flex-1 gap-0.5">
      <Text variant="body-lg" weight="semibold" numberOfLines={1}>
        {name}
      </Text>
      {!!subtitle && (
        <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    {trailing}
  </View>
);

export const ListSkeleton: React.FC<{ rows?: number; withImage?: boolean }> = ({ rows = 5, withImage }) => (
  <View className="gap-3">
    {Array.from({ length: rows }, (_, i) => (
      <View key={i} className="flex-row gap-3 rounded-2xl bg-surface p-4 shadow-card">
        <Skeleton className={withImage ? 'h-16 w-16 rounded-xl' : 'h-12 w-12 rounded-full'} />
        <View className="flex-1 gap-2 py-1">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </View>
      </View>
    ))}
  </View>
);

/** Ô trống bên phải trên màn rộng khi chưa chọn mục nào. */
export const DetailPlaceholder: React.FC<{ icon: IconName; text: string }> = ({ icon, text }) => (
  <View className="flex-1 items-center justify-center gap-3 rounded-2xl bg-surface p-8 shadow-card">
    <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-50">
      <Icon name={icon} size="lg" tone="brand" />
    </View>
    <Text variant="body" tone="secondary" className="text-center">
      {text}
    </Text>
  </View>
);
