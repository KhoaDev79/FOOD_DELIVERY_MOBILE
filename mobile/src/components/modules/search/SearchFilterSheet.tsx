import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { SearchSort } from '../../../api/restaurants';
import { palette } from '../../../theme';
import { BottomSheet, Button, cn, Icon, IconName, Text } from '../../ui';

export interface SearchFilters {
  sort: SearchSort;
  openOnly: boolean;
  hasPromo: boolean;
  minRating?: number;
  maxDistanceKm?: number;
  maxDeliveryFee?: number;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = { sort: 'relevance', openOnly: false, hasPromo: false };

export const SORT_OPTIONS: { value: SearchSort; label: string; icon: IconName }[] = [
  { value: 'relevance', label: 'Phù hợp nhất', icon: 'sparkles-outline' },
  { value: 'distance', label: 'Gần tôi nhất', icon: 'navigate-outline' },
  { value: 'rating', label: 'Đánh giá cao', icon: 'star-outline' },
  { value: 'popular', label: 'Phổ biến', icon: 'flame-outline' },
];
const DISTANCES = [1, 3, 5, 10];
const FEES = [15000, 20000, 30000];
const RATINGS = [4, 4.5];

/** Số bộ lọc đang bật (không tính sắp xếp), hiện trên nút "Lọc". */
export function countActiveFilters(f: SearchFilters): number {
  return [f.openOnly, f.hasPromo, f.minRating, f.maxDistanceKm, f.maxDeliveryFee].filter(Boolean).length;
}

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-2.5">
    <Text variant="body" weight="bold">
      {title}
    </Text>
    {children}
  </View>
);

/** Nút chọn dạng viên. Luôn có border ở cả hai trạng thái (chỉ đổi màu) để NativeWind không phải "nâng cấp" component. */
const Pill: React.FC<{ label: string; selected: boolean; onPress: () => void; icon?: IconName }> = ({
  label,
  selected,
  onPress,
  icon,
}) => (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    onPress={onPress}
    className={cn(
      'flex-row items-center gap-1.5 rounded-full border px-3.5 py-2',
      selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
    )}
  >
    {icon && <Icon name={icon} size="sm" tone={selected ? 'brand' : 'secondary'} />}
    <Text variant="caption" weight={selected ? 'semibold' : 'medium'} tone={selected ? 'brand' : 'default'}>
      {label}
    </Text>
  </Pressable>
);

const ToggleRow: React.FC<{ title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }> = ({
  title,
  subtitle,
  value,
  onChange,
}) => (
  <View className="flex-row items-center justify-between gap-3">
    <View className="flex-1">
      <Text variant="body" weight="semibold">
        {title}
      </Text>
      <Text variant="caption" weight="regular" tone="secondary">
        {subtitle}
      </Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: palette.brand['500'], false: palette.line.DEFAULT }}
      thumbColor="#fff"
    />
  </View>
);

/**
 * Bảng bộ lọc tìm kiếm (giống GrabFood / ShopeeFood): sắp xếp, khoảng cách, phí ship, đánh giá, ưu đãi.
 * Chỉ áp dụng khi bấm "Xem kết quả"; key ở nơi dùng đổi mỗi lần mở để bắt đầu từ bộ lọc hiện tại.
 */
export const SearchFilterSheet: React.FC<{
  visible: boolean;
  value: SearchFilters;
  onClose: () => void;
  onApply: (f: SearchFilters) => void;
}> = ({ visible, value, onClose, onApply }) => {
  const [draft, setDraft] = useState<SearchFilters>(value);
  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = <K extends 'minRating' | 'maxDistanceKm' | 'maxDeliveryFee'>(key: K, v: number) =>
    setDraft((d) => ({ ...d, [key]: d[key] === v ? undefined : v }));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Sắp xếp & lọc"
      footer={
        <View className="flex-row gap-3 pb-2">
          <Button
            label="Đặt lại"
            variant="outline"
            size="md"
            className="flex-1"
            onPress={() => setDraft(DEFAULT_SEARCH_FILTERS)}
          />
          <Button
            label="Xem kết quả"
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
      <ScrollView className="max-h-[520px]" contentContainerClassName="gap-5 pb-4">
        <Group title="Sắp xếp theo">
          <View className="flex-row flex-wrap gap-2">
            {SORT_OPTIONS.map((o) => (
              <Pill key={o.value} label={o.label} icon={o.icon} selected={draft.sort === o.value} onPress={() => set({ sort: o.value })} />
            ))}
          </View>
        </Group>

        <Group title="Khoảng cách">
          <View className="flex-row flex-wrap gap-2">
            {DISTANCES.map((km) => (
              <Pill
                key={km}
                label={`Dưới ${km} km`}
                selected={draft.maxDistanceKm === km}
                onPress={() => toggle('maxDistanceKm', km)}
              />
            ))}
          </View>
        </Group>

        <Group title="Phí giao hàng">
          <View className="flex-row flex-wrap gap-2">
            {FEES.map((fee) => (
              <Pill
                key={fee}
                label={`Dưới ${fee / 1000}K`}
                selected={draft.maxDeliveryFee === fee}
                onPress={() => toggle('maxDeliveryFee', fee)}
              />
            ))}
          </View>
        </Group>

        <Group title="Đánh giá">
          <View className="flex-row flex-wrap gap-2">
            {RATINGS.map((r) => (
              <Pill
                key={r}
                label={`Từ ${r.toLocaleString('vi-VN')}★`}
                icon="star"
                selected={draft.minRating === r}
                onPress={() => toggle('minRating', r)}
              />
            ))}
          </View>
        </Group>

        <View className="gap-4 rounded-2xl bg-canvas-subtle p-4">
          <ToggleRow
            title="Đang mở cửa"
            subtitle="Chỉ quán đang nhận đơn"
            value={draft.openOnly}
            onChange={(v) => set({ openOnly: v })}
          />
          <ToggleRow
            title="Có ưu đãi"
            subtitle="Quán có mã giảm giá hoặc món đang giảm"
            value={draft.hasPromo}
            onChange={(v) => set({ hasPromo: v })}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
