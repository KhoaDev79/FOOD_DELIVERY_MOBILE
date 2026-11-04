import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { CartLineCheck } from '../../api/cart';
import { CartLineItem } from '../../store/useCartStore';
import { formatVND } from '../../utils/format';
import { hasChoices, linePrice, originalLinePrice } from '../../utils/menuPricing';
import { Money } from './partner/PartnerKit';
import { AppImage, cn, Icon, QuantityStepper, Text } from '../ui';

interface CartItemProps {
  item: CartLineItem;
  /** Đổi số lượng; 0 nghĩa là xoá dòng (theo quy tắc của store). */
  onChangeQuantity: (quantity: number) => void;
  /** Mở bảng chọn để đổi size, topping hoặc thêm tuỳ chọn nếu chưa chọn */
  onEditOptions?: (item: CartLineItem) => void;
  /** Kết quả kiểm tra với máy chủ (món hết, ngoài giờ, đổi giá...) */
  check?: CartLineCheck;
}

/** Nhãn đè lên ảnh món không đặt được */
const OVERLAY: Partial<Record<CartLineCheck['status'], string>> = {
  SOLD_OUT: 'Hết món',
  REMOVED: 'Ngừng bán',
  OUT_OF_HOURS: 'Ngoài giờ',
  OPTION_CHANGED: 'Cần chọn lại',
};

/** Một dòng món trong giỏ: ảnh, tên, tuỳ chọn đã chọn, ghi chú, thành tiền và bộ chọn số lượng. */
export const CartItem = memo<CartItemProps>(({ item, onChangeQuantity, onEditOptions, check }) => {
  const unit = item.unitPrice || linePrice(item.menuItem, item);
  const original = originalLinePrice(item.menuItem, item);
  const options = [item.size, ...(item.toppings ?? []), item.spiciness].filter(Boolean);
  const customizable = hasChoices(item.menuItem);
  const blocked = !!check?.blocking;
  const priceChanged = check?.status === 'PRICE_CHANGED' && check.unitPrice != null;
  const overlay = check?.status === 'SOLD_OUT' && check.soldOutUntil ? 'Hết hôm nay' : check ? OVERLAY[check.status] : undefined;

  return (
    <View
      className={cn(
        'gap-2.5 rounded-2xl bg-surface p-3 shadow-card',
        blocked ? 'border border-danger/25' : priceChanged ? 'border border-warning/40' : '',
      )}
    >
      <View className="flex-row gap-3">
        <View>
          <AppImage
            uri={item.menuItem.imageUrl}
            className={cn('h-20 w-20 rounded-xl', blocked && 'opacity-40')}
            fallbackIcon="fast-food-outline"
          />
          {blocked && !!overlay && (
            <View className="absolute bottom-1.5 left-1.5 right-1.5 items-center rounded-md bg-scrim py-0.5">
              <Text variant="micro" weight="bold" tone="inverse">
                {overlay}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-1 justify-between gap-1.5">
          <View className="gap-0.5">
            <Text variant="body" weight="bold" numberOfLines={2} tone={blocked ? 'muted' : 'default'}>
              {item.menuItem.name}
            </Text>
            {options.length > 0 && (
              <Text variant="caption" weight="regular" tone="secondary" numberOfLines={2}>
                {options.join(' · ')}
              </Text>
            )}
            {!!item.note && (
              <Text variant="caption" weight="regular" tone="muted" numberOfLines={1}>
                Ghi chú: {item.note}
              </Text>
            )}
            {customizable && onEditOptions && !blocked && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Đổi tuỳ chọn cho ${item.menuItem.name}`}
                onPress={() => onEditOptions(item)}
                hitSlop={8}
                className="mt-0.5 flex-row items-center gap-0.5 self-start active:opacity-70"
              >
                <Text variant="caption" weight="semibold" tone="brand">
                  {options.length > 0 ? 'Đổi tuỳ chọn' : 'Thêm size, topping'}
                </Text>
                <Icon name="chevron-forward" size={13} tone="brand" />
              </Pressable>
            )}
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <View>
              {blocked ? (
                <Text variant="body" weight="semibold" tone="muted" className="line-through">
                  {formatVND(unit * item.quantity)}
                </Text>
              ) : (
                <>
                  <Money amount={(priceChanged ? check!.unitPrice! : unit) * item.quantity} variant="body-lg" tone="brand" />
                  {(priceChanged || original > unit) && (
                    <Text variant="micro" weight="regular" tone="muted" className="line-through">
                      {formatVND((priceChanged ? unit : original) * item.quantity)}
                    </Text>
                  )}
                </>
              )}
            </View>
            {blocked ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Xoá ${item.menuItem.name} khỏi giỏ`}
                onPress={() => onChangeQuantity(0)}
                hitSlop={6}
                className="h-8 flex-row items-center gap-1 rounded-full bg-danger-soft px-3 active:opacity-75"
              >
                <Icon name="trash-outline" size={14} tone="danger" />
                <Text variant="caption" weight="bold" tone="danger">
                  Xoá
                </Text>
              </Pressable>
            ) : (
              <QuantityStepper value={item.quantity} onChange={onChangeQuantity} size="sm" max={50} />
            )}
          </View>
        </View>
      </View>

      {/* Lý do cụ thể: "Hết hôm nay, mở bán lại 04:00 sáng mai." / "Giá món vừa giảm." */}
      {!!check?.message && check.status !== 'OK' && (
        <View
          className={cn(
            'flex-row items-center gap-2 rounded-xl px-3 py-2',
            blocked ? 'bg-danger-soft' : 'bg-warning-soft',
          )}
        >
          <Icon
            name={blocked ? (check.status === 'OUT_OF_HOURS' ? 'time-outline' : 'alert-circle-outline') : 'pricetag-outline'}
            size={15}
            tone={blocked ? 'danger' : 'warning'}
          />
          <Text variant="caption" weight="semibold" tone={blocked ? 'danger' : 'warning'} className="flex-1">
            {check.message}
          </Text>
          {check.status === 'OPTION_CHANGED' && onEditOptions && (
            <Pressable accessibilityRole="button" onPress={() => onEditOptions(item)} hitSlop={8} className="active:opacity-70">
              <Text variant="caption" weight="bold" tone="brand">
                Chọn lại
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
});
CartItem.displayName = 'CartItem';
