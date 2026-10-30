import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/colors';
import { MenuItem } from '../../types/api';
import { formatVND } from '../../utils/format';
import { AppImage } from '../common/AppImage';

interface MenuItemRowProps {
  item: MenuItem;
  onAdd: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const MenuItemRow: React.FC<MenuItemRowProps> = ({
  item,
  onAdd,
  isFavorite,
  onToggleFavorite,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name}</Text>
          {onToggleFavorite && (
            <TouchableOpacity
              onPress={onToggleFavorite}
              style={styles.favBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? '#EE4D2D' : colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatVND(item.price)}</Text>
        </View>
      </View>

      <View style={styles.imageWrapper}>
        <AppImage
          uri={item.imageUrl}
          style={styles.image}
          fallbackTitle={item.name}
          fallbackIcon="fast-food-outline"
        />

        <TouchableOpacity
          style={[styles.addButton, !item.isAvailable && styles.disabledButton]}
          onPress={onAdd}
          disabled={!item.isAvailable}
        >
          <Ionicons name="add" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    alignItems: 'center',
  },
  info: {
    flex: 1,
    paddingRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  favBtn: {
    paddingLeft: 6,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EE4D2D',
  },
  originalPrice: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  imageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  addButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#EE4D2D',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: colors.textMuted,
  },
});
