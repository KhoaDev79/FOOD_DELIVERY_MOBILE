import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RestaurantCard } from '../../components/modules/RestaurantCard';
import { colors } from '../../constants/colors';
import { useLocation } from '../../hooks/useLocation';
import { useNearbyRestaurants } from '../../services/useRestaurants';
import { useAddresses } from '../../services/useUser';
import { useCartStore } from '../../store/useCartStore';
import { Restaurant } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

const CATEGORIES = [
  { id: 'cat-1', name: 'Cơm ngon', icon: 'restaurant-outline', bg: '#FFF0ED' },
  { id: 'cat-2', name: 'Trà sữa', icon: 'cafe-outline', bg: '#EFF6FF' },
  { id: 'cat-3', name: 'Gà rán', icon: 'fast-food-outline', bg: '#FEF3C7' },
  { id: 'cat-4', name: 'Bún phở', icon: 'nutrition-outline', bg: '#ECFDF5' },
  { id: 'cat-5', name: 'Healthy', icon: 'leaf-outline', bg: '#F5F3FF' },
];

const COLLECTIONS = [
  {
    id: 'col-1',
    title: 'FREESHIP',
    subtitle: 'Đơn từ 0Đ',
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300',
  },
  {
    id: 'col-2',
    title: 'DEAL 1K',
    subtitle: 'Trưa nay ăn gì',
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=300',
  },
  {
    id: 'col-3',
    title: 'GẦN BẠN',
    subtitle: 'Giao siêu tốc',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300',
  },
  {
    id: 'col-4',
    title: 'PHỔ BIẾN',
    subtitle: 'Đánh giá 4.9★',
    imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300',
  },
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { coords, isLoading: locationLoading } = useLocation();
  const { data: addresses } = useAddresses();
  const [streetName, setStreetName] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Tự động Reverse Geocode lấy tên đường vị trí GPS hiện tại
  useEffect(() => {
    let isMounted = true;
    async function resolveCurrentAddress() {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (results && results.length > 0 && isMounted) {
          const item = results[0];
          const parts = [item.name || item.streetNumber, item.street, item.subregion || item.district]
            .filter(Boolean)
            .join(' ');
          setStreetName(parts || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
        }
      } catch {
        // Fallback
      }
    }
    if (coords && coords.latitude) {
      resolveCurrentAddress();
    }
    return () => {
      isMounted = false;
    };
  }, [coords]);

  const activeAddress = addresses?.find((a) => a.isDefault) || addresses?.[0];
  let displayAddress = 'Vị trí hiện tại (TP.HCM)';
  if (activeAddress?.addressLine && !/^(t[oọ][aạ]\s*đ[oộ]|[-+]?\d+\.\d+)/i.test(activeAddress.addressLine)) {
    displayAddress = activeAddress.addressLine;
  } else if (streetName && !/^(t[oọ][aạ]\s*đ[oộ]|[-+]?\d+\.\d+)/i.test(streetName)) {
    displayAddress = streetName;
  }

  const { data, isLoading, refetch } = useNearbyRestaurants({
    lat: coords.latitude,
    lng: coords.longitude,
    radiusKm: 15,
  });

  const cartTotalItems = useCartStore((s) => s.getTotalItems());
  const cartSubtotal = useCartStore((s) => s.getSubtotal());

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const restaurants = (data?.items || []).filter((r) =>
    r.name.toLowerCase().includes(searchFilter.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar Location & Cart Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.locationContainer}
          onPress={() => navigation.navigate('AddressManagement')}
          activeOpacity={0.7}
        >
          <Ionicons name="location-sharp" size={20} color="#EE4D2D" />
          <View style={styles.locationTextContainer}>
            <Text style={styles.deliverToLabel}>Giao đến:</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {displayAddress}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#EE4D2D" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.cartIconBadge} onPress={() => navigation.navigate('Cart')}>
          <Ionicons name="cart-outline" size={24} color={colors.text} />
          {cartTotalItems > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartTotalItems}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Main List & Feed (Trang 1) */}
      {isLoading || locationLoading ? (
        <LoadingSpinner message="Đang tìm nhà hàng quanh bạn..." />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EE4D2D']} />
          }
          ListHeaderComponent={
            <>
              {/* Search Bar Trang 1 */}
              <View style={styles.searchBarBox}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  placeholder="Tìm món ngon, trà sữa, quán ăn gần bạn..."
                  placeholderTextColor={colors.textMuted}
                  value={searchFilter}
                  onChangeText={setSearchFilter}
                  style={styles.searchInput}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Banner Carousel Trang 1 */}
              <View style={styles.bannerWrap}>
                <Image
                  source={{
                    uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
                  }}
                  style={styles.bannerImage}
                />
                <View style={styles.bannerOverlay}>
                  <View style={styles.bannerTagBadge}>
                    <Text style={styles.bannerTagText}>DEAL HÔM NAY</Text>
                  </View>
                  <Text style={styles.bannerTitle}>Tiệc Deal 1K • Freeship tận tay</Text>
                  <Text style={styles.bannerSubtitle}>Áp dụng cho mọi đơn từ 50.000đ</Text>
                </View>
              </View>

              {/* Circular Categories (Trang 1) */}
              <View style={styles.categoriesSection}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryItem}
                    onPress={() => setSearchFilter(cat.name === 'Cơm ngon' ? 'cơm' : cat.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.categoryCircle, { backgroundColor: cat.bg }]}>
                      <Ionicons name={cat.icon as any} size={22} color="#EE4D2D" />
                    </View>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Voucher Bar (Trang 1) */}
              <TouchableOpacity
                style={styles.voucherBar}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('VoucherSelect', {})}
              >
                <View style={styles.voucherLeft}>
                  <Text style={styles.voucherIcon}>🎁</Text>
                  <Text style={styles.voucherText}>Bạn có 4 mã giảm giá đang sẵn sàng</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#EE4D2D" />
              </TouchableOpacity>

              {/* Collections 2x2 Grid (Trang 1) */}
              <View style={styles.collectionsSection}>
                <Text style={styles.sectionHeading}>Bộ sưu tập nổi bật</Text>
                <View style={styles.collectionGrid}>
                  {COLLECTIONS.map((col) => (
                    <TouchableOpacity
                      key={col.id}
                      style={styles.collectionCard}
                      activeOpacity={0.8}
                      onPress={() => setSearchFilter(col.title === 'GẦN BẠN' ? '' : col.title)}
                    >
                      <Image source={{ uri: col.imageUrl }} style={styles.collectionImg} />
                      <View style={styles.collectionOverlay}>
                        <Text style={styles.colTitle}>{col.title}</Text>
                        <Text style={styles.colSub}>{col.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Gợi ý món ngon (Recommended for you - Trang 1) */}
              {restaurants.length > 0 && (
                <View style={styles.recommendedWrap}>
                  <View style={styles.recomHeader}>
                    <Text style={styles.sectionHeading}>Gợi ý cho bạn</Text>
                    <TouchableOpacity onPress={() => setSearchFilter('')}>
                      <Text style={styles.seeAllText}>Xem tất cả</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
                    {restaurants.slice(0, 4).map((r: Restaurant) => (
                      <TouchableOpacity
                        key={r.id}
                        style={styles.recomCard}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: r.id })}
                      >
                        <Image
                          source={{
                            uri:
                              r.imageUrl ||
                              'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
                          }}
                          style={styles.recomImg}
                        />
                        <View style={styles.recomBody}>
                          <Text style={styles.recomName} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <View style={styles.recomMeta}>
                            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                            <Text style={styles.recomTime}>15-20 phút</Text>
                            <Text style={styles.dot}>•</Text>
                            <Ionicons name="star" size={12} color="#F59E0B" />
                            <Text style={styles.recomStar}>{r.rating.toFixed(1)}</Text>
                          </View>
                          <View style={styles.recomBadge}>
                            <Text style={styles.recomBadgeText}>Freeship</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.sectionHeading, { marginTop: 16, marginBottom: 8 }]}>
                Quán ngon quanh bạn ({restaurants.length})
              </Text>
              {(data as any)?.isExpandedRadius && (
                <View style={styles.expandedNoticeBox}>
                  <Ionicons name="information-circle-sharp" size={18} color="#EA580C" />
                  <Text style={styles.expandedNoticeText}>
                    {(data as any)?.notice || 'Đang hiển thị các quán gần vị trí của bạn nhất.'}
                  </Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <RestaurantCard
              restaurant={item}
              onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />}
              title="Không tìm thấy quán nào"
              description="Thử tìm kiếm với từ khoá khác hoặc kéo xuống để tải lại danh sách."
              actionTitle="Tải lại"
              onAction={onRefresh}
            />
          }
        />
      )}

      {/* Sticky Floating Cart Bar khi giỏ có đồ */}
      {cartTotalItems > 0 && (
        <TouchableOpacity
          style={styles.floatingCart}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.floatingBadge}>
              <Text style={styles.floatingBadgeText}>{cartTotalItems}</Text>
            </View>
            <Text style={styles.floatingCartText}>Xem giỏ hàng</Text>
          </View>
          <Text style={styles.floatingPrice}>{formatVND(cartSubtotal)}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  locationContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  locationTextContainer: { marginLeft: 8, flex: 1 },
  deliverToLabel: { fontSize: 11, color: colors.textMuted },
  locationText: { fontSize: 14, fontWeight: '700', color: colors.text },
  cartIconBadge: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EE4D2D',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  list: { padding: 14, paddingBottom: 90 },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text },
  bannerWrap: {
    position: 'relative',
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 14,
    justifyContent: 'flex-end',
  },
  bannerTagBadge: {
    backgroundColor: '#EE4D2D',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  bannerTagText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  bannerTitle: { color: colors.white, fontSize: 16, fontWeight: '800' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  categoriesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  categoryItem: { alignItems: 'center', width: '20%' },
  categoryCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryName: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  voucherBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF0ED',
    borderWidth: 1,
    borderColor: '#FFD9D0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  voucherLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  voucherIcon: { fontSize: 16 },
  voucherText: { fontSize: 13, fontWeight: '700', color: '#EE4D2D' },
  collectionsSection: { marginBottom: 14 },
  sectionHeading: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 10 },
  collectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  collectionCard: {
    width: '48.5%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  collectionImg: { width: '100%', height: '100%' },
  collectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    justifyContent: 'flex-end',
  },
  colTitle: { color: colors.white, fontSize: 13, fontWeight: '800' },
  colSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  recommendedWrap: { marginBottom: 14 },
  recomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seeAllText: { fontSize: 13, color: '#EE4D2D', fontWeight: '700' },
  recomCard: {
    width: 150,
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  recomImg: { width: '100%', height: 95, backgroundColor: '#E5E7EB' },
  recomBody: { padding: 8 },
  recomName: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 2 },
  recomMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  recomTime: { fontSize: 11, color: colors.textMuted },
  dot: { color: colors.textMuted },
  recomStar: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  recomBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recomBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '700' },
  floatingCart: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#EE4D2D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    shadowColor: '#EE4D2D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingCartLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatingBadge: {
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  floatingBadgeText: { color: '#EE4D2D', fontWeight: '800', fontSize: 13 },
  floatingCartText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  floatingPrice: { color: colors.white, fontSize: 16, fontWeight: '800' },
  expandedNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  expandedNoticeText: {
    fontSize: 12,
    color: '#EA580C',
    fontWeight: '600',
    flex: 1,
  },
});
