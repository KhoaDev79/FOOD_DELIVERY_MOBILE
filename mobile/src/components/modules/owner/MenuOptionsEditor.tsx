import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { cn, Icon, IconName, Text } from '../../ui';
import { palette } from '../../../theme';
import { MenuItemOptions, MenuItemOptionsInput } from '../../../types/api';
import { formatVND } from '../../../utils/format';

/**
 * Soạn tuỳ chọn của món cho chủ quán: size (khách chọn 1), topping (chọn nhiều) và
 * một loại mức (cay hoặc đường). Cùng giới hạn với backend (menus/menu-options.ts).
 */

export const MAX_SIZES = 10;
export const MAX_TOPPINGS = 10;
export const MAX_LEVELS = 6;
const MAX_OPTION_PRICE = 500_000;

type LevelKind = 'none' | 'spice' | 'sugar';

interface OptionRow {
  /** Khoá hiển thị trong danh sách (không gửi lên server). */
  key: string;
  /** id đã lưu ở server: gửi lại để giữ nguyên lựa chọn khách đang có trong giỏ. */
  id?: string;
  name: string;
  /** Chỉ chữ số. */
  price: string;
}

export interface OptionsDraft {
  sizes: OptionRow[];
  toppings: OptionRow[];
  levelKind: LevelKind;
  levels: string[];
}

let keySeq = 0;
const newKey = () => `row_${Date.now()}_${keySeq++}`;
const row = (name = '', price = 0, id?: string): OptionRow => ({
  key: newKey(),
  id,
  name,
  price: price ? String(price) : '',
});

export const EMPTY_OPTIONS_DRAFT: OptionsDraft = { sizes: [], toppings: [], levelKind: 'none', levels: [] };

export function draftFromOptions(o?: MenuItemOptions | null): OptionsDraft {
  return {
    sizes: (o?.sizes ?? []).map((s) => row(s.name, s.price, s.id)),
    toppings: (o?.toppings ?? []).map((t) => row(t.name, t.price, t.id)),
    levelKind: o?.spiceLevels?.length ? 'spice' : o?.sugarLevels?.length ? 'sugar' : 'none',
    levels: o?.spiceLevels ?? o?.sugarLevels ?? [],
  };
}

const toNumber = (digits: string) => parseInt(digits || '0', 10) || 0;
const cleanRows = (rows: OptionRow[]) =>
  rows
    .filter((r) => r.name.trim())
    .map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), price: toNumber(r.price) }));

/** Dữ liệu gửi lên server; null nghĩa là món không có tuỳ chọn nào. */
export function draftToInput(d: OptionsDraft): MenuItemOptionsInput | null {
  const sizes = cleanRows(d.sizes);
  const toppings = cleanRows(d.toppings);
  const levels = d.levelKind === 'none' ? [] : d.levels.map((l) => l.trim()).filter(Boolean);
  const out: MenuItemOptionsInput = {};
  if (sizes.length) out.sizes = sizes;
  if (toppings.length) out.toppings = toppings;
  if (levels.length) out[d.levelKind === 'spice' ? 'spiceLevels' : 'sugarLevels'] = levels;
  return Object.keys(out).length ? out : null;
}

/** Lỗi nhập liệu cần sửa trước khi lưu (giống kiểm tra ở backend), hoặc null. */
export function validateDraft(d: OptionsDraft): string | null {
  for (const [label, rows] of [
    ['Size', d.sizes],
    ['Topping', d.toppings],
  ] as const) {
    const named = rows.filter((r) => r.name.trim());
    if (rows.some((r) => !r.name.trim() && r.price)) return `${label}: có dòng đã nhập giá nhưng chưa có tên`;
    const seen = new Set<string>();
    for (const r of named) {
      const k = r.name.trim().toLowerCase();
      if (seen.has(k)) return `${label} "${r.name.trim()}" bị trùng tên`;
      seen.add(k);
      if (toNumber(r.price) > MAX_OPTION_PRICE) return `${label} "${r.name.trim()}": giá cộng thêm tối đa 500.000 ₫`;
    }
  }
  return null;
}

/** Khoảng giá khách có thể trả (giá thấp nhất là size rẻ nhất, cao nhất là size đắt nhất + mọi topping). */
export function priceRange(base: number, d: OptionsDraft): { min: number; max: number } | null {
  const sizes = cleanRows(d.sizes);
  const toppings = cleanRows(d.toppings);
  if (!base || (!sizes.length && !toppings.length)) return null;
  // Khách không chọn size thì lấy size đầu tiên (mặc định)
  const sizePrices = sizes.map((s) => s.price);
  const min = base + (sizes.length ? Math.min(...sizePrices) : 0);
  const max = base + (sizes.length ? Math.max(...sizePrices) : 0) + toppings.reduce((s, t) => s + t.price, 0);
  return { min, max };
}

