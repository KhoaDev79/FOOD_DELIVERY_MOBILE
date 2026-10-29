import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from '../../components/common/Card';
import { colors } from '../../constants/colors';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

interface FavoriteRestaurant {
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  deliveryTime: string;
  tags: string[];
}

interface FavoriteDish {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  imageUrl: string;
  price: number;
  rating: number;
}

const INITIAL_RESTAURANTS: FavoriteRestaurant[] = [
  {
    id: 'rest-1',
    name: 'Bamsu Restaurant',
    imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
    rating: 4.8,
    deliveryTime: '20-25 phút',
    tags: ['Freeship', 'Gần bạn', 'Deal 1k'],
  },
  {
    id: 'rest-2',
    name: "B'Fresh Coffee & Tea",
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500',
    rating: 4.6,
    deliveryTime: '15-20 phút',
    tags: ['Freeship', 'Trà sữa'],
  },
  {
    id: 'rest-3',
    name: 'Hana Fried Chicken',
    imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500',
    rating: 4.9,
    deliveryTime: '25-30 phút',
    tags: ['Gà rán giòn', 'Giảm 25%'],
  },
];

const INITIAL_DISHES: FavoriteDish[] = [
  {
    id: 'dish-1',
    restaurantId: 'rest-1',
    restaurantName: 'Bamsu Restaurant',
    name: 'Bánh Mì Kẹp Gà Nướng Sốt Phô Mai',
    imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
    price: 45000,
    rating: 4.9,
  },
  {
    id: 'dish-2',
    restaurantId: 'rest-2',
    restaurantName: "B'Fresh Coffee",
    name: 'Trà Dâu Tươi Thảo Mộc',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
    price: 38000,
    rating: 4.8,
  },
  {
    id: 'dish-3',
    restaurantId: 'rest-3',
    restaurantName: 'Hana Chicken',
    name: 'Combo Gà Giòn Cay Sốt Hàn',
    imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=500',
    price: 69000,
    rating: 4.9,
  },
];

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeTab, setActiveTab] = useState<'restaurants' | 'dishes'>('restaurants');
  const [restaurants, setRestaurants] = useState<FavoriteRestaurant[]>(INITIAL_RESTAURANTS);
  const [dishes, setDishes] = useState<FavoriteDish[]>(INITIAL_DISHES);

  const handleRemoveRestaurant = (id: string) => {
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRemoveDish = (id: string) => {
    setDishes((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mục yêu thích</Text>
        <View style={styles.badgeCount}>
          <Text style={styles.badgeCountText}>{restaurants.length + dishes.length}</Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'restaurants' && styles.tabButtonActive]}
          onPress={() => setActiveTab('restaurants')}
        >
          <Ionicons
            name="storefront"
            size={16}
            color={activeTab === 'restaurants' ? '#EE4D2D' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'restaurants' && styles.tabTextActive]}>
            Quán ăn ({restaurants.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'dishes' && styles.tabButtonActive]}
          onPress={() => setActiveTab('dishes')}
        >
          <Ionicons
            name="fast-food"
            size={16}
            color={activeTab === 'dishes' ? '#EE4D2D' : colors.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'dishes' && styles.tabTextActive]}>
            Món ăn ({dishes.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'restaurants' ? (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <TouchableOpacity
                style={styles.cardRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.restImage} />
                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveRestaurant(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="heart" size={22} color="#EE4D2D" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.metaRow}>
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    <Text style={styles.dot}>•</Text>
                    <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.timeText}>{item.deliveryTime}</Text>
                  </View>

                  <View style={styles.tagRow}>
                    {item.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={dishes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <TouchableOpacity
                style={styles.cardRow}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.restaurantId })}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.dishImage} />
                <View style={styles.cardInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveDish(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="heart" size={22} color="#EE4D2D" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.dishRestName}>{item.restaurantName}</Text>

                  <View style={styles.dishBottomRow}>
                    <Text style={styles.dishPrice}>{formatVND(item.price)}</Text>
                    <View style={styles.orderSmallBtn}>
                      <Ionicons name="cart-outline" size={14} color={colors.white} />
                      <Text style={styles.orderSmallText}>Đặt món</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  badgeCount: {
    backgroundColor: '#FFF0ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeCountText: { color: '#EE4D2D', fontSize: 12, fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabButtonActive: {
    backgroundColor: '#FFF0ED',
    borderWidth: 1,
    borderColor: '#EE4D2D',
  },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: '#EE4D2D', fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 30 },
  card: { padding: 12, marginBottom: 12, borderRadius: 12 },
  cardRow: { flexDirection: 'row', gap: 12 },
  restImage: { width: 84, height: 84, borderRadius: 10, backgroundColor: '#E5E7EB' },
  dishImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#E5E7EB' },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '700', color: colors.text },
  dot: { color: colors.textMuted },
  timeText: { fontSize: 12, color: colors.textMuted },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  tagBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  dishRestName: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dishBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  dishPrice: { fontSize: 15, fontWeight: '800', color: '#EE4D2D' },
  orderSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EE4D2D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  orderSmallText: { color: colors.white, fontSize: 12, fontWeight: '700' },
});

