import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartItem } from '../../components/modules/CartItem';
import { DishOptionSheet } from '../../components/modules/restaurant/DishOptionSheet';
import { AppImage, Button, ConfirmDialog, EmptyState, Icon, Text, TopBar } from '../../components/ui';
import { CartLineItem, useCartStore } from '../../store/useCartStore';
import { useAuthStore } from '../../store/useAuthStore';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

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
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingItem, setEditingItem] = useState<CartLineItem | null>(null);

  const isEmpty = items.length === 0 || !restaurant;
  const close = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs', { screen: 'HomeTab' });

  const handleCheckout = () => {
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
            contentContainerClassName="gap-3 px-4 pb-6 pt-1"
            ListHeaderComponent={
              <View className="mb-1 flex-row items-center gap-3 rounded-lg border border-brand-100 bg-surface p-3">
                <AppImage
                  uri={restaurant.imageUrl}
                  className="h-12 w-12 rounded-md"
                  fallbackIcon="storefront-outline"
                />
                <View className="flex-1">
                  <Text variant="caption" weight="regular" tone="secondary">
                    Đơn hàng từ
                  </Text>
                  <Text variant="body-lg" weight="semibold" numberOfLines={1}>
                    {restaurant.name}
                  </Text>
                </View>
                <Button
                  label="Thêm món"
                  variant="secondary"
                  size="sm"
                  leftIcon="add"
                  onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })}
                />
              </View>
            }
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onChangeQuantity={(q) => updateQuantity(item.id ?? item.menuItem.id, q)}
                onEditOptions={(lineItem) => setEditingItem(lineItem)}
              />
            )}
          />

          {/* Thanh tổng tiền dính đáy, tôn trọng vùng an toàn */}
          <SafeAreaView edges={['bottom']} className="border-t border-line-subtle bg-surface shadow-float">
            <View className="gap-3 px-4 pb-3 pt-3">
              <View className="flex-row items-end justify-between">
                <View>
                  <Text variant="body" tone="secondary">
                    Tạm tính · {totalItems} món
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Icon name="information-circle-outline" size={12} tone="muted" />
                    <Text variant="caption" weight="regular" tone="muted">
                      Phí giao hàng tính ở bước thanh toán
                    </Text>
                  </View>
                </View>
                <Text variant="title" weight="bold" tone="brand">
                  {formatVND(subtotal)}
                </Text>
              </View>
              <Button
                label="Tiến hành đặt hàng"
                rightIcon="arrow-forward"
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
