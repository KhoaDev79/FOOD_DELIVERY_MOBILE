import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/colors';
import { Restaurant } from '../../types/api';
import { estimateDeliveryTime, isFreeDelivery } from '../../utils/fee';
import { AppImage } from '../common/AppImage';
import { Card } from '../common/Card';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const deliveryTime = estimateDeliveryTime(restaurant.distanceKm);
  const freeship = isFreeDelivery(restaurant.distanceKm || 1.5, {
    estimatedDeliveryFee: restaurant.estimatedDeliveryFee,
  });

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.imageContainer}>
        <AppImage
          uri={restaurant.imageUrl}
          style={styles.image}
          fallbackTitle={restaurant.name}
          fallbackIcon="restaurant-outline"
        />

        {/* Nút yêu thích ở góc ảnh */}
        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favButton}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? '#EE4D2D' : colors.white}
            />
          </TouchableOpacity>
        )}

        {/* Nhãn Freeship chỉ hiển thị khi thỏa mãn điều kiện */}
        {freeship && (
          <View style={styles.freeshipBadge}>
            <Text style={styles.freeshipText}>Freeship</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color={colors.rating} />
            <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
          </View>
        </View>

        {restaurant.description && (
          <Text style={styles.description} numberOfLines={1}>
            {restaurant.description}
          </Text>
        )}

        <View style={styles.footerRow}>
          <View style={styles.infoGroup}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={styles.infoText}>{deliveryTime}</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <View style={styles.infoItem}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.infoText}>
                {restaurant.distanceKm !== undefined ? `${restaurant.distanceKm} km` : restaurant.address}
              </Text>
            </View>
          </View>

          <Text style={[styles.statusText, restaurant.isOpen ? styles.open : styles.closed]}>
            {restaurant.isOpen ? 'Mở cửa' : 'Đã đóng'}
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 14,
    borderRadius: 12,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
    backgroundColor: colors.borderLight,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  favButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  freeshipBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  freeshipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  content: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  infoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  infoText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  open: { color: colors.success },
  closed: { color: colors.danger },
});
