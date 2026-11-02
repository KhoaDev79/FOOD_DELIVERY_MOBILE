import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantsApi } from '../../api/restaurants';
import { DishOptionSheet, DishSelection } from '../../components/modules/restaurant/DishOptionSheet';
import { DishPrice, DishRow } from '../../components/modules/restaurant/DishRow';
import {
  AppImage,
  Badge,
  Button,
  ConfirmDialog,
  ErrorState,
  FilterChip,
  Gradient,
  Icon,
  IconButton,
  Skeleton,
  Text,
  useToast,
} from '../../components/ui';
import { useLocation } from '../../hooks/useLocation';
import { useRestaurantDetail } from '../../services/useRestaurants';
import { useAddresses } from '../../services/useUser';
import { useCartStore } from '../../store/useCartStore';
import { resolveActiveDeliveryAddress, useDeliveryAddressStore } from '../../store/useDeliveryAddressStore';
import { useToggleFavorite } from '../../hooks/useFavorites';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { MenuItem, PublicRestaurantReview } from '../../types/api';
import { RootStackParamList } from '../../types/navigation';
import { calculateDistance, estimateDeliveryTime } from '../../utils/fee';
import { formatDateTime, formatDistance, formatVND } from '../../utils/format';
import { discountPercent, hasChoices, linePrice } from '../../utils/menuPricing';

type Props = NativeStackScreenProps<RootStackParamList, 'RestaurantDetail'>;

type PendingAdd = { item: MenuItem; sel?: DishSelection };

const MetaItem: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  tone?: 'brand' | 'rating';
}> = ({ icon, label, tone = 'brand' }) => (
  <View className="flex-row items-center gap-1">
    <Icon name={icon} size="xs" tone={tone} />
    <Text variant="caption" weight="medium" tone="secondary">
      {label}
    </Text>
  </View>
);

const DetailSkeleton: React.FC = () => (
  <View className="flex-1 bg-canvas-subtle">
    <Skeleton className="h-64 w-full rounded-none" />
    <View className="-mt-8 mx-4 gap-3 rounded-2xl bg-surface p-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </View>
    <View className="gap-3 p-4">
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </View>
  </View>
);

