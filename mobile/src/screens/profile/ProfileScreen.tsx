import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  Avatar,
  cn,
  CountBadge,
  Divider,
  Icon,
  LogoutButton,
  ListRow,
  Skeleton,
  TabHeader,
  TAB_BAR_CLEARANCE,
  Text,
} from '../../components/ui';
import { useUnreadChatCount } from '../../hooks/useUnreadChatCount';
import { useMyOrders } from '../../services/useOrders';
import { useAddresses, useMe } from '../../services/useUser';
import { useOpenTicketsCount } from '../../services/useHelp';
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
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: user, isLoading } = useMe();
  const { data: orders } = useMyOrders();
  const { data: addresses } = useAddresses();
  const { data: openTicketsCount = 0 } = useOpenTicketsCount();
  const favoriteCount = useFavoritesStore((s) => s.restaurants.length);
  const logout = useAuthStore((s) => s.logout);

  const requireAuth = (callback: () => void) => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    callback();
  };

  const goOrders = () => requireAuth(() => navigation.navigate('MainTabs', { screen: 'OrdersTab' }));
  const goFavorites = () => navigation.navigate('MainTabs', { screen: 'FavoritesTab' });
  const goAddresses = () => requireAuth(() => navigation.navigate('AddressManagement'));
  const goInbox = () => requireAuth(() => navigation.navigate('Inbox'));
  const unreadChats = useUnreadChatCount();

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE}>
        <TabHeader title="Tài khoản">
          {isAuthenticated ? (
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
            </Pressable>
          ) : (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface/20 border-2 border-surface/40">
                  <Icon name="person" size={28} tone="inverse" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text variant="headline" tone="inverse" weight="bold">
                      Chào mừng bạn!
                    </Text>
                  </View>
                  <Text variant="caption" tone="inverse" className="opacity-85 mt-0.5">
                    Đăng nhập để đặt món và nhận ngàn ưu đãi từ ZomZom.
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đăng nhập hoặc đăng ký"
                onPress={() => navigation.navigate('Login')}
                className="mt-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface py-2.5 px-4 shadow-card active:opacity-85"
              >
                <Icon name="log-in-outline" size={18} tone="brand" />
                <Text variant="body" weight="bold" tone="brand">
                  Đăng nhập / Đăng ký ngay
                </Text>
              </Pressable>
            </View>
          )}

          {isAuthenticated && (
            <View className="mt-1 flex-row gap-2">
              <Stat label="Đơn hàng" value={orders?.items.length} onPress={goOrders} />
              <Stat label="Yêu thích" value={favoriteCount} onPress={goFavorites} />
              <Stat label="Địa chỉ" value={addresses?.length} onPress={goAddresses} />
            </View>
          )}
        </TabHeader>

        <View className="gap-5 px-4 pt-5">
          <Group title="Tài khoản">
            <ListRow
              icon="person-outline"
              iconTone="brand"
              title="Thông tin cá nhân & mật khẩu"
              onPress={() => requireAuth(() => navigation.navigate('EditProfile'))}
            />
            <Divider inset />
            <ListRow icon="location-outline" iconTone="brand" title="Địa chỉ đã lưu" onPress={goAddresses} />
          </Group>

          <Group title="Hoạt động">
            <ListRow
              icon="chatbubbles-outline"
              iconTone="brand"
              title="Tin nhắn"
              subtitle={unreadChats > 0 ? `${unreadChats} tin nhắn chưa đọc` : 'Trao đổi với quán và tài xế theo từng đơn'}
              accessibilityLabel={unreadChats > 0 ? `Tin nhắn, ${unreadChats} tin chưa đọc` : 'Tin nhắn'}
              trailing={
                <View className="flex-row items-center gap-1">
                  <CountBadge count={unreadChats} />
                  <Icon name="chevron-forward" size="md" tone="muted" />
                </View>
              }
              onPress={goInbox}
            />
            <Divider inset />
            <ListRow icon="receipt-outline" iconTone="brand" title="Lịch sử đơn hàng" onPress={goOrders} />
            <Divider inset />
            <ListRow icon="heart-outline" iconTone="danger" title="Quán yêu thích" onPress={goFavorites} />
            <Divider inset />
            <ListRow
              icon="ticket-outline"
              iconTone="accent"
              title="Ví voucher"
              subtitle="Mã giảm giá, freeship và quà tặng riêng cho bạn"
              onPress={() => requireAuth(() => navigation.navigate('VoucherWallet'))}
            />
          </Group>

          {isAuthenticated && user?.role === 'CUSTOMER' && (
            <Group title="Hợp tác">
              <ListRow
                icon="briefcase-outline"
                iconTone="brand"
                title="Đăng ký mở quán / làm tài xế"
                subtitle="Gửi yêu cầu để quản trị viên duyệt"
                onPress={() => navigation.navigate('RoleUpgradeRequest')}
              />
            </Group>
          )}

                    <Group title="Hỗ trợ">
            <ListRow
              icon="help-buoy-outline"
              iconTone="brand"
              title="Trung tâm trợ giúp"
              subtitle="Câu hỏi thường gặp, báo sự cố & chatbot"
              trailing={
                openTicketsCount > 0 ? (
                  <View className="flex-row items-center gap-1">
                    <CountBadge count={openTicketsCount} />
                    <Icon name="chevron-forward" size="md" tone="muted" />
                  </View>
                ) : undefined
              }
              onPress={() => navigation.navigate('HelpCenter')}
            />
          </Group>

          {isAuthenticated ? (
            <LogoutButton onLogout={logout} />
          ) : (
            <View className="rounded-lg bg-surface px-3 shadow-card">
              <ListRow
                icon="log-in-outline"
                iconTone="brand"
                title="Đăng nhập"
                onPress={() => navigation.navigate('Login')}
              />
            </View>
          )}
        </View>
      </ScrollView>

    </View>
  );
};
