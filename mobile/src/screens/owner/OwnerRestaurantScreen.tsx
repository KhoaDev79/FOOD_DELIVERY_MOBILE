import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import {
  AppImage,
  Avatar,
  Badge,
  BottomSheet,
  Button,
  ConfirmDialog,
  Divider,
  Icon,
  Input,
  ListRow,
  LoadingSpinner,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useAddressDraftStore } from '../../store/useAddressDraftStore';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { Restaurant } from '../../types/api';
import { formatVND } from '../../utils/format';
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

  const [confirmLogout, setConfirmLogout] = useState(false);
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

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });
  const restaurant = restaurants?.[0];

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
    onSuccess: (_d, isOpen) => toast(isOpen ? 'Quán đã mở cửa nhận đơn.' : 'Quán đã tạm ngừng nhận đơn.', 'success'),
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
    setConfirmLogout(false);
    // Dữ liệu đã tải được xoá tự động khi đổi tài khoản (App.tsx: ResetCacheOnAccountChange)
    await logout();
  };

  if (isLoading) {
    return <LoadingSpinner message="Đang tải thông tin quán..." />;
  }

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <ScrollView contentContainerClassName={TAB_BAR_CLEARANCE} showsVerticalScrollIndicator={false}>
        <TabHeader title="Cửa hàng">
          {/* Chủ quán */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sửa thông tin tài khoản"
            onPress={() => navigation.navigate('EditProfile')}
            className="flex-row items-center gap-3 active:opacity-80"
          >
            <Avatar uri={user?.avatarUrl} name={user?.fullName} size="lg" className="border-2 border-surface/60" />
            <View className="flex-1 gap-0.5">
              <Text variant="headline" tone="inverse" numberOfLines={1}>
                {user?.fullName || 'Chủ quán'}
              </Text>
              <Text variant="body" tone="inverse" className="opacity-85" numberOfLines={1}>
                {user?.email}
              </Text>
              <View className="mt-1 self-start flex-row items-center gap-1 rounded-full bg-surface/20 px-2.5 py-0.5">
                <Icon name="storefront" size="xs" tone="inverse" />
                <Text variant="micro" tone="inverse">
                  Đối tác quán ăn
                </Text>
              </View>
            </View>
            <View className="rounded-full bg-surface/20 px-3 py-1.5">
              <Text variant="caption" weight="semibold" tone="inverse">
                Sửa
              </Text>
            </View>
          </Pressable>
        </TabHeader>

        <View className="gap-5 px-4 pt-5">
          {restaurant ? (
            <>
              {/* Cảnh báo trạng thái duyệt quán */}
              {restaurant.status === 'PENDING_APPROVAL' && (
                <View className="flex-row items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4">
                  <Icon name="time-outline" size="md" tone="accent" />
                  <View className="flex-1 gap-0.5">
                    <Text variant="body" weight="bold">
                      Quán chưa hiển thị với khách
                    </Text>
                    <Text variant="caption" tone="secondary">
                      Hồ sơ quán ăn hoặc thay đổi tên/địa chỉ/toạ độ của bạn đang chờ Quản trị viên phê duyệt.
                    </Text>
                  </View>
                </View>
              )}

              {restaurant.status === 'SUSPENDED' && (
                <View className="flex-row items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4">
                  <Icon name="alert-circle-outline" size="md" tone="danger" />
                  <View className="flex-1 gap-0.5">
                    <Text variant="body" weight="bold" tone="danger">
                      Quán đang bị tạm khoá / từ chối duyệt
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {restaurant.suspendReason
                        ? `Lý do: ${restaurant.suspendReason}`
                        : 'Vui lòng kiểm tra lại thông tin quán hoặc liên hệ Quản trị viên.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Thẻ quán */}
              <View className="overflow-hidden rounded-xl bg-surface shadow-card">
                <AppImage uri={restaurant.imageUrl} className="h-40 w-full" fallbackIcon="storefront-outline" />
                <View className="gap-2 p-4">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text variant="title" weight="bold" numberOfLines={2} className="flex-1">
                      {restaurant.name}
                    </Text>
                    <Badge
                      label={
                        restaurant.status === 'PENDING_APPROVAL'
                          ? 'Chờ duyệt'
                          : restaurant.status === 'SUSPENDED'
                            ? 'Tạm khoá'
                            : 'Đã duyệt'
                      }
                      tone={
                        restaurant.status === 'PENDING_APPROVAL'
                          ? 'warning'
                          : restaurant.status === 'SUSPENDED'
                            ? 'danger'
                            : 'success'
                      }
                    />
                  </View>
                  <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
                    <View className="flex-row items-center gap-1">
                      <Icon name="star" size="sm" tone="rating" />
                      <Text variant="body" weight="semibold">
                        {restaurant.rating.toFixed(1)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <Icon name="navigate-outline" size="sm" tone="secondary" />
                      <Text variant="body" tone="secondary">
                        Giao trong {restaurant.deliveryRadiusKm} km
                      </Text>
                    </View>
                  </View>
                  <Button
                    label="Sửa thông tin quán"
                    leftIcon="create-outline"
                    variant="secondary"
                    size="md"
                    onPress={openEdit}
                    className="mt-1 min-h-touch"
                  />
                </View>
              </View>

              {/* Mở / đóng nhận đơn */}
              <View
                className={`flex-row items-center gap-3 rounded-xl border p-4 ${
                  restaurant.isOpen ? 'border-success/30 bg-success-soft' : 'border-line bg-surface'
                }`}
              >
                <View
                  className={`h-11 w-11 items-center justify-center rounded-full ${
                    restaurant.isOpen ? 'bg-success' : 'bg-canvas-subtle'
                  }`}
                >
                  <Icon name={restaurant.isOpen ? 'storefront' : 'moon-outline'} size="md" tone={restaurant.isOpen ? 'inverse' : 'secondary'} />
                </View>
                <View className="flex-1">
                  <Text variant="body-lg" weight="bold">
                    {restaurant.isOpen ? 'Đang mở cửa' : 'Đang đóng cửa'}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {!restaurant.isOpen
                      ? 'Quán tạm ngừng, khách không đặt được món'
                      : restaurant.acceptingOrders
                        ? `Khách trong bán kính ${restaurant.deliveryRadiusKm} km quanh quán có thể đặt món`
                        : `Ngoài giờ mở cửa (${restaurant.openTime} – ${restaurant.closeTime}), khách chưa đặt được`}
                  </Text>
                </View>
                <Switch
                  accessibilityLabel={restaurant.isOpen ? 'Đóng cửa quán' : 'Mở cửa quán'}
                  value={restaurant.isOpen}
                  disabled={toggleOpenMutation.isPending || restaurant.status !== 'ACTIVE'}
                  onValueChange={(val) => toggleOpenMutation.mutate(val)}
                  trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
                  thumbColor={palette.surface}
                />
              </View>

              {/* Thống kê tóm tắt */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Xem thống kê bán hàng"
                onPress={() => navigation.navigate('OwnerStats')}
                className="gap-3 rounded-xl bg-surface p-4 shadow-card active:opacity-85"
              >
                <View className="flex-row items-center gap-2">
                  <View className="h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                    <Icon name="stats-chart" size="md" tone="brand" />
                  </View>
                  <Text variant="body-lg" weight="bold" className="flex-1">
                    Thống kê bán hàng
                  </Text>
                  <Text variant="caption" weight="semibold" tone="brand">
                    Xem chi tiết
                  </Text>
                  <Icon name="chevron-forward" size="sm" tone="brand" />
                </View>
                <View className="flex-row gap-2">
                  <MiniStat
                    label="Doanh thu hôm nay"
                    value={todayStats.data ? formatVND(todayStats.data.revenue) : '—'}
                    note={todayStats.data ? `${todayStats.data.deliveredOrders} đơn hoàn thành` : undefined}
                  />
                  <MiniStat
                    label="7 ngày qua"
                    value={weekStats.data ? formatVND(weekStats.data.revenue) : '—'}
                    note={weekStats.data ? `${weekStats.data.itemsSold} món đã bán` : undefined}
                  />
                </View>
                {!!weekStats.data?.topItems[0] && (
                  <View className="flex-row items-center gap-2 rounded-lg bg-accent-50 px-3 py-2">
                    <Icon name="flame" size="sm" tone="accent" />
                    <Text variant="caption" className="flex-1" numberOfLines={1}>
                      Bán chạy nhất tuần: {weekStats.data.topItems[0].name} ({weekStats.data.topItems[0].quantity} phần)
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Thông tin quán */}
              <Group title="Thông tin quán">
                <ListRow
                  icon="star-outline"
                  iconTone="brand"
                  title="Đánh giá thực khách"
                  subtitle={`${restaurant.rating.toFixed(1)} sao (${restaurant.ratingCount ?? 0} lượt) · Xem & phản hồi`}
                  onPress={() => navigation.navigate('OwnerReviews')}
                />
                <Divider inset />
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
                  icon="time-outline"
                  iconTone="brand"
                  title="Giờ mở cửa"
                  subtitle={`${restaurant.openTime || '07:00'} – ${restaurant.closeTime || '22:00'}`}
                  onPress={openEdit}
                />
                <Divider inset />
                <ListRow
                  icon="navigate-outline"
                  iconTone="brand"
                  title="Bán kính giao hàng"
                  subtitle={`${restaurant.deliveryRadiusKm} km quanh quán`}
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
            <View className="items-center gap-2 rounded-xl bg-surface p-6 shadow-card">
              <Icon name="storefront-outline" size="xl" tone="muted" />
              <Text variant="headline">Bạn chưa có nhà hàng nào</Text>
              <Text variant="body" tone="secondary" className="text-center">
                Vui lòng liên hệ Quản trị viên để đăng ký mở quán trên hệ thống.
              </Text>
            </View>
          )}

          <Group title="Tài khoản">
            <ListRow
              icon="person-outline"
              iconTone="brand"
              title="Thông tin cá nhân & mật khẩu"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <Divider inset />
            <ListRow
              icon="log-out-outline"
              title="Đăng xuất"
              destructive
              showChevron={false}
              onPress={() => setConfirmLogout(true)}
            />
          </Group>
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

      {/* Hộp xác nhận chạy được cả trên web (Alert.alert có nút không hiện gì trên web) */}
      <ConfirmDialog
        visible={confirmLogout}
        title="Đăng xuất?"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản chủ quán?"
        confirmLabel="Đăng xuất"
        destructive
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
};

const Group: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View className="gap-2">
    <Text variant="caption" weight="semibold" tone="secondary" className="px-1">
      {title}
    </Text>
    <View className="rounded-lg bg-surface px-3 shadow-card">{children}</View>
  </View>
);

const MiniStat: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <View className="flex-1 rounded-lg bg-canvas-subtle px-3 py-2.5">
    <Text variant="caption" tone="secondary" numberOfLines={1}>
      {label}
    </Text>
    <Text variant="headline" weight="bold" numberOfLines={1}>
      {value}
    </Text>
    {!!note && (
      <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
        {note}
      </Text>
    )}
  </View>
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
