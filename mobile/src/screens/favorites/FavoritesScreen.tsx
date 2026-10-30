import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { memo } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import {
  AppImage,
  Button,
  cn,
  EmptyState,
  Icon,
  IconButton,
  TabHeader,
  TAB_BAR_CLEARANCE,
  Text,
  useToast,
} from '../../components/ui';
import { usersApi } from '../../api/users';
import { useAuthStore } from '../../store/useAuthStore';
import { FavoriteRestaurant, useFavoritesStore } from '../../store/useFavoritesStore';
import { RootStackParamList } from '../../types/navigation';

const FavoriteRow = memo<{
  item: FavoriteRestaurant;
  onOpen: (id: string) => void;
  onRemove: (item: FavoriteRestaurant) => void;
}>(({ item, onOpen, onRemove }) => {
  const rating =
    item.rating > 0
      ? item.rating.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : null;
  return (
    // Nút tim là phần tử ngang hàng (không lồng trong nút của thẻ).
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[item.name, rating && `${rating} sao`, item.address].filter(Boolean).join(', ')}
        onPress={() => onOpen(item.id)}
        className="flex-row gap-3 rounded-lg border border-brand-100 bg-surface p-3 pr-14 shadow-card hover:border-brand-400 hover:bg-brand-50 active:bg-brand-100"
      >
        <AppImage uri={item.imageUrl} className="h-20 w-20 rounded-md" fallbackIcon="storefront-outline" />
        <View className="flex-1 justify-center gap-1">
          <Text variant="body-lg" weight="semibold" numberOfLines={2}>
            {item.name}
          </Text>
          {rating && (
            <View className="flex-row items-center gap-1">
              <Icon name="star" size="xs" tone="rating" />
              <Text variant="caption" weight="medium">
                {rating}
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-1">
            <Icon name="location-outline" size={12} tone="brand" />
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
              {item.address}
            </Text>
          </View>
        </View>
      </Pressable>
      <IconButton
        icon="heart"
        tone="danger"
        variant="ghost"
        accessibilityLabel={`Bỏ ${item.name} khỏi yêu thích`}
        className="absolute right-2 top-2"
        onPress={() => onRemove(item)}
      />
    </View>
  );
});
FavoriteRow.displayName = 'FavoriteRow';

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const toast = useToast();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const restaurants = useFavoritesStore((s) => s.restaurants);
  const remove = useFavoritesStore((s) => s.remove);
  const toggle = useFavoritesStore((s) => s.toggle);

  const openRestaurant = (id: string) => navigation.navigate('RestaurantDetail', { restaurantId: id });
  const onRemove = (item: FavoriteRestaurant) => {
    remove(item.id);
    toast(`Đã bỏ ${item.name} khỏi yêu thích`);
    usersApi.removeFavorite(item.id).catch(() => {
      toggle(item); // hoàn tác
      toast('Không bỏ được yêu thích, vui lòng thử lại', 'error');
    });
  };
  const goHome = () => navigation.navigate('MainTabs', { screen: 'HomeTab' });

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Góc khoái khẩu"
        subtitle={restaurants.length > 0 ? `${restaurants.length} quán yêu thích` : 'Lưu lại những quán ruột của bạn'}
      />
      {!isAuthenticated ? (
        // Yêu thích gắn với tài khoản: chưa đăng nhập thì mời đăng nhập
        <View className="gap-4 px-4 pt-4">
          <EmptyState
            variant="card"
            icon="heart-outline"
            title="Đăng nhập để lưu quán yêu thích"
            description="Danh sách yêu thích được lưu theo tài khoản, dùng được trên mọi thiết bị của bạn."
          />
          <Button label="Đăng nhập" leftIcon="log-in-outline" onPress={() => navigation.navigate('Login')} />
          <Button label="Khám phá quán ngon" variant="secondary" leftIcon="compass-outline" onPress={goHome} />
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(r) => r.id}
          contentContainerClassName={cn('flex-grow gap-3 px-4 pt-4', TAB_BAR_CLEARANCE)}
          ListHeaderComponent={
            restaurants.length > 0 ? (
              <View className="flex-row items-center gap-1.5 pb-1">
                <Icon name="heart" size="sm" tone="danger" />
                <Text variant="headline">Yêu thích</Text>
                <Text variant="body" tone="secondary">
                  · {restaurants.length} quán
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => <FavoriteRow item={item} onOpen={openRestaurant} onRemove={onRemove} />}
          ListEmptyComponent={
            // Trạng thái rỗng theo ảnh mẫu "Góc khoái khẩu".
            <View className="gap-4">
              <EmptyState
                variant="card"
                icon="heart-outline"
                title="Chưa có quán nào trong bộ sưu tập"
                description="Chạm vào biểu tượng trái tim ở trang quán để thêm vài quán ruột vào đây nhé!"
              />
              <View className="gap-0.5">
                <Text variant="headline">Yêu thích</Text>
                <Text variant="body" tone="secondary">
                  0 quán
                </Text>
              </View>
              <Button label="Khám phá quán ngon" variant="secondary" leftIcon="compass-outline" onPress={goHome} />
            </View>
          }
        />
      )}
    </View>
  );
};
