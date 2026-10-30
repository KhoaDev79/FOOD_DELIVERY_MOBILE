import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  cn,
  ConfirmDialog,
  Divider,
  ListRow,
  Skeleton,
  TabHeader,
  TAB_BAR_CLEARANCE,
  Text,
} from '../../components/ui';
import { DevGallery } from '../../dev/DevGallery';
import { useMyOrders } from '../../services/useOrders';
import { useAddresses, useMe } from '../../services/useUser';
import { useAuthStore } from '../../store/useAuthStore';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { RootStackParamList } from '../../types/navigation';

/** Ô số liệu trong đầu trang. Hiện "—" khi chưa tải được, không hiện số giả. */
const Stat: React.FC<{ label: string; value?: number; onPress: () => void }> = ({ label, value, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value ?? 'chưa tải'}`}
    onPress={onPress}
    className="flex-1 items-center gap-0.5 rounded-md bg-surface/15 py-2.5 active:bg-surface/25"
  >
    <Text variant="headline" weight="bold" tone="inverse">
      {value === undefined ? '—' : String(value)}
    </Text>
    <Text variant="caption" weight="regular" tone="inverse" className="opacity-85">
      {label}
    </Text>
  </Pressable>
);

const Group: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <View className={cn('gap-2', className)}>
    <Text variant="caption" weight="semibold" tone="muted" className="px-1 uppercase">
      {title}
    </Text>
    <View className="rounded-lg bg-surface px-3 shadow-card">{children}</View>
  </View>
);

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { data: user, isLoading } = useMe();
  const { data: orders } = useMyOrders();
  const { data: addresses } = useAddresses();
  const favoriteCount = useFavoritesStore((s) => s.restaurants.length);
  const logout = useAuthStore((s) => s.logout);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const goOrders = () => navigation.navigate('MainTabs', { screen: 'OrdersTab' });
  const goFavorites = () => navigation.navigate('MainTabs', { screen: 'FavoritesTab' });
  const goAddresses = () => navigation.navigate('AddressManagement');

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE}>
        <TabHeader title="Tài khoản">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sửa hồ sơ"
            onPress={() => navigation.navigate('EditProfile')}
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size="lg" className="border-2 border-surface/60" />
            <View className="flex-1 gap-0.5">
              {isLoading ? (
                <>
                  <Skeleton className="h-5 w-40 bg-surface/30" />
                  <Skeleton className="h-4 w-52 bg-surface/30" />
                </>
              ) : (
                <>
                  <Text variant="headline" tone="inverse" numberOfLines={1}>
                    {user?.fullName || 'Khách hàng'}
                  </Text>
                  <Text variant="body" tone="inverse" className="opacity-85" numberOfLines={1}>
                    {user?.email}
                  </Text>
                  {!!user?.phone && (
                    <Text variant="caption" weight="regular" tone="inverse" className="opacity-85">
                      {user.phone}
                    </Text>
                  )}
                </>
              )}
            </View>
            <View className="rounded-full bg-surface/20 px-3 py-1.5">
              <Text variant="caption" weight="semibold" tone="inverse">
                Sửa
              </Text>
            </View>
          </Pressable>
          <View className="mt-1 flex-row gap-2">
            <Stat label="Đơn hàng" value={orders?.items.length} onPress={goOrders} />
            <Stat label="Yêu thích" value={favoriteCount} onPress={goFavorites} />
            <Stat label="Địa chỉ" value={addresses?.length} onPress={goAddresses} />
          </View>
        </TabHeader>

        <View className="gap-5 px-4 pt-5">
          <Group title="Tài khoản">
            <ListRow
              icon="person-outline"
              iconTone="brand"
              title="Thông tin cá nhân & mật khẩu"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <Divider inset />
            <ListRow icon="location-outline" iconTone="brand" title="Địa chỉ đã lưu" onPress={goAddresses} />
          </Group>

          <Group title="Hoạt động">
            <ListRow icon="receipt-outline" iconTone="brand" title="Lịch sử đơn hàng" onPress={goOrders} />
            <Divider inset />
            <ListRow icon="heart-outline" iconTone="danger" title="Quán yêu thích" onPress={goFavorites} />
          </Group>

          {__DEV__ && (
            <Group title="Phát triển">
              <ListRow
                icon="color-palette-outline"
                title="Thư viện thành phần"
                subtitle="Chỉ hiện ở chế độ phát triển"
                onPress={() => setGalleryOpen(true)}
              />
            </Group>
          )}

          <View className="rounded-lg bg-surface px-3 shadow-card">
            <ListRow
              icon="log-out-outline"
              title="Đăng xuất"
              destructive
              showChevron={false}
              onPress={() => setConfirmLogout(true)}
            />
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogout}
        title="Đăng xuất?"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản?"
        confirmLabel="Đăng xuất"
        cancelLabel="Hủy"
        destructive
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
      {__DEV__ && (
        <Modal visible={galleryOpen} animationType="slide" onRequestClose={() => setGalleryOpen(false)}>
          <DevGallery onClose={() => setGalleryOpen(false)} />
        </Modal>
      )}
    </View>
  );
};
