import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNow } from '../../../hooks/useNow';
import { MenuItem } from '../../../types/api';
import { getDishAvailabilityStatus } from '../../../utils/dishAvailability';
import { formatVND } from '../../../utils/format';
import { linePrice, originalLinePrice, parseOptions } from '../../../utils/menuPricing';
import { AppImage, BottomSheet, Button, ChoiceGroup, ChoiceRow, Icon, IconButton, Input, QuantityStepper, Text, cn } from '../../ui';

export interface DishSelection {
  sizeId?: string;
  sizeLabel?: string;
  toppingIds: string[];
  toppingLabels: string[];
  level?: string;
  quantity: number;
  note?: string;
}

interface Props {
  item: MenuItem | null;
  canOrder: boolean;
  initialSelection?: Partial<DishSelection>;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (item: MenuItem, sel: DishSelection) => void;
  /** Có thì hiện nút chia sẻ món cạnh tên món. */
  onShare?: (item: MenuItem) => void;
}

const MAX_TOPPINGS = 10; // trùng giới hạn của backend

/**
 * Bảng chọn tuỳ chọn món: lấy size/topping/mức cay-đường từ dữ liệu thật của món (cột options).
 * Tổng tiền hiển thị tính bằng cùng quy tắc với backend.
 */
export const DishOptionSheet: React.FC<Props> = ({
  item,
  canOrder,
  initialSelection,
  confirmLabel,
  onClose,
  onConfirm,
  onShare,
}) => {
  // Giá trị mặc định lấy từ chính món (size đầu tiên, mức đầu tiên) hoặc từ initialSelection khi sửa món.
  const opts = useMemo(() => parseOptions(item?.options), [item]);
  const [sizeId, setSizeId] = useState<string | undefined>(
    () => initialSelection?.sizeId ?? opts.sizes?.[0]?.id,
  );
  const [toppingIds, setToppingIds] = useState<string[]>(
    () => initialSelection?.toppingIds ?? [],
  );
  const [level, setLevel] = useState<string | undefined>(
    () => initialSelection?.level ?? (opts.spiceLevels ?? opts.sugarLevels)?.[0],
  );
  const [quantity, setQuantity] = useState(() => initialSelection?.quantity ?? 1);
  const [note, setNote] = useState(() => initialSelection?.note ?? '');

  const now = useNow();
  const availability = useMemo(() => (item ? getDishAvailabilityStatus(item, now) : null), [item, now]);
  const isAvailableNow = (item?.isAvailable ?? true) && (availability?.isAvailableNow ?? true);
  const canAddToCart = canOrder && isAvailableNow;

  if (!item) return null;

  const sel = { sizeId, toppingIds };
  const unit = linePrice(item, sel);
  const unitBefore = originalLinePrice(item, sel);
  const levels = opts.spiceLevels ?? opts.sugarLevels;
  const levelTitle = opts.spiceLevels ? 'Độ cay' : 'Lượng đường';

  const toggleTopping = (id: string) =>
    setToppingIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : prev.length < MAX_TOPPINGS ? [...prev, id] : prev,
    );

  const confirm = () =>
    onConfirm(item, {
      sizeId,
      sizeLabel: opts.sizes?.find((s) => s.id === sizeId)?.name,
      toppingIds,
      toppingLabels: toppingIds.map((id) => opts.toppings?.find((t) => t.id === id)?.name ?? id),
      level,
      quantity,
      note: note.trim() || undefined,
    });

  let buttonLabel = confirmLabel
    ? `${confirmLabel} · ${formatVND(unit * quantity)}`
    : `Thêm vào giỏ · ${formatVND(unit * quantity)}`;

  if (item && !item.isAvailable) {
    buttonLabel = 'Món đã tạm hết';
  } else if (availability?.isTimedDish && !availability.isAvailableNow && item?.availableFrom) {
    buttonLabel = `Chỉ bán ${item.availableFrom} – ${item.availableTo}`;
  } else if (!canOrder) {
    buttonLabel = 'Quán đang đóng cửa';
  }

  return (
    <BottomSheet
      visible
      onClose={onClose}
      footer={
        <View className="flex-row items-center gap-3 pb-2">
          <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={50} />
          <Button
            label={buttonLabel}
            disabled={!canAddToCart}
            onPress={confirm}
            className="flex-1"
          />
        </View>
      }
    >
      <ScrollView className="max-h-[520px]" keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-4">
        <AppImage uri={item.imageUrl} className="h-44 w-full rounded-lg" fallbackIcon="fast-food-outline" />
        <View className="gap-1">
          <View className="flex-row items-start gap-2">
            <Text variant="title" className="flex-1">
              {item.name}
            </Text>
            {onShare && (
              <IconButton
                icon="share-social-outline"
                variant="subtle"
                size="sm"
                accessibilityLabel={`Chia sẻ món ${item.name}`}
                onPress={() => onShare(item)}
              />
            )}
          </View>
          {availability?.isTimedDish && (
            <View
              className={cn(
                'flex-row items-center gap-2 rounded-xl px-3 py-2',
                availability.isAvailableNow ? 'bg-brand-50' : 'bg-accent-50',
              )}
            >
              <Icon name="time-outline" size="sm" tone={availability.isAvailableNow ? 'brand' : 'accent'} />
              <Text
                variant="caption"
                weight="medium"
                tone={availability.isAvailableNow ? 'brand' : 'accent'}
                className="flex-1"
              >
                Khung giờ mở bán: {item.availableFrom} – {item.availableTo}
                {!availability.isAvailableNow ? ` · Bắt đầu bán từ ${item.availableFrom}` : ' · Đang mở bán'}
              </Text>
            </View>
          )}
          {!!item.description && (
            <Text variant="body" tone="secondary">
              {item.description}
            </Text>
          )}
          <View className="flex-row items-baseline gap-2">
            <Text variant="headline" weight="bold" tone="brand">
              {formatVND(unit)}
            </Text>
            {unitBefore > unit && (
              <Text variant="body" tone="muted" className="line-through">
                {formatVND(unitBefore)}
              </Text>
            )}
          </View>
        </View>

        {opts.sizes && (
          <ChoiceGroup title="Kích cỡ" required>
            {opts.sizes.map((s) => (
              <ChoiceRow
                key={s.id}
                kind="radio"
                label={s.name}
                meta={s.price > 0 ? `+${formatVND(s.price)}` : undefined}
                selected={sizeId === s.id}
                onPress={() => setSizeId(s.id)}
              />
            ))}
          </ChoiceGroup>
        )}

        {opts.toppings && (
          <ChoiceGroup title="Thêm topping" hint="Chọn nhiều">
            {opts.toppings.map((t) => (
              <ChoiceRow
                key={t.id}
                kind="checkbox"
                label={t.name}
                meta={`+${formatVND(t.price)}`}
                selected={toppingIds.includes(t.id)}
                onPress={() => toggleTopping(t.id)}
              />
            ))}
          </ChoiceGroup>
        )}

        {levels && (
          <ChoiceGroup title={levelTitle} required>
            {levels.map((l) => (
              <ChoiceRow key={l} kind="radio" label={l} selected={level === l} onPress={() => setLevel(l)} />
            ))}
          </ChoiceGroup>
        )}

        <View className="border-t border-line-subtle pt-4">
          <Input
            label="Ghi chú cho quán"
            placeholder="Ví dụ: ít hành, không đá…"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
};