/** Tóm tắt ngắn để hiện trong danh sách thực đơn: "2 size · 3 topping · mức cay". */
export function optionsSummary(o?: MenuItemOptions | null): string | null {
  if (!o) return null;
  const parts = [
    o.sizes?.length ? `${o.sizes.length} size` : null,
    o.toppings?.length ? `${o.toppings.length} topping` : null,
    o.spiceLevels?.length ? 'mức cay' : o.sugarLevels?.length ? 'mức đường' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

const formatDigits = (digits: string) => (digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

/** Ô nhập số tiền: tự thêm dấu chấm hàng nghìn, chữ ₫ ở cuối. Giá trị trả ra chỉ gồm chữ số. */
export const MoneyInput: React.FC<{
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  prefix?: string;
  accessibilityLabel?: string;
  error?: boolean;
  /** Cỡ lớn, cùng chiều cao với ô nhập Input (dùng cho giá bán chính). */
  large?: boolean;
  className?: string;
}> = ({ value, onChange, placeholder, prefix, accessibilityLabel, error, large, className }) => (
  <View
    className={cn(
      'flex-row items-center border px-3',
      large ? 'h-button-lg rounded-md' : 'h-11 rounded-xl',
      error ? 'border-danger bg-danger-soft' : 'border-transparent bg-canvas-subtle',
      className,
    )}
  >
    {!!prefix && (
      <Text variant="body" tone="muted">
        {prefix}
      </Text>
    )}
    <TextInput
      value={formatDigits(value)}
      onChangeText={(t) => onChange(t.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9))}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={palette.ink.muted}
      accessibilityLabel={accessibilityLabel}
      maxFontSizeMultiplier={1.4}
      className={cn('h-full flex-1 font-body-semibold text-ink', large ? 'text-body-lg' : 'text-right text-body')}
    />
    <Text variant="body" weight="semibold" tone="secondary" className="ml-1">
      ₫
    </Text>
  </View>
);

const TEMPLATES: { label: string; icon: IconName; apply: (d: OptionsDraft) => OptionsDraft }[] = [
  {
    label: 'Tô thường / đặc biệt',
    icon: 'restaurant-outline',
    apply: (d) => ({ ...d, sizes: [row('Tô thường', 0), row('Tô đặc biệt', 15000)] }),
  },
  {
    label: 'Size M / L',
    icon: 'cafe-outline',
    apply: (d) => ({ ...d, sizes: [row('Size M', 0), row('Size L', 10000)] }),
  },
  {
    label: 'Mức cay',
    icon: 'flame-outline',
    apply: (d) => ({ ...d, levelKind: 'spice', levels: ['Không cay', 'Cay nhẹ', 'Cay vừa', 'Cay nhiều'] }),
  },
  {
    label: 'Mức đường',
    icon: 'water-outline',
    apply: (d) => ({ ...d, levelKind: 'sugar', levels: ['100% đường', '70% đường', '50% đường', 'Không đường'] }),
  },
];

/** Bảng soạn tuỳ chọn. */
export const MenuOptionsEditor: React.FC<{
  value: OptionsDraft;
  onChange: (d: OptionsDraft) => void;
  basePrice: number;
}> = ({ value: d, onChange, basePrice }) => {
  const range = priceRange(basePrice, d);

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between">
        <View>
          <Text variant="body-lg" weight="bold">
            Tuỳ chọn cho khách
          </Text>
          <Text variant="caption" weight="regular" tone="muted">
            Size, topping, mức cay/đường · không bắt buộc
          </Text>
        </View>
      </View>

      {/* Mẫu điền nhanh */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {TEMPLATES.map((t) => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            accessibilityLabel={`Điền mẫu ${t.label}`}
            onPress={() => onChange(t.apply(d))}
            className="h-9 flex-row items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-brand-50 px-3 active:opacity-75"
          >
            <Icon name={t.icon} size="sm" tone="brand" />
            <Text variant="caption" weight="semibold" tone="brand">
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <OptionList
        title="Size"
        hint="Khách chọn 1 · dòng đầu là mặc định"
        icon="resize-outline"
        rows={d.sizes}
        max={MAX_SIZES}
        namePlaceholder="VD: Tô đặc biệt"
        showDefault
        onChange={(sizes) => onChange({ ...d, sizes })}
      />
      <OptionList
        title="Topping"
        hint="Khách chọn nhiều"
        icon="add-circle-outline"
        rows={d.toppings}
        max={MAX_TOPPINGS}
        namePlaceholder="VD: Trứng chần"
        onChange={(toppings) => onChange({ ...d, toppings })}
      />
      <LevelEditor value={d} onChange={onChange} />

      {range && (
        <View className="flex-row items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5">
          <Icon name="pricetags-outline" size="sm" tone="brand" />
          <Text variant="caption" className="flex-1">
            Khách trả{' '}
            <Text variant="caption" weight="bold" tone="brand">
              {range.min === range.max ? formatVND(range.min) : `${formatVND(range.min)} – ${formatVND(range.max)}`}
            </Text>{' '}
            / phần
          </Text>
        </View>
      )}
    </View>
  );
};

const OptionList: React.FC<{
  title: string;
  hint: string;
  icon: IconName;
  rows: OptionRow[];
  max: number;
  namePlaceholder: string;
  showDefault?: boolean;
  onChange: (rows: OptionRow[]) => void;
}> = ({ title, hint, icon, rows, max, namePlaceholder, showDefault, onChange }) => {
  const update = (key: string, patch: Partial<OptionRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <View className="gap-2 rounded-2xl border border-line-subtle bg-surface p-3">
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size="sm" tone="brand" />
        <Text variant="body" weight="bold">
          {title}
        </Text>
        <Text variant="micro" weight="regular" tone="muted" className="flex-1" numberOfLines={1}>
          {hint}
        </Text>
        {rows.length > 0 && (
          <Text variant="micro" tone="muted">
            {rows.length}/{max}
          </Text>
        )}
      </View>

      {rows.map((r, idx) => (
        <View key={r.key} className="flex-row items-center gap-2">
          <View className="flex-1">
            <TextInput
              value={r.name}
              onChangeText={(name) => update(r.key, { name: name.slice(0, 60) })}
              placeholder={showDefault && idx === 0 ? `${namePlaceholder} (mặc định)` : namePlaceholder}
              placeholderTextColor={palette.ink.muted}
              accessibilityLabel={`${title} ${idx + 1}: tên`}
              maxFontSizeMultiplier={1.4}
              className="h-11 rounded-xl bg-canvas-subtle px-3 font-body text-body text-ink"
            />
          </View>
          <MoneyInput
            value={r.price}
            onChange={(price) => update(r.key, { price })}
            placeholder="0"
            prefix="+"
            accessibilityLabel={`${title} ${idx + 1}: giá cộng thêm`}
            className="w-32"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xoá ${title.toLowerCase()} ${r.name || idx + 1}`}
            hitSlop={8}
            onPress={() => onChange(rows.filter((x) => x.key !== r.key))}
            className="h-9 w-9 items-center justify-center rounded-full active:bg-canvas-subtle"
          >
            <Icon name="close" size="sm" tone="muted" />
          </Pressable>
        </View>
      ))}

      {rows.length < max && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([...rows, row()])}
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl border border-dashed border-line active:bg-canvas-subtle"
        >
          <Icon name="add" size="sm" tone="brand" />
          <Text variant="caption" weight="semibold" tone="brand">
            Thêm {title.toLowerCase()}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const LEVEL_KINDS: { key: LevelKind; label: string }[] = [
  { key: 'none', label: 'Không có' },
  { key: 'spice', label: 'Mức cay' },
  { key: 'sugar', label: 'Mức đường' },
];

const LevelEditor: React.FC<{ value: OptionsDraft; onChange: (d: OptionsDraft) => void }> = ({ value: d, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim().slice(0, 30);
    if (!v || d.levels.length >= MAX_LEVELS || d.levels.some((l) => l.toLowerCase() === v.toLowerCase())) return;
    onChange({ ...d, levels: [...d.levels, v] });
    setDraft('');
  };

  return (
    <View className="gap-2.5 rounded-2xl border border-line-subtle bg-surface p-3">
      <View className="flex-row items-center gap-2">
        <Icon name="options-outline" size="sm" tone="brand" />
        <Text variant="body" weight="bold">
          Mức
        </Text>
        <Text variant="micro" weight="regular" tone="muted" className="flex-1" numberOfLines={1}>
          Khách chọn 1 · không tính tiền
        </Text>
      </View>

      <View className="flex-row rounded-full bg-canvas-subtle p-1">
        {LEVEL_KINDS.map((k) => {
          const selected = d.levelKind === k.key;
          return (
            <Pressable
              key={k.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...d, levelKind: k.key, levels: k.key === d.levelKind ? d.levels : [] })}
              className={cn('h-8 flex-1 items-center justify-center rounded-full', selected ? 'bg-surface shadow-card' : 'shadow-none')}
            >
              <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'secondary'}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {d.levelKind !== 'none' && (
        <>
          <View className="flex-row flex-wrap gap-2">
            {d.levels.map((l) => (
              <View key={l} className="h-8 flex-row items-center gap-1 rounded-full bg-brand-50 pl-3 pr-1">
                <Text variant="caption" weight="semibold" tone="brand">
                  {l}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xoá mức ${l}`}
                  hitSlop={6}
                  onPress={() => onChange({ ...d, levels: d.levels.filter((x) => x !== l) })}
                  className="h-6 w-6 items-center justify-center rounded-full active:bg-brand-100"
                >
                  <Icon name="close" size={12} tone="brand" />
                </Pressable>
              </View>
            ))}
          </View>
          {d.levels.length < MAX_LEVELS && (
            <View className="flex-row items-center gap-2">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={add}
                returnKeyType="done"
                placeholder={d.levelKind === 'spice' ? 'VD: Cay xé lưỡi' : 'VD: 30% đường'}
                placeholderTextColor={palette.ink.muted}
                maxFontSizeMultiplier={1.4}
                className="h-10 flex-1 rounded-xl bg-canvas-subtle px-3 font-body text-body text-ink"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm mức"
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
        </>
      )}
    </View>
  );
};
