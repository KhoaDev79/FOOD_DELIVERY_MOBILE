import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartItem } from '../../components/modules/CartItem';
import { CartSuggestions } from '../../components/modules/cart/CartSuggestions';
import { Money } from '../../components/modules/partner/PartnerKit';
import { DishOptionSheet } from '../../components/modules/restaurant/DishOptionSheet';
import { AppImage, Button, ConfirmDialog, EmptyState, Icon, Text, TopBar } from '../../components/ui';
import { useCartCheck } from '../../hooks/useCartCheck';
import { CartLineItem, lineKeyOf, useCartStore } from '../../store/useCartStore';
import { CartCheckBanners, checkoutBlockedLabel } from '../../components/modules/cart/CartCheckBanners';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

export const CartScreen: React.FC<Props> = ({ navigation }) => {
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const updateLineItem = useCartStore((s) => s.updateLineItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());
  const totalItems = useCartStore((s) => s.getTotalItems());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const removeLines = useCartStore((s) => s.removeLines);
  const applyPrices = useCartStore((s) => s.applyPrices);
  // Kiểm tra giỏ với máy chủ: món hết / ngoài giờ / đổi giá, quán còn nhận đơn không
  const { result: check, byKey, blockingKeys, newPrices, isChecking } = useCartCheck();
  const priceChangeCount = Object.keys(newPrices).length;
  const blockedLabel = checkoutBlockedLabel(check, blockingKeys.length);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingItem, setEditingItem] = useState<CartLineItem | null>(null);

  const isEmpty = items.length === 0 || !restaurant;
  const close = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'HomeTab' });

  const handleCheckout = () => {
    // Giá đổi không chặn đặt hàng: tự cập nhật giá mới trước khi sang Thanh toán
    if (priceChangeCount > 0) applyPrices(newPrices);
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      {/* Ảnh mẫu 9: nút X, tiêu đề lớn; "Xoá tất cả" chỉ hiện khi giỏ có món. */}
      <TopBar
        title="Giỏ hàng"
        titleAlign="large"
        leading="close"
        onLeadingPress={close}
        className="bg-canvas-subtle"
        trailing={
          !isEmpty ? (
            <Button label="Xoá tất cả" variant="ghost" size="sm" onPress={() => setConfirmClear(true)} />
          ) : undefined
        }
      />

      {isEmpty ? (
        <EmptyState
          icon="basket-outline"
          title="Giỏ hàng đang trống!"
          description="Thêm món vào giỏ để bắt đầu đặt hàng."
          actionLabel="Khám phá món ngon"
          onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
          className="flex-1"
        />
      ) : (
        <>
          <FlatList
            data={items}
            // Dòng có tuỳ chọn được store nhận diện bằng id riêng; dòng thường dùng id món.
            keyExtractor={(i) => i.id ?? i.menuItem.id}
            contentContainerClassName="gap-3 px-4 pt-1"
            contentContainerStyle={{ paddingBottom: 24 }}
            ListHeaderComponent={
              <View className="gap-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xem thực đơn ${restaurant.name}`}
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })}
                  className="mb-1 flex-row items-center gap-3 rounded-2xl bg-surface p-3 shadow-card active:opacity-90"
                >
                  <AppImage
                    uri={restaurant.imageUrl}
                    className="h-12 w-12 rounded-xl"
                    fallbackIcon="storefront-outline"
                  />
                  <View className="flex-1">
                    <Text variant="micro" weight="medium" tone="muted">
                      Đặt từ quán
                    </Text>
                    <Text variant="body-lg" weight="bold" numberOfLines={1}>
                      {restaurant.name}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size="sm" tone="muted" />
                </Pressable>
                <CartCheckBanners
                  check={check}
                  blockingCount={blockingKeys.length}
                  priceChangeCount={priceChangeCount}
                  onRemoveBlocked={() => removeLines(blockingKeys)}
                  onApplyPrices={() => applyPrices(newPrices)}
                />
              </View>
            }
            ListFooterComponent={
              <View className="gap-3">
                <CartSuggestions restaurant={restaurant} />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })}
                  className="h-12 flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 active:bg-brand-50"
                >
                  <Icon name="add-circle" size="md" tone="brand" />
                  <Text variant="body" weight="semibold" tone="brand">
                    Thêm món khác
                  </Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onChangeQuantity={(q) => updateQuantity(item.id ?? item.menuItem.id, q)}
                onEditOptions={(lineItem) => setEditingItem(lineItem)}
                check={byKey.get(lineKeyOf(item))}
              />
            )}
          />

          {/* Thanh tổng tiền dính đáy, tôn trọng vùng an toàn */}
          <SafeAreaView edges={['bottom']} className="border-t border-line-subtle bg-surface shadow-float">
            <View className="gap-3 px-4 pb-3 pt-3">
              <View className="flex-row items-end justify-between">
                <View className="gap-0.5">
                  <Text variant="body" weight="semibold">
                    Tạm tính · {totalItems} món
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Icon name="bicycle-outline" size={13} tone="muted" />
                    <Text variant="caption" weight="regular" tone="muted">
                      Phí giao tính ở bước tiếp theo
                    </Text>
                  </View>
                </View>
                <Money amount={subtotal} variant="title" tone="brand" />
              </View>
              <Button
                label={blockedLabel ?? 'Tiến hành đặt hàng'}
                rightIcon={blockedLabel ? undefined : 'arrow-forward'}
                size="lg"
                disabled={!!blockedLabel}
                loading={isChecking && !check}
                onPress={handleCheckout}
              />
            </View>
          </SafeAreaView>
        </>
      )}

      <ConfirmDialog
        visible={confirmClear}
        title="Xoá toàn bộ giỏ hàng?"
        message="Tất cả món đã chọn sẽ bị xoá khỏi giỏ."
        confirmLabel="Xoá tất cả"
        cancelLabel="Hủy"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearCart();
          setConfirmClear(false);
        }}
      />

      {editingItem && (
        <DishOptionSheet
          key={editingItem.id ?? editingItem.menuItem.id}
          item={editingItem.menuItem}
          canOrder={true}
          initialSelection={{
            sizeId: editingItem.sizeId,
            toppingIds: editingItem.toppingIds,
            level: editingItem.level,
            quantity: editingItem.quantity,
            note: editingItem.note,
          }}
          confirmLabel="Cập nhật giỏ hàng"
          onClose={() => setEditingItem(null)}
          onConfirm={(_dish, sel) => {
            updateLineItem(editingItem.id ?? editingItem.menuItem.id, sel.quantity, {
              sizeId: sel.sizeId,
              size: sel.sizeLabel,
              toppingIds: sel.toppingIds,
              toppings: sel.toppingLabels,
              level: sel.level,
              spiciness: sel.level,
              note: sel.note,
            });
            setEditingItem(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};
