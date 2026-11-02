import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import {
  AppImage,
  Avatar,
  BottomSheet,
  Button,
  cn,
  Divider,
  EmptyState,
  Icon,
  LogoutButton,
  IconName,
  IconTone,
  Input,
  ListRow,
  LoadingSpinner,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { OwnerRestaurantSelector } from '../../components/modules/owner/OwnerRestaurantSelector';
import { StoreStatusCard } from '../../components/modules/owner/OwnerKit';
import { Money, NoticeCard } from '../../components/modules/partner/PartnerKit';
import { useOwnerRestaurants } from '../../hooks/useOwnerRestaurants';
import { useAddressDraftStore } from '../../store/useAddressDraftStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Restaurant } from '../../types/api';
import { OwnerStackParamList } from '../../types/navigation';

const RADIUS_OPTIONS = [2, 3, 5, 7, 10, 15];
const TIME_STEP_MINUTES = 30;

/** Cộng/trừ phút cho giờ "HH:mm", vòng trong 24 giờ. */
const shiftTime = (hhmm: string, deltaMinutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + deltaMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export const OwnerRestaurantScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [editVisible, setEditVisible] = useState(false);
  const [restName, setRestName] = useState('');
  const [restAddress, setRestAddress] = useState('');
  const [restPhone, setRestPhone] = useState('');
  const [restDescription, setRestDescription] = useState('');
  const [restImageUrl, setRestImageUrl] = useState('');
  const [restCoords, setRestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [openTime, setOpenTime] = useState('07:00');
  const [closeTime, setCloseTime] = useState('22:00');
  const [radiusKm, setRadiusKm] = useState(5);
  // Đang mở màn chọn địa chỉ: bảng sửa tạm đóng (Modal sẽ che màn bản đồ) và mở lại khi quay về
  const reopenAfterPicker = useRef(false);
  const [formError, setFormError] = useState<{ name?: string; address?: string; submit?: string }>({});

  const { restaurants, restaurant, isLoading } = useOwnerRestaurants();

  // Số liệu tóm tắt (dùng chung khoá với màn Thống kê nên không tải lại khi mở chi tiết)
  const todayStats = useQuery({
    queryKey: ['owner', 'stats', restaurant?.id, 1],
    queryFn: () => restaurantsApi.getStats(restaurant!.id, 1),
    enabled: Boolean(restaurant?.id),
  });
  const weekStats = useQuery({
    queryKey: ['owner', 'stats', restaurant?.id, 7],
    queryFn: () => restaurantsApi.getStats(restaurant!.id, 7),
    enabled: Boolean(restaurant?.id),
  });

  // Mở/đóng quán: đổi ngay trên màn hình (cả tab Đơn hàng dùng chung dữ liệu này), lỗi thì trả lại
  const toggleOpenMutation = useMutation({
    mutationFn: (isOpen: boolean) => restaurantsApi.updateRestaurant(restaurant!.id, { isOpen }),
    onMutate: async (isOpen) => {
      await queryClient.cancelQueries({ queryKey: ['owner', 'restaurants'] });
      const previous = queryClient.getQueryData<Restaurant[]>(['owner', 'restaurants']);
      queryClient.setQueryData<Restaurant[]>(['owner', 'restaurants'], (old) =>
        old?.map((r) => (r.id === restaurant?.id ? { ...r, isOpen } : r)),
      );
      return { previous };
    },
    onSuccess: (_d, isOpen) =>
      toast(isOpen ? 'Đã bật nhận đơn theo giờ mở cửa.' : 'Quán đã tạm nghỉ, khách không đặt được món.', 'success'),
    onError: (err: any, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['owner', 'restaurants'], ctx.previous);
      toast(err.response?.data?.message || 'Không thể đổi trạng thái quán', 'error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['owner', 'restaurants'] }),
  });

  const updateRestaurantMutation = useMutation({
    mutationFn: (data: Partial<Restaurant>) => restaurantsApi.updateRestaurant(restaurant!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner', 'restaurants'] });
      setEditVisible(false);
      toast('Đã lưu thông tin quán.', 'success');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      setFormError({ submit: (Array.isArray(msg) ? msg.join('\n') : msg) || 'Không thể cập nhật thông tin quán' });
    },
  });

  const openEdit = () => {
    if (!restaurant) return;
    setRestName(restaurant.name);
    setRestAddress(restaurant.address);
    setRestPhone(restaurant.phone || '');
    setRestDescription(restaurant.description || '');
    setRestImageUrl(restaurant.imageUrl || '');
    setRestCoords({ latitude: restaurant.latitude, longitude: restaurant.longitude });
    setOpenTime(restaurant.openTime || '07:00');
    setCloseTime(restaurant.closeTime || '22:00');
    setRadiusKm(restaurant.deliveryRadiusKm);
    setFormError({});
    setEditVisible(true);
  };

  // Mở màn bản đồ để tìm / ghim địa chỉ quán. Kết quả được màn chọn địa chỉ ghi vào
  // useAddressDraftStore (không truyền hàm qua tham số điều hướng vì tham số phải tuần tự hoá được).
  const openAddressPicker = () => {
    useAddressDraftStore.getState().resetDraft();
    reopenAfterPicker.current = true;
    setEditVisible(false);
    navigation.navigate('AddressPicker', { initialCoords: restCoords ?? undefined });
  };

  // Quay lại từ màn bản đồ (màn này được focus lại): lấy địa chỉ đã chọn (nếu có) rồi mở lại bảng sửa
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (!reopenAfterPicker.current) return;
        reopenAfterPicker.current = false;
        const { isPinConfirmed, pickedCoords, selectedAddressLine } = useAddressDraftStore.getState();
        if (isPinConfirmed && pickedCoords && selectedAddressLine) {
          setRestAddress(selectedAddressLine);
          setRestCoords(pickedCoords);
          setFormError((e) => ({ ...e, address: undefined }));
        }
        setEditVisible(true);
      }),
    [navigation],
  );

  const handlePickCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError((e) => ({ ...e, submit: 'Vui lòng cấp quyền truy cập ảnh để chọn ảnh bìa.' }));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setRestImageUrl(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch {
      setFormError((e) => ({ ...e, submit: 'Không thể mở thư viện ảnh' }));
    }
  };

  const handleSave = () => {
    if (!restaurant) return;
    const errors: typeof formError = {};
    if (restName.trim().length < 2) errors.name = 'Tên quán cần ít nhất 2 ký tự';
    if (!restAddress.trim()) errors.address = 'Vui lòng nhập địa chỉ quán';
    if (openTime === closeTime) errors.submit = 'Giờ mở cửa và giờ đóng cửa không được trùng nhau';
    setFormError(errors);
    if (errors.name || errors.address || errors.submit) return;

    updateRestaurantMutation.mutate({
      name: restName.trim(),
      address: restAddress.trim(),
      ...(restPhone.trim() ? { phone: restPhone.trim() } : {}),
      // Chuỗi rỗng để xoá được mô tả (undefined = giữ nguyên ở backend)
      description: restDescription.trim(),
      openTime,
      closeTime,
      deliveryRadiusKm: radiusKm,
      // Toạ độ dùng để tính khoảng cách giao hàng: chỉ gửi khi đã ghim lại trên bản đồ
      ...(restCoords &&
      (restCoords.latitude !== restaurant.latitude || restCoords.longitude !== restaurant.longitude)
        ? { latitude: restCoords.latitude, longitude: restCoords.longitude }
        : {}),
      // Chỉ gửi ảnh khi thật sự đổi
      ...(restImageUrl !== (restaurant.imageUrl || '') && restImageUrl.trim() ? { imageUrl: restImageUrl.trim() } : {}),
    });
  };

  const handleLogout = async () => {
    // Dữ liệu đã tải được xoá tự động khi đổi tài khoản (App.tsx: ResetCacheOnAccountChange)
    await logout();
  };

  if (isLoading) {
    return <LoadingSpinner message="Đang tải thông tin quán..." />;
  }

  const approval =
    restaurant?.status === 'PENDING_APPROVAL'
      ? { label: 'Chờ duyệt', tone: 'warning' as const }
      : restaurant?.status === 'SUSPENDED'
        ? { label: 'Tạm khoá', tone: 'danger' as const }
        : { label: 'Đã duyệt', tone: 'success' as const };

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE} showsVerticalScrollIndicator={false}>
        <TabHeader
          title="Cửa hàng"
          subtitle={
            restaurant ? <OwnerRestaurantSelector restaurants={restaurants} currentRestaurant={restaurant} /> : undefined
          }
        >
          {/* Danh tính quán: ảnh, tên, điểm đánh giá, trạng thái duyệt */}
          {restaurant && (
            <View className="flex-row items-center gap-3">
              <AppImage
                uri={restaurant.imageUrl}
                className="h-16 w-16 rounded-2xl border-2 border-surface/60"
                fallbackIcon="storefront-outline"
              />
              <View className="flex-1 gap-1">
                <Text variant="headline" weight="bold" tone="inverse" numberOfLines={1}>
                  {restaurant.name}
                </Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <View className="flex-row items-center gap-1 rounded-full bg-surface/20 px-2.5 py-0.5">
                    <Icon name="star" size={13} tone="rating" />
                    <Text variant="caption" weight="bold" tone="inverse">
                      {restaurant.rating.toFixed(1)}
                    </Text>
                    <Text variant="micro" weight="regular" tone="inverse" className="opacity-80">
                      ({restaurant.ratingCount ?? 0})
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-full bg-surface/20 px-2.5 py-0.5">
                    <Icon
                      name={approval.tone === 'success' ? 'shield-checkmark' : 'alert-circle'}
                      size={13}
                      tone="inverse"
                    />
                    <Text variant="caption" weight="semibold" tone="inverse">
                      {approval.label}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </TabHeader>

        <View className="gap-4 px-4 pt-4">
          {restaurant ? (
            <>
              {/* Cảnh báo trạng thái duyệt quán */}
              {restaurant.status === 'PENDING_APPROVAL' && (
                <NoticeCard
                  tone="warning"
                  icon="time-outline"
                  title="Quán chưa hiển thị với khách"
                  message="Hồ sơ quán hoặc thay đổi tên/địa chỉ/toạ độ đang chờ Quản trị viên phê duyệt."
                />
              )}
              {restaurant.status === 'SUSPENDED' && (
                <NoticeCard
                  tone="danger"
                  icon="alert-circle-outline"
                  title="Quán đang bị tạm khoá / từ chối duyệt"
                  message={
                    restaurant.suspendReason
                      ? `Lý do: ${restaurant.suspendReason}`
                      : 'Vui lòng kiểm tra lại thông tin quán hoặc liên hệ Quản trị viên.'
                  }
                />
              )}

              {/* Trạng thái thật của quán + công tắc nhận đơn */}
              <StoreStatusCard
                restaurant={restaurant}
                busy={toggleOpenMutation.isPending}
                onToggle={(val) => toggleOpenMutation.mutate(val)}
              />

              {/* Thao tác nhanh */}
              <View className="flex-row flex-wrap gap-3">
                <QuickTile
                  icon="time"
                  box="bg-brand-50"
                  tone="brand"
                  title="Giờ mở cửa"
                  value={`${restaurant.openTime || '07:00'} – ${restaurant.closeTime || '22:00'}`}
                  onPress={openEdit}
                />
                <QuickTile
                  icon="navigate"
                  box="bg-success-soft"
                  tone="success"
                  title="Bán kính giao"
                  value={`${restaurant.deliveryRadiusKm} km`}
                  onPress={openEdit}
                />
                <QuickTile
                  icon="star"
                  box="bg-accent-50"
                  tone="accent"
                  title="Đánh giá"
                  value={`${restaurant.rating.toFixed(1)} ★ · ${restaurant.ratingCount ?? 0} lượt`}
                  onPress={() => navigation.navigate('OwnerReviews')}
                />
                <QuickTile
                  icon="stats-chart"
                  box="bg-violet-soft"
                  tone="violet"
                  title="Thống kê"
                  value="Doanh thu, món bán chạy"
                  onPress={() => navigation.navigate('OwnerStats')}
                />
              </View>

              {/* Doanh thu tóm tắt */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem thống kê bán hàng"
                onPress={() => navigation.navigate('OwnerStats')}
                className="gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-90"
              >
                <View className="flex-row items-center gap-2">
                  <Text variant="headline" weight="bold" className="flex-1">
                    Doanh thu
                  </Text>
                  <Text variant="caption" weight="semibold" tone="brand">
                    Chi tiết
                  </Text>
                  <Icon name="chevron-forward" size="sm" tone="brand" />
                </View>
                <View className="flex-row gap-2">
                  <MiniStat
                    label="Hôm nay"
                    amount={todayStats.data?.revenue}
                    note={todayStats.data ? `${todayStats.data.deliveredOrders} đơn hoàn thành` : undefined}
                    highlight
                  />
                  <MiniStat
                    label="7 ngày qua"
                    amount={weekStats.data?.revenue}
                    note={weekStats.data ? `${weekStats.data.itemsSold} món đã bán` : undefined}
                  />
                </View>
                {!!weekStats.data?.topItems[0] && (
                  <View className="flex-row items-center gap-2 rounded-xl bg-accent-50 px-3 py-2.5">
                    <Icon name="flame" size="sm" tone="accent" />
                    <Text variant="caption" className="flex-1" numberOfLines={1}>
                      Bán chạy nhất tuần:{' '}
                      <Text variant="caption" weight="bold">
                        {weekStats.data.topItems[0].name}
                      </Text>{' '}
                      ({weekStats.data.topItems[0].quantity} phần)
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Thông tin quán */}
              <Group
                title="Thông tin quán"
                action={
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={openEdit} className="flex-row items-center gap-1">
                    <Icon name="create-outline" size="sm" tone="brand" />
                    <Text variant="caption" weight="semibold" tone="brand">
                      Sửa
                    </Text>
                  </Pressable>
                }
              >
                <Pressable accessibilityRole="button" accessibilityLabel="Sửa ảnh bìa quán" onPress={openEdit} className="pt-3">
                  <AppImage uri={restaurant.imageUrl} className="h-32 w-full rounded-xl" fallbackIcon="image-outline" />
                </Pressable>
                <ListRow
                  icon="location-outline"
                  iconTone="brand"
                  title="Địa chỉ"
                  subtitle={restaurant.address}
                  subtitleLines={3}
                  showChevron={false}
                />
                <Divider inset />
                <ListRow
                  icon="call-outline"
                  iconTone="brand"
                  title="Số điện thoại quán"
                  subtitle={restaurant.phone || 'Chưa cập nhật'}
                  onPress={openEdit}
                />
                <Divider inset />
                <ListRow
                  icon="document-text-outline"
                  iconTone="brand"
                  title="Mô tả"
                  subtitle={restaurant.description || 'Chưa có mô tả. Thêm vài dòng giới thiệu món đặc trưng của quán.'}
                  subtitleLines={4}
                  onPress={openEdit}
                />
              </Group>
            </>
          ) : (
            <EmptyState
              variant="card"
              icon="storefront-outline"
              title="Bạn chưa có nhà hàng nào"
              description="Vui lòng liên hệ Quản trị viên để đăng ký mở quán trên hệ thống."
            />
          )}

          {/* Tài khoản chủ quán */}
          <Group title="Tài khoản">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thông tin cá nhân và mật khẩu"
              onPress={() => navigation.navigate('EditProfile')}
              className="min-h-touch flex-row items-center gap-3 py-3 active:opacity-80"
            >
              <Avatar uri={user?.avatarUrl} name={user?.fullName} size="md" />
              <View className="flex-1">
                <Text variant="body" weight="semibold" numberOfLines={1}>
                  {user?.fullName || 'Chủ quán'}
                </Text>
                <Text variant="caption" weight="regular" tone="muted" numberOfLines={1}>
                  {user?.email} · Đối tác quán ăn
                </Text>
              </View>
              <Icon name="chevron-forward" size="sm" tone="muted" />
            </Pressable>
          </Group>

          <LogoutButton onLogout={handleLogout} message="Bạn sẽ cần đăng nhập lại để quản lý quán." />
        </View>
      </ScrollView>

      {/* Bảng sửa thông tin quán */}
      <BottomSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        title="Sửa thông tin quán"
        footer={
          <View className="gap-2 pb-2">
            {!!formError.submit && (
              <Text variant="caption" tone="danger" className="text-center">
                {formError.submit}
              </Text>
            )}
            <Button
              label="Lưu thông tin quán"
              variant="primary"
              size="lg"
              loading={updateRestaurantMutation.isPending}
              onPress={handleSave}
            />
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi ảnh bìa quán"
            onPress={handlePickCover}
            className="active:opacity-85"
          >
            <AppImage uri={restImageUrl} className="h-40 w-full rounded-xl" fallbackIcon="image-outline">
              <View className="absolute bottom-2 right-2 flex-row items-center gap-1.5 rounded-full bg-scrim px-3 py-1.5">
                <Icon name="camera-outline" size="sm" tone="inverse" />
                <Text variant="caption" weight="semibold" tone="inverse">
                  Đổi ảnh bìa
                </Text>
              </View>
            </AppImage>
          </Pressable>

          <Input
            label="Tên quán *"
            value={restName}
            onChangeText={setRestName}
            placeholder="VD: Phở Gia Truyền"
            error={formError.name}
          />
          <View className="gap-2">
            <Input
              label="Địa chỉ *"
              value={restAddress}
              onChangeText={setRestAddress}
              placeholder="VD: 123 Lê Lợi, Quận 1, TP. Hồ Chí Minh"
              error={formError.address}
              multiline
            />
            <Pressable
              accessibilityRole="button"
              onPress={openAddressPicker}
              className="min-h-touch flex-row items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 active:opacity-80"
            >
              <Icon name="map-outline" size="md" tone="brand" />
              <View className="flex-1">
                <Text variant="body" weight="semibold" tone="brand">
                  Tìm hoặc ghim trên bản đồ
                </Text>
                <Text variant="micro" weight="regular" tone="secondary">
                  Vị trí ghim dùng để tính khoảng cách giao hàng
                </Text>
              </View>
              <Icon name="chevron-forward" size="sm" tone="brand" />
            </Pressable>
          </View>
          <Input
            label="Số điện thoại quán"
            value={restPhone}
            onChangeText={setRestPhone}
            placeholder="VD: 0901234567"
            keyboardType="phone-pad"
          />
          <Input
            label="Mô tả"
            value={restDescription}
            onChangeText={setRestDescription}
            placeholder="Giới thiệu món đặc trưng của quán"
            multiline
          />

          {/* Giờ mở cửa */}
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Giờ mở cửa
            </Text>
            <View className="flex-row gap-3">
              <TimeStepper label="Mở cửa" value={openTime} onChange={setOpenTime} />
              <TimeStepper label="Đóng cửa" value={closeTime} onChange={setCloseTime} />
            </View>
            {closeTime < openTime && (
              <Text variant="micro" weight="regular" tone="muted">
                Quán mở qua đêm, đóng cửa lúc {closeTime} ngày hôm sau.
              </Text>
            )}
          </View>

          {/* Bán kính giao hàng */}
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Bán kính giao hàng
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RADIUS_OPTIONS.map((km) => {
                const selected = radiusKm === km;
                return (
                  <Pressable
                    key={km}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setRadiusKm(km)}
                    className={`min-h-touch min-w-[56px] items-center justify-center rounded-full border px-3 active:opacity-75 ${
                      selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'
                    }`}
                  >
                    <Text variant="body" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'default'}>
                      {km} km
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </BottomSheet>

    </View>
  );
};

const Group: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <View className="gap-2">
    <View className="flex-row items-center justify-between px-1">
      <Text variant="caption" weight="bold" tone="secondary" className="uppercase">
        {title}
      </Text>
      {action}
    </View>
    <View className="rounded-2xl bg-surface px-3 shadow-card">{children}</View>
  </View>
);

const MiniStat: React.FC<{ label: string; amount?: number; note?: string; highlight?: boolean }> = ({
  label,
  amount,
  note,
  highlight,
}) => (
  <View className={cn('flex-1 gap-0.5 rounded-xl px-3 py-2.5', highlight ? 'bg-brand-50' : 'bg-canvas-subtle')}>
    <Text variant="caption" tone="secondary" numberOfLines={1}>
      {label}
    </Text>
    {amount === undefined ? (
      <Text variant="headline" weight="bold" tone="muted">
        —
      </Text>
    ) : (
      <Money amount={amount} variant="headline" tone={highlight ? 'brand' : 'default'} />
    )}
    {!!note && (
      <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
        {note}
      </Text>
    )}
  </View>
);

/** Ô thao tác nhanh (2 cột). */
const QuickTile: React.FC<{
  icon: IconName;
  box: string;
  tone: IconTone;
  title: string;
  value: string;
  onPress: () => void;
}> = ({ icon, box, tone, title, value, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${title}: ${value}`}
    onPress={onPress}
    className="min-w-[45%] flex-1 gap-2 rounded-2xl bg-surface p-3.5 shadow-card active:opacity-85"
  >
    <View className={cn('h-10 w-10 items-center justify-center rounded-xl', box)}>
      <Icon name={icon} size="md" tone={tone} />
    </View>
    <View className="gap-0.5">
      <Text variant="body" weight="bold">
        {title}
      </Text>
      <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
        {value}
      </Text>
    </View>
  </Pressable>
);

/** Chọn giờ bằng nút −/+ (bước 30 phút), không cần thư viện chọn giờ. */
const TimeStepper: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <View className="flex-1 gap-1 rounded-lg border border-line bg-surface p-2">
    <Text variant="micro" weight="medium" tone="secondary" className="text-center">
      {label}
    </Text>
    <View className="flex-row items-center justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: lùi 30 phút`}
        onPress={() => onChange(shiftTime(value, -TIME_STEP_MINUTES))}
        className="h-touch w-touch items-center justify-center rounded-full bg-canvas-subtle active:opacity-70"
      >
        <Icon name="remove" size="md" tone="default" />
      </Pressable>
      <Text variant="title" weight="bold" accessibilityLabel={`${label} lúc ${value}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: thêm 30 phút`}
        onPress={() => onChange(shiftTime(value, TIME_STEP_MINUTES))}
        className="h-touch w-touch items-center justify-center rounded-full bg-canvas-subtle active:opacity-70"
      >
        <Icon name="add" size="md" tone="default" />
      </Pressable>
    </View>
  </View>
);
