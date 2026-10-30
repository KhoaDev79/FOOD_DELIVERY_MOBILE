import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi, AdminRestaurantItem, RestaurantFilter } from '../../api/admin';
import { AssignOwnerSheet } from '../../components/modules/admin/AssignOwnerSheet';
import { RestaurantDetailSheet } from '../../components/modules/admin/RestaurantDetailSheet';
import { RoleBadge } from '../../components/modules/admin/adminShared';
import {
  AppImage,
  Badge,
  BottomSheet,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  IconButton,
  Input,
  LoadingSpinner,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { DEFAULT_COORDS } from '../../constants/config';
import { palette } from '../../theme';
import { AdminTabParamList } from '../../types/navigation';

const FILTERS: { value: RestaurantFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'open', label: 'Đang mở' },
  { value: 'closed', label: 'Đã đóng' },
  { value: 'unassigned', label: 'Chưa có chủ quán' },
];

/** Đợi Modal trước đóng hẳn rồi mới mở Modal sau (iOS không mở được 2 Modal chồng nhau). */
const MODAL_SWAP_DELAY = 350;

const EMPTY_FORM = { name: '', address: '', phone: '', imageUrl: '', ownerName: '', ownerPhone: '', ownerEmail: '' };

export const AdminRestaurantsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProp<AdminTabParamList, 'AdminRestaurantsTab'>>();

  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  // Bộ lọc nằm trong tham số route để màn Tổng quan mở thẳng bộ lọc (VD: "quán chưa có chủ")
  const filter: RestaurantFilter = route.params?.filter ?? 'all';
  const setFilter = (f: RestaurantFilter) => navigation.setParams({ filter: f });
  const [refreshing, setRefreshing] = useState(false);

  const [assignFor, setAssignFor] = useState<AdminRestaurantItem | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toggleFor, setToggleFor] = useState<AdminRestaurantItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'restaurants', filter, search.trim()],
    queryFn: () => adminApi.listRestaurants({ q: search.trim() || undefined, filter, limit: 100 }),
  });
  const restaurants = data?.items ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleOpen = useMutation({
    mutationFn: (id: string) => adminApi.toggleRestaurantOpen(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(res.isOpen ? `Đã mở lại quán ${res.name}` : `Đã tạm ngưng quán ${res.name}`, 'success');
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể đổi trạng thái quán', 'error'),
    onSettled: () => setToggleFor(null),
  });

  const createRestaurant = useMutation({
    mutationFn: () =>
      adminApi.createRestaurant({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || form.ownerPhone.trim(),
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim(),
        ownerEmail: form.ownerEmail.trim(),
        latitude: DEFAULT_COORDS.latitude,
        longitude: DEFAULT_COORDS.longitude,
        imageUrl: form.imageUrl.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      // Mật khẩu tạm của chủ quán mới chỉ trả về một lần: hiện hộp thoại để admin ghi lại
      setTimeout(
        () =>
          Alert.alert(
            'Đã tạo quán',
            res.temporaryPassword
              ? `"${res.name}" đã được tạo cùng tài khoản chủ quán mới.\n\nMật khẩu tạm: ${res.temporaryPassword}\nHãy gửi cho chủ quán và nhắc đổi mật khẩu. Mật khẩu này chỉ hiện một lần.`
              : `"${res.name}" đã được gán cho tài khoản có sẵn (đăng nhập bằng mật khẩu hiện tại).`,
          ),
        MODAL_SWAP_DELAY,
      );
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể tạo quán', 'error'),
  });

  const submitCreate = () => {
    const missing = [
      [form.name, 'tên quán'],
      [form.address, 'địa chỉ'],
      [form.ownerName, 'họ tên chủ quán'],
      [form.ownerPhone, 'SĐT chủ quán'],
      [form.ownerEmail, 'email chủ quán'],
    ].find(([v]) => !v.trim());
    if (missing) {
      toast(`Vui lòng nhập ${missing[1]}`, 'error');
      return;
    }
    createRestaurant.mutate();
  };

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChangeText: (v: string) => setForm((f) => ({ ...f, [key]: v })),
  });

  const renderItem = ({ item }: { item: AdminRestaurantItem }) => (
    <View className="gap-3 rounded-2xl bg-surface p-3 shadow-card">
      <View className="flex-row gap-3">
        <AppImage uri={item.imageUrl} className="h-20 w-20 rounded-xl" />
        <View className="flex-1 gap-1">
          <Text variant="body-lg" weight="semibold" numberOfLines={1}>
            {item.name}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon name="star" size="xs" tone="rating" />
            <Text variant="caption">{item.rating.toFixed(1)}</Text>
            <Text variant="caption" tone="muted">
              • {item._count.menuItems} món • {item._count.orders} đơn
            </Text>
          </View>
          <View className="flex-row items-start gap-1">
            <Icon name="location-outline" size="xs" tone="secondary" />
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
              {item.address}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            <Badge label={item.isOpen ? 'Đang mở' : 'Tạm ngưng'} tone={item.isOpen ? 'success' : 'danger'} size="sm" />
            {item.needsOwner && <Badge label="Chưa có chủ" tone="warning" icon="alert-circle" size="sm" />}
          </View>
        </View>
      </View>

      {/* Chủ quán */}
      <View className="flex-row items-center gap-2 rounded-xl bg-canvas-subtle px-3 py-2">
        <Icon name="person-circle-outline" size="md" tone={item.needsOwner ? 'danger' : 'brand'} />
        <View className="flex-1">
          <Text variant="caption" weight="semibold" numberOfLines={1}>
            {item.needsOwner ? 'Chưa có chủ quán' : item.owner.fullName}
          </Text>
          <Text variant="micro" weight="regular" tone="secondary" numberOfLines={1}>
            {item.needsOwner ? `Đang giữ bởi: ${item.owner.fullName}` : item.owner.email}
          </Text>
        </View>
        {!item.needsOwner && <RoleBadge role={item.owner.role} />}
      </View>

      {/* Hành động thuộc thẩm quyền nền tảng (admin không sửa giá/món của quán) */}
      <View className="flex-row gap-2">
        <Button
          label="Gán chủ quán"
          leftIcon="key-outline"
          variant={item.needsOwner ? 'primary' : 'secondary'}
          size="sm"
          className="flex-1"
          onPress={() => setAssignFor(item)}
        />
        <Button
          label={item.isOpen ? 'Tạm ngưng' : 'Mở lại'}
          leftIcon={item.isOpen ? 'pause-circle-outline' : 'play-circle-outline'}
          variant="outline"
          size="sm"
          className="flex-1"
          loading={toggleOpen.isPending && toggleOpen.variables === item.id}
          onPress={() => setToggleFor(item)}
        />
        <IconButton
          icon="information-circle-outline"
          variant="subtle"
          size="sm"
          accessibilityLabel={`Xem chi tiết ${item.name}`}
          onPress={() => setDetailId(item.id)}
        />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Quản lý Quán ăn"
        subtitle={data ? `${data.total} quán${filter !== 'all' ? ' phù hợp bộ lọc' : ' trên hệ thống'}` : undefined}
        trailing={
          <IconButton icon="add" variant="glass" accessibilityLabel="Thêm quán mới" onPress={() => setCreateOpen(true)} />
        }
      >
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Tìm quán theo tên..."
          className="h-search-lg rounded-full bg-surface px-4"
        />
      </TabHeader>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-3">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              label={f.label}
              icon={f.value === 'unassigned' ? 'key-outline' : undefined}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải danh sách quán..." />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName={`gap-3 px-4 pt-1 ${TAB_BAR_CLEARANCE}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
          ListEmptyComponent={
            <EmptyState
              icon="storefront-outline"
              title={filter === 'unassigned' ? 'Mọi quán đều đã có chủ' : 'Không tìm thấy quán'}
              description={
                filter === 'unassigned'
                  ? 'Không có quán nào cần gán người quản lý.'
                  : 'Thử từ khoá khác hoặc đổi bộ lọc.'
              }
            />
          }
        />
      )}

      <AssignOwnerSheet key={assignFor?.id ?? 'none'} restaurant={assignFor} onClose={() => setAssignFor(null)} />

      <RestaurantDetailSheet
        restaurantId={detailId}
        onClose={() => setDetailId(null)}
        onAssignOwner={() => {
          const target = restaurants.find((r) => r.id === detailId) ?? null;
          setDetailId(null);
          setTimeout(() => setAssignFor(target), MODAL_SWAP_DELAY);
        }}
      />

      <ConfirmDialog
        visible={!!toggleFor}
        title={toggleFor?.isOpen ? 'Tạm ngưng quán này?' : 'Mở lại quán này?'}
        message={
          toggleFor?.isOpen
            ? `"${toggleFor?.name}" sẽ ngừng nhận đơn mới cho đến khi được mở lại.`
            : `"${toggleFor?.name}" sẽ hoạt động và nhận đơn trở lại.`
        }
        confirmLabel={toggleFor?.isOpen ? 'Tạm ngưng' : 'Mở lại'}
        destructive={toggleFor?.isOpen}
        loading={toggleOpen.isPending}
        onCancel={() => !toggleOpen.isPending && setToggleFor(null)}
        onConfirm={() => toggleFor && toggleOpen.mutate(toggleFor.id)}
      />

      <BottomSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm quán mới"
        footer={
          <View className="pb-2">
            <Button label="Tạo quán & tài khoản chủ quán" size="lg" loading={createRestaurant.isPending} onPress={submitCreate} />
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-3 pb-4">
          <Text variant="caption" weight="semibold" tone="muted" className="uppercase">
            Thông tin quán
          </Text>
          <Input label="Tên quán *" placeholder="VD: Phở Bò Gia Truyền" {...field('name')} />
          <Input label="Địa chỉ *" placeholder="VD: 123 Nguyễn Văn Cừ, Quận 5" {...field('address')} />
          <Input label="Số điện thoại quán" keyboardType="phone-pad" {...field('phone')} />
          <Input label="Link ảnh quán" placeholder="https://..." autoCapitalize="none" {...field('imageUrl')} />
          <Text variant="caption" weight="semibold" tone="muted" className="mt-2 uppercase">
            Chủ quán (tạo mới nếu email chưa có tài khoản)
          </Text>
          <Input label="Họ tên chủ quán *" {...field('ownerName')} />
          <Input label="SĐT chủ quán *" keyboardType="phone-pad" {...field('ownerPhone')} />
          <Input label="Email chủ quán *" keyboardType="email-address" autoCapitalize="none" {...field('ownerEmail')} />
        </ScrollView>
      </BottomSheet>
    </View>
  );
};
