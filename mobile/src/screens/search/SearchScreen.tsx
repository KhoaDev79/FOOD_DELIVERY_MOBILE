import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestaurantRow } from '../../components/modules/restaurant/RestaurantCards';
import { AppImage, EmptyState, LoadingSpinner, Skeleton, Text } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocation } from '../../hooks/useLocation';
import { useNearbyRestaurants } from '../../services/useRestaurants';
import { Restaurant } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';

type SearchScreenRouteProp = RouteProp<RootStackParamList, 'Search'>;

/** Các từ khoá gợi ý thịnh hành */
const POPULAR_SUGGESTIONS = [
  'Gà rán',
  'Trà Sữa',
  'Bún Bò Huế',
  'Phê La',
  'Bún Đậu',
  'Phúc Long',
];

/** Thẻ quán ăn dạng lưới 3 cột theo thiết kế mẫu */
const RecommendedRestaurantCard: React.FC<{
  restaurant: Restaurant;
  itemWidth: number;
  onPress: () => void;
}> = ({ restaurant, itemWidth, onPress }) => {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quán ${restaurant.name}`}
      onPress={onPress}
      style={{ width: itemWidth }}
      className="active:opacity-75"
    >
      {/* Khung ảnh vuông với rating badge */}
      <View
        style={{ width: itemWidth, height: itemWidth }}
        className="relative overflow-hidden rounded-2xl border border-line/40 bg-canvas-subtle shadow-card"
      >
        <AppImage
          uri={restaurant.imageUrl}
          className="h-full w-full"
          resizeMode="cover"
          fallbackIcon="restaurant-outline"
        >
          <View className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5">
            <Ionicons name="star" size={10} color="#FFC107" />
            <Text className="text-[11px] font-bold text-white">
              {restaurant.rating ? restaurant.rating.toFixed(1) : '4.8'}
            </Text>
          </View>
        </AppImage>
      </View>

      {/* Tên quán + Tích xanh xác minh */}
      <View className="mt-2 flex-row items-start gap-1">
        <Ionicons name="checkmark-circle" size={14} color="#00BCD4" style={{ marginTop: 2 }} />
        <Text
          variant="caption"
          weight="bold"
          numberOfLines={2}
          className="flex-1 text-[13px] leading-[17px] text-ink"
        >
          {restaurant.name}
        </Text>
      </View>

      {/* Khoảng cách */}
      <View className="mt-1 flex-row items-center gap-1">
        <Ionicons name="bicycle-outline" size={12} color="#6B6F76" />
        <Text variant="caption" tone="secondary" className="text-[11px] text-ink-secondary">
          {restaurant.distanceKm != null ? `${restaurant.distanceKm.toFixed(1)} km` : '1.0 km'}
        </Text>
      </View>
    </Pressable>
  );
};

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<SearchScreenRouteProp>();
  const { coords } = useLocation();
  const { width: screenWidth } = useWindowDimensions();

  // Chiều rộng mỗi thẻ quán trong lưới 3 cột (trừ lề 16px mỗi bên và khoảng cách giữa 3 cột 10px)
  const itemWidth = Math.floor((screenWidth - 32 - 20) / 3);

  const [searchQuery, setSearchQuery] = useState(route.params?.initialQuery || '');
  const [openOnly, setOpenOnly] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 350);
  const isSearching = debouncedQuery.trim().length > 0;

  // Lấy danh sách quán gợi ý khi chưa tìm kiếm
  const { data: recommendedData, isLoading: isRecommendedLoading } = useNearbyRestaurants({
    lat: coords.latitude,
    lng: coords.longitude,
    radiusKm: 20,
    limit: 12,
  });

  // Lấy kết quả tìm kiếm khi người dùng đã nhập từ khoá
  const { data: searchData, isLoading: isSearchLoading } = useNearbyRestaurants({
    lat: coords.latitude,
    lng: coords.longitude,
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
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </Pressable>

        {/* Ô nhập từ khoá */}
        <View className="flex-1 flex-row items-center rounded-xl border border-line bg-canvas-subtle px-3 py-2">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-2 text-[15px] text-ink p-0"
            placeholder="Bạn đang tìm kiếm món gì?"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa từ khóa"
              onPress={() => setSearchQuery('')}
              className="p-1 active:opacity-70"
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Nội dung màn hình */}
      {isSearching ? (
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
              <Ionicons
                name={openOnly ? 'checkmark-circle' : 'time-outline'}
                size={16}
                color={openOnly ? '#FFFFFF' : '#6B6F76'}
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
                  onPress={() =>
                    navigation.navigate('RestaurantDetail', { restaurantId: item.id })
                  }
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
        // ================= GIAO DIỆN GỢI Ý (ĐỀ XUẤT CHO BẠN + CÓ THỂ BẠN SẼ THÍCH) =================
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4 pb-8"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mục 1: Đề xuất cho bạn */}
          <Text variant="title" weight="bold" className="text-[17px] text-ink font-bold">
            Đề xuất cho bạn
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2.5">
            {POPULAR_SUGGESTIONS.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Gợi ý ${item}`}
                onPress={() => setSearchQuery(item)}
                className="flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 active:bg-canvas-subtle"
              >
                <Ionicons name="trending-up" size={15} color="#F59E0B" />
                <Text variant="body" weight="medium" className="text-[14px] text-ink">
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Mục 2: Có thể bạn sẽ thích */}
          <Text variant="title" weight="bold" className="mt-6 mb-3.5 text-[17px] text-ink font-bold">
            Có thể bạn sẽ thích
          </Text>

          {isRecommendedLoading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <View key={idx} style={{ width: itemWidth }} className="gap-2">
                  <View style={{ width: itemWidth, height: itemWidth }}>
                    <Skeleton className="h-full w-full rounded-2xl" />
                  </View>
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {recommendedRestaurants.map((restaurant) => (
                <RecommendedRestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  itemWidth={itemWidth}
                  onPress={() =>
                    navigation.navigate('RestaurantDetail', { restaurantId: restaurant.id })
                  }
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