export const RestaurantDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { restaurantId, openDishId } = route.params;
  const { data: restaurant, isLoading, isError, refetch } = useRestaurantDetail(restaurantId);
  const { data: reviewsData } = useQuery({
    queryKey: ['restaurant-reviews', restaurantId],
    queryFn: () => restaurantsApi.getPublicReviews(restaurantId, { page: 1, limit: 10 }),
    enabled: Boolean(restaurantId),
  });
  const { coords } = useLocation();
  const { data: addresses } = useAddresses();
  const selectedAddressId = useDeliveryAddressStore((s) => s.selectedAddressId);
  const toast = useToast();

  const addItem = useCartStore((s) => s.addItem);
  const addCustomItem = useCartStore((s) => s.addCustomItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartRestaurantId = useCartStore((s) => s.restaurant?.id);
  const cartTotalItems = useCartStore((s) => s.getTotalItems());
  const cartSubtotal = useCartStore((s) => s.getSubtotal());

  const liked = useFavoritesStore((s) => s.restaurants.some((r) => r.id === restaurantId));
  const toggleFavorite = useToggleFavorite();

  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const sectionY = useRef<Record<string, number>>({});
  const autoOpenedRef = useRef<string | null>(null);

  const sections = useMemo(() => {
    if (!restaurant) return [];
    const list = (restaurant.categories ?? [])
      .filter((c) => (c.menuItems ?? []).length > 0)
      .map((c) => ({ id: c.id, name: c.name, items: c.menuItems }));
    if (restaurant.uncategorizedItems?.length) {
      list.push({ id: 'other', name: 'Món khác', items: restaurant.uncategorizedItems });
    }
    return list;
  }, [restaurant]);

  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const deals = useMemo(() => allItems.filter((i) => i.isAvailable && discountPercent(i) > 0), [allItems]);
  const priceRange = useMemo(() => {
    const prices = allItems.filter((i) => i.isAvailable).map((i) => linePrice(i));
    return prices.length ? [Math.min(...prices), Math.max(...prices)] : null;
  }, [allItems]);

  // Tự động mở bảng chọn tuỳ chọn khi điều hướng từ trang chủ vào đúng món
  useEffect(() => {
    if (!openDishId || autoOpenedRef.current === openDishId || allItems.length === 0) return;
    const target = allItems.find((i) => i.id === openDishId);
    if (target) {
      autoOpenedRef.current = openDishId;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(target);
    }
  }, [openDishId, allItems]);

  if (isLoading) return <DetailSkeleton />;
  if (isError || !restaurant) {
    return (
      <SafeAreaView className="flex-1 bg-canvas">
        <View className="px-2">
          <IconButton
            icon="arrow-back"
            variant="ghost"
            accessibilityLabel="Quay lại"
            onPress={() => navigation.goBack()}
          />
        </View>
        <ErrorState message="Không tải được thông tin quán. Vui lòng thử lại." onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const canOrder = restaurant.isOpen;
  // Nguồn địa chỉ giao hàng duy nhất (địa chỉ đã chọn -> mặc định -> GPS)
  const addressResolution = resolveActiveDeliveryAddress(addresses, selectedAddressId, coords);
  const distanceKm = addressResolution.coordinates
    ? calculateDistance(
        addressResolution.coordinates.latitude,
        addressResolution.coordinates.longitude,
        restaurant.latitude,
        restaurant.longitude,
      )
    : restaurant.distanceKm;
  // Theo vị trí hiện tại của khách: quán có giao tới không. Chỉ cảnh báo (không chặn), vì khách có thể
  // chọn địa chỉ giao khác ở bước thanh toán; backend kiểm tra lại bán kính khi đặt đơn.
  const outOfRange = distanceKm !== undefined && distanceKm > restaurant.deliveryRadiusKm;
  const rating =
    restaurant.rating > 0
      ? restaurant.rating.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : null;
  const cartRestaurant = {
    id: restaurant.id,
    name: restaurant.name,
    imageUrl: restaurant.imageUrl,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    address: restaurant.address,
    phone: restaurant.phone,
  };

  const commitAdd = ({ item, sel }: PendingAdd) => {
    const res = sel
      ? addCustomItem(cartRestaurant, item, sel.quantity, {
          sizeId: sel.sizeId,
          size: sel.sizeLabel,
          toppingIds: sel.toppingIds,
          toppings: sel.toppingLabels,
          level: sel.level,
          spiciness: sel.level,
          note: sel.note,
        })
      : addItem(cartRestaurant, item, 1);
    return res;
  };

  // Cùng quy tắc cũ: giỏ chỉ chứa món của một quán, hỏi trước khi tạo giỏ mới.
  const requestAdd = (req: PendingAdd) => {
    if (commitAdd(req) === 'DIFFERENT_RESTAURANT') {
      setPending(req);
      return;
    }
    setSelected(null);
    toast(`Đã thêm ${req.item.name} vào giỏ`, 'success');
  };

  const onQuickAdd = (item: MenuItem) => (hasChoices(item) ? setSelected(item) : requestAdd({ item }));

  const jumpTo = (id: string) => {
    setActiveCat(id);
    const y = sectionY.current[id];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const showCartBar = cartTotalItems > 0 && cartRestaurantId === restaurant.id;

  return (
    <View className="flex-1 bg-canvas-subtle">
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        contentContainerClassName={showCartBar ? 'pb-36' : 'pb-16'}
        contentContainerStyle={{ paddingBottom: showCartBar ? 140 : 80 }}
      >
        {/* Ảnh bìa + lớp tối để nút nổi luôn rõ */}
        <AppImage uri={restaurant.imageUrl} className="h-64 w-full" fallbackIcon="storefront-outline">
          <Gradient preset="imageScrim" className="absolute inset-0" />
          <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
            <View className="flex-row justify-between px-4 pt-2">
              <IconButton
                icon="arrow-back"
                variant="glass"
                accessibilityLabel="Quay lại"
                onPress={() => navigation.goBack()}
              />
              <IconButton
                icon={liked ? 'heart' : 'heart-outline'}
                tone={liked ? 'danger' : 'default'}
                variant="glass"
                accessibilityLabel={liked ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
                accessibilityState={{ selected: liked }}
                onPress={() => {
                  const nowLiked = toggleFavorite(restaurant);
                  if (nowLiked === null) return; // chưa đăng nhập: đã nhắc và chuyển sang Đăng nhập
                  toast(
                    nowLiked ? 'Đã thêm vào Góc khoái khẩu' : 'Đã bỏ khỏi yêu thích',
                    nowLiked ? 'success' : 'default',
                  );
                }}
              />
            </View>
          </SafeAreaView>
        </AppImage>

        {/* Thẻ thông tin quán nổi lên trên ảnh bìa */}
        <View className="-mt-10 mx-4 gap-3 rounded-2xl bg-surface p-4 shadow-float">
          <View className="flex-row items-start gap-2">
            <Text variant="title" className="flex-1" accessibilityRole="header">
              {restaurant.name}
            </Text>
            <Badge label={canOrder ? 'Đang mở' : 'Đã đóng'} tone={canOrder ? 'success' : 'danger'} />
          </View>
          {!!restaurant.description && (
            <Text variant="body" tone="secondary" numberOfLines={3}>
              {restaurant.description}
            </Text>
          )}
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            {rating && (
              <MetaItem
                icon="star"
                tone="rating"
                label={
                  restaurant.ratingCount ? `${rating} (${restaurant.ratingCount})` : rating
                }
              />
            )}
            {distanceKm !== undefined && (
              <MetaItem icon="navigate-outline" label={`Khoảng ${formatDistance(distanceKm) ?? ''}`} />
            )}
            {distanceKm !== undefined && <MetaItem icon="bicycle-outline" label={estimateDeliveryTime(distanceKm, true)} />}
            {restaurant.openTime && restaurant.closeTime && (
              <MetaItem icon="time-outline" label={`${restaurant.openTime} - ${restaurant.closeTime}`} />
            )}
            {priceRange && (
              <MetaItem
                icon="pricetag-outline"
                label={
                  priceRange[0] === priceRange[1]
                    ? formatVND(priceRange[0])
                    : `${formatVND(priceRange[0])} - ${formatVND(priceRange[1])}`
                }
              />
            )}
          </View>
          <View className="flex-row items-start gap-1.5 border-t border-line-subtle pt-3">
            <Icon name="location-outline" size="sm" tone="brand" />
            <Text variant="caption" weight="regular" tone="secondary" className="flex-1">
              {restaurant.address}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-md bg-brand-50 px-3 py-2">
            <Icon name="cube-outline" size="sm" tone="brand" />
            <Text variant="caption" weight="medium" tone="brand" className="flex-1">
              {restaurant.estimatedDeliveryFee !== undefined
                ? `Phí giao ước tính từ ${formatVND(restaurant.estimatedDeliveryFee)} · bán kính giao ${restaurant.deliveryRadiusKm} km`
                : `Bán kính giao hàng ${restaurant.deliveryRadiusKm} km (phí giao tính tại bước thanh toán)`}
            </Text>
          </View>
        </View>

        {!canOrder && (
          <View className="mx-4 mt-3 flex-row items-center gap-2 rounded-md bg-danger-soft p-3">
            <Icon name="moon-outline" size="md" tone="danger" />
            <Text variant="body" tone="danger" className="flex-1">
              Quán đang đóng cửa
              {restaurant.openTime && restaurant.closeTime
                ? ` (giờ mở cửa ${restaurant.openTime} – ${restaurant.closeTime})`
                : ''}
              . Bạn có thể xem thực đơn nhưng chưa thể đặt món.
            </Text>
          </View>
        )}

        {canOrder && outOfRange && (
          <View className="mx-4 mt-3 flex-row items-center gap-2.5 rounded-2xl border border-warning/30 bg-warning-soft/60 p-3.5 shadow-card">
            <Icon name="warning" size="md" tone="accent" />
            <View className="flex-1">
              <Text variant="body" weight="bold" tone="accent">
                Vị trí của bạn hiện nằm ngoài phạm vi giao hàng của quán ăn này
              </Text>
              <Text variant="caption" tone="secondary" className="mt-0.5">
                Quán chỉ giao trong bán kính {restaurant.deliveryRadiusKm} km (vị trí hiện tại của bạn cách {formatDistance(distanceKm)}). Hãy chọn địa chỉ giao gần quán hơn khi thanh toán.
              </Text>
            </View>
          </View>
        )}

        {/* Món đang giảm giá (dữ liệu thật: discountPrice) */}
        {deals.length > 0 && (
          <View className="gap-3 pt-6">
            <View className="flex-row items-center gap-1.5 px-4">
              <Icon name="pricetags" size="md" tone="accent" />
              <Text variant="title">Đang giảm giá</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
              {deals.map((item) => (
                <View key={item.id} className="w-36 gap-1.5">
                  <AppImage uri={item.imageUrl} className="h-36 w-36 rounded-lg" fallbackIcon="fast-food-outline">
                    <Badge
                      label={`-${discountPercent(item)}%`}
                      tone="discount"
                      size="sm"
                      className="absolute left-1.5 top-1.5"
                    />
                    {canOrder && (
                      <IconButton
                        icon="add"
                        variant="glass"
                        size="sm"
                        accessibilityLabel={`Thêm ${item.name}`}
                        className="absolute bottom-2 right-2"
                        onPress={() => onQuickAdd(item)}
                      />
                    )}
                  </AppImage>
                  <Text variant="body" weight="medium" numberOfLines={2} className="min-h-10">
                    {item.name}
                  </Text>
                  <DishPrice item={item} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Chuyển nhanh giữa các danh mục */}
        {sections.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pt-6">
            {sections.map((s) => (
              <FilterChip key={s.id} label={s.name} selected={activeCat === s.id} onPress={() => jumpTo(s.id)} />
            ))}
          </ScrollView>
        )}

        {sections.length === 0 ? (
          <View className="items-center gap-2 px-6 py-10">
            <Icon name="restaurant-outline" size={40} tone="muted" />
            <Text variant="headline">Quán chưa có món nào</Text>
            <Text variant="body" tone="secondary" className="text-center">
              Thực đơn đang được cập nhật, bạn quay lại sau nhé.
            </Text>
          </View>
        ) : (
          sections.map((s) => (
            <View
              key={s.id}
              className="gap-3 px-4 pt-6"
              onLayout={(e) => {
                sectionY.current[s.id] = e.nativeEvent.layout.y;
              }}
            >
              <View className="flex-row items-baseline gap-2">
                <Text variant="title" accessibilityRole="header">
                  {s.name}
                </Text>
                <Text variant="caption" weight="regular" tone="muted">
                  {s.items.length} món
                </Text>
              </View>
              {s.items.map((item) => (
                <DishRow key={item.id} item={item} canOrder={canOrder} onOpen={setSelected} onAdd={onQuickAdd} />
              ))}
            </View>
          ))
        )}

        {/* Đánh giá thực khách (E3) */}
        <View className="gap-3 px-4 pt-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Icon name="star" size="md" tone="rating" />
              <Text variant="title" accessibilityRole="header">
                Đánh giá thực khách
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              {reviewsData?.total ?? restaurant.ratingCount ?? 0} lượt đánh giá
            </Text>
          </View>

          {!reviewsData?.items?.length ? (
            <View className="items-center gap-1.5 rounded-xl bg-surface p-5 shadow-card">
              <Icon name="chatbubble-ellipses-outline" size="lg" tone="muted" />
              <Text variant="body" tone="secondary">
                Chưa có đánh giá nào cho quán này.
              </Text>
            </View>
          ) : (
            reviewsData.items.map((rv: PublicRestaurantReview) => (
              <View key={rv.id} className="gap-2 rounded-xl bg-surface p-4 shadow-card">
                <View className="flex-row items-center justify-between">
                  <Text variant="body" weight="semibold">
                    {rv.customerName}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    {Array.from({ length: 5 }, (_, idx) => (
                      <Icon
                        key={idx}
                        name={idx < rv.rating ? 'star' : 'star-outline'}
                        size="xs"
                        tone={idx < rv.rating ? 'rating' : 'muted'}
                      />
                    ))}
                  </View>
                </View>
                {!!rv.comment && (
                  <Text variant="body" tone="default">
                    {rv.comment}
                  </Text>
                )}
                <Text variant="micro" weight="regular" tone="muted">
                  {formatDateTime(rv.createdAt)}
                </Text>
                {!!rv.ownerReply && (
                  <View className="mt-1 gap-1 rounded-lg bg-canvas-subtle p-3">
                    <Text variant="caption" weight="semibold" tone="brand">
                      Phản hồi từ quán:
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {rv.ownerReply}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Thanh giỏ hàng nổi khi giỏ đang có món của quán này */}
      {showCartBar && (
        <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0">
          <View className="px-4 pb-3">
            <Button
              label={`Xem giỏ hàng · ${cartTotalItems} món · ${formatVND(cartSubtotal)}`}
              leftIcon="cart"
              onPress={() => navigation.navigate('Cart')}
              className="shadow-glow"
            />
          </View>
        </SafeAreaView>
      )}

      <DishOptionSheet
        // key theo món: mỗi món mở ra với lựa chọn mặc định của chính món đó
        key={selected?.id ?? 'none'}
        item={selected}
        canOrder={canOrder}
        onClose={() => setSelected(null)}
        onConfirm={(item, sel) => requestAdd({ item, sel })}
      />

      <ConfirmDialog
        visible={!!pending}
        title="Tạo giỏ hàng mới?"
        message="Giỏ hàng của bạn đang có món của nhà hàng khác. Bạn có muốn xóa giỏ cũ để thêm món của quán này?"
        confirmLabel="Tạo giỏ mới"
        cancelLabel="Hủy"
        destructive
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          clearCart();
          commitAdd(pending);
          toast(`Đã tạo giỏ mới với ${pending.item.name}`, 'success');
          setPending(null);
          setSelected(null);
        }}
      />
    </View>
  );
};
