import { NotificationBell } from '../../components/modules/notifications/NotificationBell';
import { mapsApi } from '../../api/maps';
import { isCoordinateAddressString } from '../../store/useAddressDraftStore';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BannerCarousel, BannerSkeleton } from '../../components/modules/home/BannerCarousel';
import { FeaturedVoucherStrip } from '../../components/modules/voucher/FeaturedVoucherStrip';
import { useAuthStore } from '../../store/useAuthStore';
import { DishCard, DishTile } from '../../components/modules/home/DishCard';
import { FeaturedCarousel } from '../../components/modules/home/FeaturedCarousel';
import { HomePromoModal } from '../../components/modules/home/HomePromoModal';
import { RestaurantRow } from '../../components/modules/restaurant/RestaurantCards';
import {
  AppImage,
  Button,
  cn,
  ConfirmDialog,
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
  useToast,
} from '../../components/ui';
import { HomeCategory, mapCuisinesToHomeCategories } from '../../constants/homeCategories';
import { useLocation } from '../../hooks/useLocation';
import {
  useBanners,
  useCuisines,
  useNearbyDishes,
  useNearbyRestaurants,
} from '../../services/useRestaurants';
import { useAddresses } from '../../services/useUser';
import { palette } from '../../theme';
import { useCartStore } from '../../store/useCartStore';
import { resolveActiveDeliveryAddress, useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
import { useTabBarStore } from '../../store/useTabBarStore';
import { Banner, MenuItem, NearbyDish, Restaurant } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { filterRestaurants, pickFeatured, sortByDistance } from '../../utils/homeSections';
import { hasChoices } from '../../utils/menuPricing';

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
    className="w-20 items-center gap-1.5 active:opacity-70"
  >
    {/* Ảnh tròn + nhãn dưới (ảnh mẫu 7). Vòng màu thương hiệu khi đang chọn. */}
    <View
      className={cn(
        'h-[68px] w-[68px] items-center justify-center rounded-full border-2',
        selected ? 'border-brand-500' : 'border-transparent',
      )}
    >
      <AppImage uri={item.image} className="h-16 w-16 rounded-full shadow-raised" fallbackIcon="fast-food-outline" />
    </View>
    <Text
      variant="caption"
      weight={selected ? 'semibold' : 'medium'}
      tone={selected ? 'brand' : 'default'}
      numberOfLines={2}
      className="text-center"
    >
      {item.label}
    </Text>
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

/** Tách món (kèm thông tin quán) thành dữ liệu cho giỏ hàng. */
const toCartPayload = (d: NearbyDish) => {
  const { restaurant, ...item } = d;
  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      imageUrl: restaurant.imageUrl,
      latitude: restaurant.latitude,
      longitude: restaurant.longitude,
    },
    item: item as MenuItem,
  };
};

