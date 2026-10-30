import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RestaurantCardVertical,
  RestaurantRow,
  RestaurantTile,
} from '../../components/modules/restaurant/RestaurantCards';
import {
  AppImage,
  Button,
  cn,
  EmptyState,
  ErrorState,
  Gradient,
  Icon,
  RestaurantRowSkeleton,
  SearchBar,
  SectionHeader,
  Skeleton,
  TAB_BAR_CLEARANCE,
  Text,
  TileSkeleton,
} from '../../components/ui';
import { HOME_CATEGORIES, HomeCategory } from '../../constants/homeCategories';
import { useLocation } from '../../hooks/useLocation';
import { useNearbyRestaurants } from '../../services/useRestaurants';
import { useAddresses } from '../../services/useUser';
import { palette } from '../../theme';
import { Restaurant } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { buildHomeSections, filterRestaurants } from '../../utils/homeSections';

const COORD_LIKE = /^(t[oọ][aạ]\s*đ[oộ]|[-+]?\d+\.\d+)/i;
/** Cuộn quá mức này thì hiện thanh tìm kiếm gọn dính trên cùng (ảnh mẫu 3–6). */
const COMPACT_THRESHOLD = 120;

/* ------------------------------ Mảnh giao diện ------------------------------ */

const CategoryTile: React.FC<{ item: HomeCategory; selected: boolean; onPress: () => void }> = ({
  item,
  selected,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Danh mục ${item.label}`}
    accessibilityState={{ selected }}
    onPress={onPress}
    className={cn(
      'h-32 w-24 overflow-hidden rounded-md border active:opacity-80',
      selected ? 'border-brand-500 bg-brand-50' : 'border-line-subtle bg-canvas-subtle',
    )}
  >
    <Text
      variant="body"
      weight={selected ? 'semibold' : 'medium'}
      tone={selected ? 'brand' : 'default'}
      numberOfLines={2}
      className="px-2.5 pt-2"
    >
      {item.label}
    </Text>
    <AppImage
      uri={item.image}
      className="absolute -bottom-2 -right-2 h-16 w-16 rounded-full"
      fallbackIcon="fast-food-outline"
    />
  </Pressable>
);

const RailSkeleton: React.FC = () => (
  <View className="gap-3 py-4">
    <View className="gap-2 px-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-28" />
    </View>
    <View className="flex-row gap-3 px-4">
      <TileSkeleton />
      <TileSkeleton />
      <TileSkeleton />
    </View>
  </View>
);

/* --------------------------------- Màn chính -------------------------------- */

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { coords, isLoading: locationLoading } = useLocation();
  const { data: addresses } = useAddresses();
  const [streetName, setStreetName] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [compact, setCompact] = useState(false);

  // Giữ nguyên logic cũ: lấy tên đường từ vị trí GPS hiện tại.
  useEffect(() => {
    let isMounted = true;
    async function resolveCurrentAddress() {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
        if (results && results.length > 0 && isMounted) {
          const item = results[0];
          const parts = [item.name || item.streetNumber, item.street, item.subregion || item.district]
            .filter(Boolean)
            .join(' ');
          setStreetName(parts || `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`);
        }
      } catch {
        // Không lấy được tên đường: giữ nhãn mặc định.
      }
    }
    if (coords && coords.latitude) resolveCurrentAddress();
    return () => {
      isMounted = false;
    };
  }, [coords]);

  const activeAddress = addresses?.find((a) => a.isDefault) || addresses?.[0];
  let displayAddress = 'Vị trí hiện tại (TP.HCM)';
  if (activeAddress?.addressLine && !COORD_LIKE.test(activeAddress.addressLine)) {
    displayAddress = activeAddress.addressLine;
  } else if (streetName && !COORD_LIKE.test(streetName)) {
    displayAddress = streetName;
  }

  const { data, isLoading, isError, refetch } = useNearbyRestaurants({
    lat: coords.latitude,
    lng: coords.longitude,
    radiusKm: 15,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const category = HOME_CATEGORIES.find((c) => c.id === categoryId) ?? null;
  const isFiltering = !!searchFilter.trim() || !!category;
  const allRestaurants = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(
    () => filterRestaurants(allRestaurants, searchFilter, category?.keywords ?? []),
    [allRestaurants, searchFilter, category],
  );
  const sections = useMemo(() => buildHomeSections(allRestaurants), [allRestaurants]);
  const listData = isFiltering ? filtered : sections.rest;
  const expanded = data as (typeof data & { isExpandedRadius?: boolean; notice?: string }) | undefined;

  const openRestaurant = useCallback(
    (r: Restaurant) => navigation.navigate('RestaurantDetail', { restaurantId: r.id }),
    [navigation],
  );
  const openAddresses = () => navigation.navigate('AddressManagement');
  const clearFilters = () => {
    setSearchFilter('');
    setCategoryId(null);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > COMPACT_THRESHOLD;
    if (next !== compact) setCompact(next);
  };

  const loading = isLoading || locationLoading;

  const header = (
    <View>
      {/* Đầu trang gradient: dòng Giao đến + thanh tìm kiếm lớn (ảnh mẫu 1) */}
      <Gradient preset="header">
        <SafeAreaView edges={['top']}>
          <View className="gap-4 px-4 pb-6 pt-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Giao đến ${displayAddress}. Đổi địa chỉ`}
              onPress={openAddresses}
              className="min-h-touch flex-row items-center gap-2 active:opacity-70"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-scrim">
                <Icon name="location" size="md" tone="inverse" />
              </View>
              <View className="flex-1">
                <Text variant="caption" weight="regular" tone="inverse" className="opacity-80">
                  Giao đến
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text variant="headline" tone="inverse" numberOfLines={1} className="flex-shrink">
                    {displayAddress}
                  </Text>
                  <Icon name="chevron-down" size="md" tone="inverse" />
                </View>
              </View>
            </Pressable>
            <SearchBar
              size="lg"
              value={searchFilter}
              onChangeText={setSearchFilter}
              onClear={() => setSearchFilter('')}
            />
          </View>
        </SafeAreaView>
      </Gradient>

      {/* Lối tắt danh mục (ảnh mẫu 1) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4 pb-2">
        {HOME_CATEGORIES.map((c) => (
          <CategoryTile
            key={c.id}
            item={c}
            selected={c.id === categoryId}
            onPress={() => setCategoryId((id) => (id === c.id ? null : c.id))}
          />
        ))}
      </ScrollView>

      {expanded?.isExpandedRadius && (
        <View className="mx-4 mt-3 flex-row items-start gap-2 rounded-md bg-warning-soft p-3">
          <Icon name="information-circle" size="md" tone="accent" />
          <Text variant="body" tone="warning" className="flex-1">
            {expanded.notice || 'Đang hiển thị các quán gần vị trí của bạn nhất.'}
          </Text>
        </View>
      )}

      {loading ? (
        <>
          <RailSkeleton />
          <View className="gap-3 bg-canvas-subtle px-4 pt-6">
            <Skeleton className="h-6 w-36" />
            <RestaurantRowSkeleton />
            <RestaurantRowSkeleton />
          </View>
        </>
      ) : isError ? null : isFiltering ? (
        <View className="flex-row items-center justify-between gap-3 bg-canvas-subtle px-4 pb-3 pt-6">
          <Text variant="title" className="flex-1" numberOfLines={1}>
            {filtered.length > 0 ? `${filtered.length} quán phù hợp` : 'Kết quả tìm kiếm'}
          </Text>
          <Button label="Xoá lọc" variant="ghost" size="sm" leftIcon="close" onPress={clearFilters} />
        </View>
      ) : (
        <>
          {/* Khối ô vuông: đánh giá cao (ảnh mẫu 3, 4) */}
          {sections.topRated.length > 0 && (
            <View className="gap-3 pt-6">
              <SectionHeader
                title="Đánh giá cao"
                subtitle="Quán được chấm điểm cao gần bạn"
                icon="star"
                iconTone="rating"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
                {sections.topRated.map((r) => (
                  <RestaurantTile key={r.id} restaurant={r} onPress={openRestaurant} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Khối thẻ dọc trên nền gradient (ảnh mẫu 5) */}
          {sections.nearest.length > 0 && (
            <Gradient preset="sectionBrand" className="mt-6 gap-3 pb-6 pt-5">
              <SectionHeader
                title="Giao nhanh"
                subtitle="Gần bạn nhất, giao trong ít phút"
                icon="flash"
                iconTone="brand"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
                {sections.nearest.map((r) => (
                  <RestaurantCardVertical key={r.id} restaurant={r} onPress={openRestaurant} />
                ))}
              </ScrollView>
            </Gradient>
          )}

          {/* Danh sách quán gần (ảnh mẫu 6) */}
          {sections.rest.length > 0 && (
            <View className="gap-0.5 bg-canvas-subtle px-4 pb-3 pt-6">
              <View className="flex-row items-center gap-1.5">
                <Icon name="location" size="md" tone="danger" />
                <Text variant="title" accessibilityRole="header">
                  Quán gần tôi
                </Text>
              </View>
              <Text variant="body" tone="secondary">
                Sắp xếp theo khoảng cách từ vị trí của bạn
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      {isFocused && <StatusBar style={compact ? 'dark' : 'light'} />}
      <FlatList
        data={loading || isError ? [] : listData}
        keyExtractor={(item) => item.id}
        className="flex-1 bg-canvas-subtle"
        contentContainerClassName={cn('flex-grow', TAB_BAR_CLEARANCE)}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={<View className="bg-canvas">{header}</View>}
        renderItem={({ item }) => (
          <View className="px-4">
            <RestaurantRow restaurant={item} onPress={openRestaurant} />
          </View>
        )}
        ListEmptyComponent={
          loading ? undefined : isError ? (
            <ErrorState onRetry={onRefresh} className="bg-canvas" />
          ) : (
            <EmptyState
              icon={isFiltering ? 'search-outline' : 'restaurant-outline'}
              title={isFiltering ? 'Không tìm thấy quán phù hợp' : 'Chưa có quán nào quanh đây'}
              description={
                isFiltering
                  ? 'Thử từ khoá khác hoặc bỏ lọc danh mục.'
                  : 'Thử đổi địa chỉ giao hàng hoặc kéo xuống để tải lại.'
              }
              actionLabel={isFiltering ? 'Xoá bộ lọc' : 'Đổi địa chỉ'}
              onAction={isFiltering ? clearFilters : openAddresses}
              className="bg-canvas-subtle pt-4"
            />
          )
        }
        onScroll={onScroll}
        scrollEventThrottle={32}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.ink.inverse}
            colors={[palette.brand['500']]}
          />
        }
        initialNumToRender={6}
        windowSize={7}
      />

      {/* Thanh tìm kiếm gọn khi cuộn (ảnh mẫu 3–6) */}
      {compact && (
        <Animated.View
          entering={FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
          exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
          className="absolute left-0 right-0 top-0 bg-canvas shadow-card"
        >
          <SafeAreaView edges={['top']}>
            <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
              <SearchBar
                className="flex-1"
                value={searchFilter}
                onChangeText={setSearchFilter}
                onClear={() => setSearchFilter('')}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
};
