import React, { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { BannerStatus } from '../../../api/adminContent';
import { palette } from '../../../theme';
import { AppImage, cn, Icon, Text } from '../../ui';

/** Nhãn trạng thái banner. */
const STATUS: Record<BannerStatus, { label: string; box: string; text: 'success' | 'brand' | 'secondary' | 'warning' }> = {
  LIVE: { label: 'Đang chạy', box: 'bg-success-soft', text: 'success' },
  SCHEDULED: { label: 'Sắp chạy', box: 'bg-brand-50', text: 'brand' },
  EXPIRED: { label: 'Hết hạn', box: 'bg-warning-soft', text: 'warning' },
  OFF: { label: 'Đã tắt', box: 'bg-canvas-subtle', text: 'secondary' },
};

export const BannerStatusChip: React.FC<{ status: BannerStatus }> = ({ status }) => (
  <View className={cn('rounded-full px-2.5 py-1', STATUS[status].box)}>
    <Text variant="micro" weight="bold" tone={STATUS[status].text}>
      {STATUS[status].label}
    </Text>
  </View>
);

/** Nút ▲▼ đổi thứ tự hiển thị. */
export const MoveButtons: React.FC<{ onUp?: () => void; onDown?: () => void; disabled?: boolean }> = ({
  onUp,
  onDown,
  disabled,
}) => (
  <View className="flex-row gap-1">
    {[
      { icon: 'chevron-up' as const, fn: onUp, label: 'Đưa lên' },
      { icon: 'chevron-down' as const, fn: onDown, label: 'Đưa xuống' },
    ].map((b) => (
      <Pressable
        key={b.icon}
        accessibilityRole="button"
        accessibilityLabel={b.label}
        disabled={!b.fn || disabled}
        onPress={b.fn}
        hitSlop={4}
        className={cn('h-9 w-9 items-center justify-center rounded-full bg-canvas-subtle active:bg-line', !b.fn ? 'opacity-30' : '')}
      >
        <Icon name={b.icon} size="sm" tone="secondary" />
      </Pressable>
    ))}
  </View>
);

/** Khung ảnh có nút chọn/đổi ảnh, đúng tỉ lệ hiển thị ở trang chủ. */
export const ImagePickerBox: React.FC<{
  uri?: string | null;
  ratio: 'wide' | 'square';
  uploading?: boolean;
  onPick: () => void;
  hint: string;
}> = ({ uri, ratio, uploading, onPick, hint }) => (
  <View className="gap-1.5">
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uri ? 'Đổi ảnh' : 'Chọn ảnh'}
      onPress={onPick}
      disabled={uploading}
      className={cn('overflow-hidden rounded-2xl bg-canvas-subtle active:opacity-85', ratio === 'wide' ? 'w-full' : 'h-32 w-32 self-center')}
      style={ratio === 'wide' ? { aspectRatio: 16 / 9 } : undefined}
    >
      {uri ? (
        <AppImage uri={uri} className="h-full w-full" fallbackIcon="image-outline" />
      ) : (
        <View className="flex-1 items-center justify-center gap-1">
          <Icon name="image-outline" size="xl" tone="muted" />
          <Text variant="caption" weight="medium" tone="muted">
            Chọn ảnh
          </Text>
        </View>
      )}
      <View className="absolute bottom-2 right-2 flex-row items-center gap-1.5 rounded-full bg-scrim px-3 py-1.5">
        {uploading ? <ActivityIndicator size="small" color={palette.surface} /> : <Icon name="camera-outline" size="sm" tone="inverse" />}
        <Text variant="caption" weight="semibold" tone="inverse">
          {uploading ? 'Đang tải lên…' : uri ? 'Đổi ảnh' : 'Chọn ảnh'}
        </Text>
      </View>
    </Pressable>
    <Text variant="micro" weight="regular" tone="muted" className={ratio === 'square' ? 'text-center' : ''}>
      {hint}
    </Text>
  </View>
);

// ---------------- Ngày (dd/mm/yyyy) ----------------

const pad = (n: number) => String(n).padStart(2, '0');

export const toDisplayDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "dd/mm/yyyy" -> ISO (đầu ngày hoặc cuối ngày theo giờ máy), sai định dạng -> undefined. */
export const parseDisplayDate = (text: string, endOfDay: boolean): string | null | undefined => {
  const t = text.trim();
  if (!t) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  if (d.getDate() !== Number(m[1])) return undefined; // vd 31/02
  return d.toISOString();
};

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Ô ngày có nút chọn nhanh. Để trống = không giới hạn. */
export const DateField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: { label: string; days: number | null }[];
  error?: boolean;
}> = ({ label, value, onChange, presets, error }) => (
  <View className="gap-1.5">
    <Text variant="caption" weight="medium" tone="secondary">
      {label}
    </Text>
    <View
      className={cn(
        'h-11 flex-row items-center gap-2 rounded-xl border px-3',
        error ? 'border-danger bg-danger-soft' : 'border-transparent bg-canvas-subtle',
      )}
    >
      <Icon name="calendar-outline" size="sm" tone="muted" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Không giới hạn (dd/mm/yyyy)"
        placeholderTextColor={palette.ink.muted}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        className="h-full flex-1 font-body text-body text-ink"
      />
    </View>
    <View className="flex-row flex-wrap gap-1.5">
      {presets.map((p) => (
        <Pressable
          key={p.label}
          onPress={() => onChange(p.days === null ? '' : addDays(p.days))}
          className="h-8 justify-center rounded-full border border-line px-3 active:bg-canvas-subtle"
        >
          <Text variant="micro" weight="semibold" tone="secondary">
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  </View>
);

/** Ô nhập từ khoá dạng chip (Enter / nút + để thêm). */
export const KeywordInput: React.FC<{ value: string[]; onChange: (v: string[]) => void; max?: number }> = ({
  value,
  onChange,
  max = 15,
}) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const k = draft.trim().toLowerCase();
    if (k && !value.includes(k) && value.length < max) onChange([...value, k]);
    setDraft('');
  };
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {value.map((k) => (
          <View key={k} className="h-8 flex-row items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1">
            <Text variant="caption" weight="semibold" tone="brand">
              {k}
            </Text>
            <Pressable
              accessibilityLabel={`Xoá từ khoá ${k}`}
              hitSlop={6}
              onPress={() => onChange(value.filter((x) => x !== k))}
              className="h-6 w-6 items-center justify-center rounded-full active:bg-brand-100"
            >
              <Icon name="close" size={12} tone="brand" />
            </Pressable>
          </View>
        ))}
      </View>
      {value.length < max && (
        <View className="flex-row items-center gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            placeholder="VD: bún, phở, hủ tiếu"
            placeholderTextColor={palette.ink.muted}
            maxLength={30}
            className="h-10 flex-1 rounded-xl bg-canvas-subtle px-3 font-body text-body text-ink"
          />
          <Pressable
            accessibilityLabel="Thêm từ khoá"
            onPress={add}
            className="h-10 flex-row items-center gap-1 rounded-xl bg-brand-500 px-3 active:bg-brand-600"
          >
            <Icon name="add" size="sm" tone="inverse" />
            <Text variant="caption" weight="bold" tone="inverse">
              Thêm
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};
