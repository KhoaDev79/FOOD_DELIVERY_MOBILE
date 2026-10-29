import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { CartItem } from '../../components/modules/CartItem';
import { colors } from '../../constants/colors';
import { useCartStore } from '../../store/useCartStore';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Cart'>;

export const CartScreen: React.FC<Props> = ({ navigation }) => {
  const restaurant = useCartStore((s) => s.restaurant);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const subtotal = useCartStore((s) => s.getSubtotal());

  if (items.length === 0 || !restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<Ionicons name="cart-outline" size={64} color={colors.textMuted} />}
          title="Giỏ hàng trống"
          description="Hãy chọn món ăn yêu thích từ các nhà hàng xung quanh bạn."
          actionTitle="Khám phá ngay"
          onAction={() => navigation.navigate('MainTabs', { screen: 'HomeTab' })}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Nhà Hàng */}
      <View style={styles.restaurantHeader}>
        <View style={styles.restaurantInfo}>
          <Text style={styles.orderFromLabel}>Đơn hàng từ</Text>
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
        </View>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearCartText}>Xóa tất cả</Text>
        </TouchableOpacity>
      </View>

      {/* Danh Sách Món Đã Chọn */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.menuItem.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onIncrease={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
            onDecrease={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
          />
        )}
      />

      {/* Footer Thanh Toán */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tạm tính</Text>
          <Text style={styles.summaryValue}>{formatVND(subtotal)}</Text>
        </View>

        <Button
          title="Tiến hành đặt hàng"
          onPress={() => navigation.navigate('Checkout')}
          style={styles.checkoutButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  restaurantInfo: { flex: 1 },
  orderFromLabel: { fontSize: 12, color: colors.textMuted },
  restaurantName: { fontSize: 16, fontWeight: '700', color: colors.text },
  clearCartText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  list: { padding: 16 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 15, color: colors.textSecondary },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  checkoutButton: { width: '100%' },
});

