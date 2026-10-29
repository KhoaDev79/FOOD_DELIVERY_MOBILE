import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { Restaurant } from '../../types/api';
import { Card } from '../common/Card';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress: () => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, onPress }) => {
  return (
    <Card onPress={onPress} style={styles.card}>
      <Image
        source={{
          uri:
            restaurant.imageUrl ||
            'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
        }}
        style={styles.image}
      />
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
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.infoText}>
              {restaurant.distanceKm !== undefined ? `${restaurant.distanceKm} km` : restaurant.address}
            </Text>
          </View>

          <Text style={[styles.statusText, restaurant.isOpen ? styles.open : styles.closed]}>
            {restaurant.isOpen ? 'Đang mở cửa' : 'Đã đóng cửa'}
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
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.borderLight,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
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