/* --------------------------------- Màn chính -------------------------------- */

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const flatListRef = useRef<FlatList>(null);
  const { coords, isLoading: locationLoading } = useLocation();
  const { data: addresses } = useAddresses();
  const selectedAddressId = useDeliveryAddressStore((s) => s.selectedAddressId);
  const isAddrInitialized = useDeliveryAddressStore((s) => s.isInitialized);
  const loadSavedSelection = useDeliveryAddressStore((s) => s.loadSavedSelection);
  const [streetName, setStreetName] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [compact, setCompact] = useState(false);

  // Modal quảng cáo tự động
  const [promoVisible, setPromoVisible] = useState(false);
  const hasTriggeredPromo = useRef(false);

  // Điều khiển thanh tab ẩn/hiện theo thao tác cuộn
  const lastScrollY = useRef(0);
  const scrollStopTimer = useRef<NodeJS.Timeout | null>(null);
  const setTabBarVisible = useTabBarStore((s) => s.setVisible);

  // Khôi phục hiển thị thanh tab khi rời màn hình hoặc unmount
  useEffect(() => {
    if (!isFocused) {
      setTabBarVisible(true);
    }
    return () => {
      setTabBarVisible(true);
      if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    };
  }, [isFocused, setTabBarVisible]);

  useEffect(() => {
    if (!isAddrInitialized) {
      loadSavedSelection();
    }
  }, [isAddrInitialized, loadSavedSelection]);

  // Lấy tên đường từ vị trí GPS hiện tại (nếu có cấp quyền GPS)
  useEffect(() => {
    let isMounted = true;
    async function resolveCurrentAddress() {
      if (!coords) return;
      try {
        // Ưu tiên backend (Goong): chạy được cả trên web. expo-location trên web dùng API Google đã ngừng (SDK 49).
        const data = await mapsApi.reverseGeocode(coords.latitude, coords.longitude).catch(() => null);
        const firstPart = data?.addressLine?.split(',')[0]?.trim();
        if (firstPart && !isCoordinateAddressString(data!.addressLine)) {
          if (isMounted) setStreetName(firstPart);
          return;
        }
        if (Platform.OS === 'web') return;
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (results && results.length > 0 && isMounted) {
          const item = results[0];
          const parts = [item.name || item.streetNumber, item.street, item.subregion || item.district]
            .filter(Boolean)
            .join(' ');
          setStreetName(parts || '');
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

  // Nguồn địa chỉ giao hàng duy nhất (Single Source of Truth)
  const addressResolution = useMemo(
    () => resolveActiveDeliveryAddress(addresses, selectedAddressId, coords, streetName),
    [addresses, selectedAddressId, coords, streetName],
  );
  const displayAddress = addressResolution.displayText;
  const activeLat = addressResolution.roundedCoords?.latitude ?? null;
  const activeLng = addressResolution.roundedCoords?.longitude ?? null;
  const hasActiveCoords = activeLat !== null && activeLng !== null;

  const { data, isLoading, isError, refetch } = useNearbyRestaurants({
    lat: activeLat,
    lng: activeLng,
    radiusKm: 15,
  });

  const bannersQuery = useBanners();
  const dishesQuery = useNearbyDishes({
    lat: activeLat,
    lng: activeLng,
    radiusKm: 15,
    limit: 20,
  });

  const cuisinesQuery = useCuisines();
  const { refetch: refetchBanners } = bannersQuery;
  const { refetch: refetchDishes } = dishesQuery;
  const { refetch: refetchCuisines } = cuisinesQuery;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBanners(), refetchDishes(), refetchCuisines()]);
    setRefreshing(false);
  }, [refetch, refetchBanners, refetchDishes, refetchCuisines]);

  const categories = useMemo(
    () => mapCuisinesToHomeCategories(cuisinesQuery.data),
    [cuisinesQuery.data],
  );

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const isFiltering = !!searchFilter.trim() || !!category;
  const allRestaurants = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(
    () => filterRestaurants(allRestaurants, searchFilter, category?.keywords ?? []),
    [allRestaurants, searchFilter, category],
  );
  // Quán điểm cao lên khối "Quán được yêu thích"; danh sách bên dưới không lặp lại các quán đó.
  const { featured, rest: nearbyList } = useMemo(
    () => pickFeatured(sortByDistance(allRestaurants), 5),
    [allRestaurants],
  );
  const listData = isFiltering ? filtered : nearbyList;

  const banners = bannersQuery.data ?? [];
  const dishes = useMemo(() => dishesQuery.data?.items ?? [], [dishesQuery.data]);
  // Hai khối món, mỗi món chỉ xuất hiện một lần.
  const dishesNear = dishes.slice(0, 12);
  const dishesMore = dishes.slice(12, 20);
  // Lưới 2 hàng: ghép từng cặp món thành một cột.
  const nearColumns = Array.from({ length: Math.ceil(dishesNear.length / 2) }, (_, i) =>
    dishesNear.slice(i * 2, i * 2 + 2),
  );

  const toast = useToast();
  const addItem = useCartStore((s) => s.addItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const [pendingDish, setPendingDish] = useState<NearbyDish | null>(null);

  // Nếu món có tuỳ chọn (size, topping...), điều hướng vào quán và mở bảng chọn thay vì thêm thẳng.
  const addDish = (d: NearbyDish) => {
    if (hasChoices(d)) {
      navigation.navigate('RestaurantDetail', {
        restaurantId: d.restaurant.id,
        openDishId: d.id,
      });
      return;
    }
    const { restaurant, item } = toCartPayload(d);
    if (addItem(restaurant, item) === 'DIFFERENT_RESTAURANT') setPendingDish(d);
    else toast(`Đã thêm ${d.name} vào giỏ`, 'success');
  };
  const confirmNewCart = () => {
    if (!pendingDish) return;
    const { restaurant, item } = toCartPayload(pendingDish);
    clearCart();
    addItem(restaurant, item);
    toast(`Đã tạo giỏ mới với ${pendingDish.name}`, 'success');
    setPendingDish(null);
  };
  const openDish = useCallback(
    (d: NearbyDish) =>
      navigation.navigate('RestaurantDetail', {
        restaurantId: d.restaurant.id,
        openDishId: d.id,
      }),
    [navigation],
  );
  // Hành động khi bấm banner (quản trị viên cấu hình): mở quán, chọn danh mục, hoặc mở tìm kiếm
  const openBanner = (b: Banner) => {
    if (!b.actionValue) return;
    if (b.actionType === 'RESTAURANT') {
      navigation.navigate('RestaurantDetail', { restaurantId: b.actionValue });
    } else if (b.actionType === 'CUISINE') {
      setCategoryId(b.actionValue);
    } else if (b.actionType === 'SEARCH') {
      navigation.navigate('Search', { initialQuery: b.actionValue });
    }
  };
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

  const loading = isLoading || locationLoading;

  // Khi màn hình khởi động xong, các món ăn load xong 2.8s -> hiển thị modal quảng cáo
  useEffect(() => {
    if (isFocused && !loading && dishes.length > 0 && !hasTriggeredPromo.current) {
      hasTriggeredPromo.current = true;
      const timer = setTimeout(() => {
        setPromoVisible(true);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [isFocused, loading, dishes.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    lastScrollY.current = currentY;

    // 1. Cập nhật compact search bar
    const next = currentY > COMPACT_THRESHOLD;
    if (next !== compact) setCompact(next);

    // 2. Kéo xuống thì tạm ẩn thanh tab; kéo lên thì hiện lại
    if (currentY <= 15) {
      setTabBarVisible(true);
    } else if (diff > 6 && currentY > 40) {
      setTabBarVisible(false);
    } else if (diff < -6) {
      setTabBarVisible(true);
    }

    // 3. Khi màn hình dừng lại thì tự động hiện lại thanh tab
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    scrollStopTimer.current = setTimeout(() => {
      setTabBarVisible(true);
    }, 250);
  };

  const onScrollEnd = () => {
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    setTabBarVisible(true);
  };

  const handlePromoAction = () => {
    setPromoVisible(false);
    toast('Ưu đãi Combo Bánh Su Kem 25K! Khám phá ngay các món ngon gần bạn');
    // Cuộn mượt đến các khối món ngon ưu đãi
    flatListRef.current?.scrollToOffset({ offset: 340, animated: true });
  };

  const header = (
    <View>
      {/* Đầu trang gradient: dòng Giao đến + thanh tìm kiếm lớn (ảnh mẫu 1) */}
      <Gradient preset="header">
        <SafeAreaView edges={['top']}>
          <View className="gap-3 px-4 pb-4 pt-2">
            <View className="min-h-touch flex-row items-center gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Giao đến ${displayAddress}. Đổi địa chỉ`}
                onPress={openAddresses}
                className="min-h-touch flex-1 flex-row items-center gap-2 active:opacity-70"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-scrim">
                  <Icon name="location" size="md" tone="inverse" />
                </View>
                <View className="flex-1">
                  {/* Chữ trắng đậm, không làm trong suốt: nhãn nhỏ trên nền xanh cần đủ tương phản để đọc */}
                  <Text variant="caption" weight="semibold" tone="inverse">
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
              <NotificationBell tone="inverse" withBackground />
            </View>
            <SearchBar
              size="lg"
              placeholder="Bạn đang tìm kiếm món gì?"
              onPressAsButton={() => navigation.navigate('Search')}
            />
          </View>
        </SafeAreaView>

        {/* Lối tắt danh mục nằm ở phần gradient đã nhạt (ảnh mẫu 1, 7) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-3 pb-2">
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              item={c}
              selected={c.id === categoryId}
              onPress={() => setCategoryId((id) => (id === c.id ? null : c.id))}
            />
          ))}
        </ScrollView>
      </Gradient>

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
          <View className="gap-3 bg-brand-50 px-4 pt-6">
            <Skeleton className="h-6 w-36" />
            <RestaurantRowSkeleton />
            <RestaurantRowSkeleton />
          </View>
        </>
      ) : isError ? null : isFiltering ? (
        <View className="flex-row items-center justify-between gap-3 bg-brand-50 px-4 pb-3 pt-6">
          <Text variant="title" className="flex-1" numberOfLines={1}>
            {filtered.length > 0 ? `${filtered.length} quán phù hợp` : 'Kết quả tìm kiếm'}
          </Text>
          <Button label="Xoá lọc" variant="ghost" size="sm" leftIcon="close" onPress={clearFilters} />
        </View>
      ) : (
        <>
          {/* Banner tự chuyển (ảnh mẫu 1, 3) – dữ liệu từ GET /banners */}
          {bannersQuery.isLoading ? (
            <View className="pt-4">
              <BannerSkeleton />
            </View>
          ) : banners.length > 0 ? (
            <View className="pt-4">
              <BannerCarousel
                banners={banners}
                onPress={openBanner}
                canPress={(b) => !!b.actionValue && ['RESTAURANT', 'CUISINE', 'SEARCH'].includes(b.actionType ?? '')}
              />
            </View>
          ) : null}

          {/* Mã ưu đãi toàn sàn đang chạy */}
          <FeaturedVoucherStrip
            onOpenWallet={() =>
              navigation.navigate(useAuthStore.getState().isAuthenticated ? 'VoucherWallet' : 'Login')
            }
          />

          {/* Khối món ăn (ảnh mẫu 3) – dữ liệu từ GET /restaurants/nearby/dishes */}
          {dishesQuery.isLoading ? (
            <RailSkeleton />
          ) : (
            <>
              {/* Lưới 2 hàng cuộn ngang với dải tiêu đề gradient (ảnh mẫu "Gợi ý dành cho …") */}
              {dishesNear.length > 0 && (
                <View className="mt-6 pb-6">
                  <Gradient preset="sectionHeaderBand" className="pb-3 pt-5">
                    <SectionHeader title="Món ngon gần bạn" icon="restaurant" iconTone="accent" />
                  </Gradient>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="gap-3 px-4 pt-1"
                  >
                    {nearColumns.map((col) => (
                      <View key={col[0].id} className="gap-4">
                        {col.map((d) => (
                          <DishTile key={d.id} dish={d} onPress={openDish} />
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
              {/* Khối nổi bật kiểu "Giật Deal Sốc" (ảnh mẫu), dữ liệu: quán điểm cao nhất */}
              {featured.length > 0 && (
                <View className="pb-6">
                  <FeaturedCarousel title="Quán được yêu thích" restaurants={featured} onPress={openRestaurant} />
                </View>
              )}
              {dishesMore.length > 0 && (
                <Gradient preset="sectionAccent" className="gap-3 pb-6 pt-5">
                  <SectionHeader
                    title="Khám phá thêm món"
                    subtitle="Thêm lựa chọn cho bữa hôm nay"
                    icon="sparkles"
                    iconTone="accent"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
                    {dishesMore.map((d) => (
                      <DishCard key={d.id} dish={d} onPress={openDish} onAdd={addDish} />
                    ))}
                  </ScrollView>
                </Gradient>
              )}
            </>
          )}

          {/* Danh sách quán gần (ảnh mẫu 6) */}
          {nearbyList.length > 0 && (
            <Gradient preset="nearbyBand" className="gap-0.5 px-4 pb-4 pt-6">
              <View className="flex-row items-center gap-1.5">
                <Icon name="location" size="md" tone="danger" />
                <Text variant="title" accessibilityRole="header">
                  Quán gần tôi
                </Text>
              </View>
              <Text variant="body" tone="secondary">
                Sắp xếp theo khoảng cách từ vị trí của bạn
              </Text>
            </Gradient>
          )}
        </>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      {isFocused && <StatusBar style={compact ? 'dark' : 'light'} />}
      <FlatList
        ref={flatListRef}
        data={loading || isError ? [] : listData}
        keyExtractor={(item) => item.id}
        className="flex-1 bg-brand-50"
        contentContainerClassName={cn('flex-grow', TAB_BAR_CLEARANCE)}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={<View className="bg-canvas">{header}</View>}
        renderItem={({ item }) => (
          <View className="px-4">
            <RestaurantRow restaurant={item} onPress={openRestaurant} />
          </View>
        )}
        ListEmptyComponent={
          loading ? undefined : !hasActiveCoords ? (
            <EmptyState
              icon="location-outline"
              title="Chọn địa chỉ giao hàng để xem quán quanh bạn"
              description="Vui lòng chọn hoặc thêm địa chỉ giao hàng, hoặc bật định vị GPS để xem các quán ăn gần bạn."
              actionLabel="Chọn địa chỉ giao hàng"
              onAction={openAddresses}
              className="bg-brand-50 pt-4"
            />
          ) : isError ? (
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
              className="bg-brand-50 pt-4"
            />
          )
        }
        onScroll={onScroll}
        onScrollEndDrag={onScrollEnd}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
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

      <ConfirmDialog
        visible={!!pendingDish}
        title="Tạo giỏ hàng mới?"
        message="Giỏ hàng của bạn đang có món của nhà hàng khác. Bạn có muốn xóa giỏ cũ để thêm món của quán này?"
        confirmLabel="Tạo giỏ mới"
        cancelLabel="Hủy"
        destructive
        onCancel={() => setPendingDish(null)}
        onConfirm={confirmNewCart}
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
                placeholder="Bạn đang tìm kiếm món gì?"
                onPressAsButton={() => navigation.navigate('Search')}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      {/* Modal quảng cáo ưu đãi (tự động hiện sau khi tải món xong 2-5s) */}
      <HomePromoModal
        visible={promoVisible}
        onClose={() => setPromoVisible(false)}
        onAction={handlePromoAction}
      />
    </View>
  );
};
