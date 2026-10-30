import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/colors';
import { CartLineItem } from '../../store/useCartStore';
import { formatVND } from '../../utils/format';

interface CartItemProps {
  item: CartLineItem;
  onIncrease: () => void;
  onDecrease: () => void;
}

export const CartItem: React.FC<CartItemProps> = ({ item, onIncrease, onDecrease }) => {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.menuItem.name}</Text>
        <Text style={styles.price}>{formatVND(item.menuItem.price)}</Text>
        {item.note ? <Text style={styles.note}>Ghi chú: {item.note}</Text> : null}
      </View>

      <View style={styles.quantityControl}>
        <TouchableOpacity style={styles.button} onPress={onDecrease}>
          <Ionicons
            name={item.quantity === 1 ? 'trash-outline' : 'remove'}
            size={16}
            color={item.quantity === 1 ? colors.danger : colors.text}
          />
        </TouchableOpacity>

        <Text style={styles.quantity}>{item.quantity}</Text>

        <TouchableOpacity style={styles.button} onPress={onIncrease}>
          <Ionicons name="add" size={16} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    padding: 8,
  },
  quantity: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    minWidth: 28,
    textAlign: 'center',
  },
});

