import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantsApi } from '../../api/restaurants';
import { RestaurantRow } from '../../components/modules/restaurant/RestaurantCards';
import { AppImage, EmptyState, Icon, LoadingSpinner, Skeleton, Text } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocation } from '../../hooks/useLocation';
import { useNearbyRestaurants, usePopularSearches } from '../../services/useRestaurants';
import { useAddresses } from '../../services/useUser';
import { resolveActiveDeliveryAddress, useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
import { useSearchHistoryStore } from '../../store/useSearchHistoryStore';
import { Restaurant } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { palette } from '../../theme';

type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

/** Từ khoá tìm nhanh theo loại món phổ biến (không phải số liệu thịnh hành, không gắn với thương hiệu cụ thể). */
const POPULAR_SUGGESTIONS = ['Cơm tấm', 'Phở', 'Bún bò', 'Gà rán', 'Trà sữa', 'Bánh mì', 'Cà phê', 'Pizza'];

/** Thẻ quán ăn dạng lưới 3 cột theo thiết kế mẫu */
const RecommendedRestaurantCard: React.FC<{
  restaurant: Restaurant;
  onPress: () => void;
}> = ({ restaurant, onPress }) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quán ${restaurant.name}`}
      onPress={onPress}
      className="flex-1 active:opacity-75"
    >
      {/* Khung ảnh vuông với rating badge */}
      <View
        style={{ aspectRatio: 1 }}
        className="relative w-full overflow-hidden rounded-2xl border border-line/40 bg-canvas-subtle shadow-card"
      >
        <AppImage
          uri={restaurant.imageUrl}
          className="h-full w-full"
          resizeMode="cover"
          fallbackIcon="restaurant-outline"
        >
          <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5">
            {restaurant.rating ? <Icon name="star" size={10} tone="rating" /> : null}
            <Text variant="micro" weight="bold" tone="inverse">
              {restaurant.rating ? restaurant.rating.toFixed(1) : 'Mới'}
            </Text>
          </View>
        </AppImage>
      </View>

      {/* Tên quán + Tích xanh xác minh */}
      <View className="mt-2 flex-row items-start gap-1">
        <Icon name="checkmark-circle" size={14} tone="brand" style={{ marginTop: 2 }} />
        <Text
          variant="caption"
          weight="bold"
          numberOfLines={2}
          className="flex-1 text-ink"
        >
          {restaurant.name}
        </Text>
      </View>

      {/* Khoảng cách */}
      {restaurant.distanceKm != null && (
        <View className="mt-1 flex-row items-center gap-1">
          <Icon name="bicycle-outline" size={12} tone="secondary" />
          <Text variant="micro" tone="secondary">
            {`${restaurant.distanceKm.toFixed(1)} km`}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<SearchScreenRouteProp>();
  const { coords } = useLocation();
  const { data: addresses } = useAddresses();
  const selectedAddressId = useDeliveryAddressStore((s) => s.selectedAddressId);

  const addressResolution = resolveActiveDeliveryAddress(addresses, selectedAddressId, coords);
  const activeLat = addressResolution.roundedCoords?.latitude ?? null;
  const activeLng = addressResolution.roundedCoords?.longitude ?? null;
  const hasActiveCoords = activeLat !== null && activeLng !== null;

  const [searchQuery, setSearchQuery] = useState(route.params?.initialQuery || '');
  const [openOnly, setOpenOnly] = useState(false);

  const history = useSearchHistoryStore((s) => s.history);
  const loadHistory = useSearchHistoryStore((s) => s.loadHistory);
  const addSearchQuery = useSearchHistoryStore((s) => s.addSearchQuery);
  const removeSearchQuery = useSearchHistoryStore((s) => s.removeSearchQuery);
  const clearHistory = useSearchHistoryStore((s) => s.clearHistory);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const { data: popularData } = usePopularSearches();
  const popularSuggestions = popularData && popularData.length > 0 ? popularData : POPULAR_SUGGESTIONS;

  const handleSelectQuery = (q: string) => {
    setSearchQuery(q);
    addSearchQuery(q);
    restaurantsApi.logSearch(q).catch(() => {});
  };

  const debouncedQuery = useDebounce(searchQuery, 350);
  const isSearching = debouncedQuery.trim().length > 0;

  // Lấy danh sách quán gợi ý khi chưa tìm kiếm
  const { data: recommendedData, isLoading: isRecommendedLoading } = useNearbyRestaurants({
    lat: activeLat,
    lng: activeLng,
    radiusKm: 20,
    limit: 12,
  });

  // Lấy kết quả tìm kiếm khi người dùng đã nhập từ khoá
  const { data: searchData, isLoading: isSearchLoading } = useNearbyRestaurants({
    lat: activeLat,
    lng: activeLng,
    q: isSearching ? debouncedQuery.trim() : undefined,
    openOnly,
    radiusKm: 20,
  });

  const recommendedRestaurants = recommendedData?.items || [];
  const searchResults = searchData?.items || [];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }} className="flex-1 bg-surface">
      {/* Header tìm kiếm */}
      <View className="flex-row items-center gap-2.5 border-b border-line bg-surface px-4 py-3">
        {/* Nút quay lại */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          className="p-1 -ml-1 active:opacity-70"
        >
          <Icon name="arrow-back" size={24} tone="default" />
        </Pressable>

        {/* Ô nhập từ khoá */}
        <View className="flex-1 flex-row items-center rounded-xl border border-line bg-canvas-subtle px-3 py-2">
          <Icon name="search-outline" size={18} tone="muted" />
          <TextInput
            className="flex-1 ml-2 font-body text-body text-ink p-0"
            placeholder="Bạn đang tìm kiếm món gì?"
            placeholderTextColor={palette.ink.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                handleSelectQuery(searchQuery.trim());
              }
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa từ khóa"
              onPress={() => setSearchQuery('')}
              className="p-1 active:opacity-70"
            >
              <Icon name="close-circle" size={18} tone="muted" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Nội dung màn hình */}
      {!hasActiveCoords ? (
        <View className="flex-1 justify-center p-4">
          <EmptyState
            icon="location-outline"
            title="Chọn địa chỉ giao hàng để xem quán quanh bạn"
            description="Vui lòng chọn địa chỉ giao hàng hoặc bật định vị để tìm kiếm quán ăn quanh bạn."
            actionLabel="Chọn địa chỉ giao hàng"
            onAction={() => navigation.navigate('AddressManagement')}
          />
        </View>
      ) : isSearching ? (
        // ================= KẾT QUẢ TÌM KIẾM =================
        <View className="flex-1">
          {/* Bộ lọc đang mở cửa */}
          <View className="flex-row px-4 pt-3 pb-1">
            <Pressable
              className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-75 ${
                openOnly ? 'bg-brand-500' : 'border border-line bg-canvas-subtle'
              }`}
              onPress={() => setOpenOnly(!openOnly)}
            >
              <Icon
                name={openOnly ? 'checkmark-circle' : 'time-outline'}
                size={16}
                color={openOnly ? palette.surface : palette.ink.secondary}
              />
              <Text
                variant="caption"
                weight="semibold"
                className={openOnly ? 'text-ink-inverse' : 'text-ink-secondary'}
              >
                Đang mở cửa
              </Text>
            </Pressable>
          </View>

          {isSearchLoading ? (
            <LoadingSpinner message="Đang tìm kiếm..." />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              contentContainerClassName="p-4 gap-3"
              renderItem={({ item }) => (
                <RestaurantRow
                  restaurant={item}
                  onPress={() => {
                    if (searchQuery.trim()) {
                      handleSelectQuery(searchQuery.trim());
                    }
                    navigation.navigate('RestaurantDetail', { restaurantId: item.id });
                  }}
                />
              )}
              ListEmptyComponent={
                <EmptyState
                  icon="search-outline"
                  title="Không tìm thấy kết quả"
                  description={`Không có quán hoặc món nào khớp "${debouncedQuery}". Thử từ khoá khác (có thể gõ không dấu) hoặc tắt bộ lọc "Đang mở cửa".`}
                />
              }
            />
          )}
        </View>
      ) : (
        // ================= GIAO DIỆN GỢI Ý (LỊCH SỬ TÌM KIẾM + XU HƯỚNG + ĐỀ XUẤT) =================
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4 pb-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mục 1: Lịch sử tìm kiếm gần đây */}
          {history.length > 0 && (
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text variant="headline" weight="bold">
                  Tìm kiếm gần đây
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa toàn bộ lịch sử tìm kiếm"
                  onPress={clearHistory}
                  hitSlop={8}
                  className="active:opacity-60"
                >
                  <Text variant="caption" weight="medium" tone="brand">
                    Xóa tất cả
                  </Text>
                </Pressable>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {history.map((item) => (
                  <View
                    key={item}
                    className="flex-row items-center gap-1.5 rounded-full border border-line bg-canvas-subtle pl-3 pr-2 py-1.5"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Tìm lại ${item}`}
                      onPress={() => handleSelectQuery(item)}
                      className="flex-row items-center gap-1.5 active:opacity-70"
                    >
                      <Icon name="time-outline" size={14} tone="muted" />
                      <Text variant="body" weight="medium">
                        {item}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa ${item}`}
                      onPress={() => removeSearchQuery(item)}
                      hitSlop={6}
                      className="p-0.5 active:opacity-60"
                    >
                      <Icon name="close" size={14} tone="muted" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Mục 2: Xu hướng tìm kiếm (Dữ liệu động từ API) */}
          <View className="mb-6">
            <View className="flex-row items-center gap-1.5 mb-3">
              <Icon name="flame" size={18} color="#EA580C" />
              <Text variant="headline" weight="bold">
                Xu hướng tìm kiếm
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2.5">
              {popularSuggestions.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Gợi ý ${item}`}
                  onPress={() => handleSelectQuery(item)}
                  className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 active:bg-canvas-subtle"
                >
                  <Icon name="trending-up" size={15} tone="warning" />
                  <Text variant="body" weight="medium">
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Mục 3: Có thể bạn sẽ thích */}
          <Text variant="headline" weight="bold" className="mb-3.5">
            Có thể bạn sẽ thích
          </Text>

          {isRecommendedLoading ? (
            <View className="gap-3">
              {Array.from({ length: 2 }).map((_, rowIdx) => (
                <View key={rowIdx} className="flex-row gap-2.5">
                  {Array.from({ length: 3 }).map((_, colIdx) => (
                    <View key={colIdx} className="flex-1 gap-2">
                      <View style={{ aspectRatio: 1 }} className="w-full">
                        <Skeleton className="h-full w-full rounded-2xl" />
                      </View>
                      <Skeleton className="h-4 w-3/4 rounded-md" />
                      <Skeleton className="h-3 w-1/2 rounded-md" />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View className="gap-3">
              {Array.from({ length: Math.ceil(recommendedRestaurants.length / 3) }).map((_, rowIdx) => {
                const rowItems = recommendedRestaurants.slice(rowIdx * 3, rowIdx * 3 + 3);
                return (
                  <View key={rowIdx} className="flex-row gap-2.5">
                    {rowItems.map((restaurant) => (
                      <RecommendedRestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        onPress={() =>
                          navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })
                        }
                      />
                    ))}
                    {rowItems.length < 3 &&
                      Array.from({ length: 3 - rowItems.length }).map((_, padIdx) => (
                        <View key={`pad-${padIdx}`} className="flex-1" />
                      ))}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
