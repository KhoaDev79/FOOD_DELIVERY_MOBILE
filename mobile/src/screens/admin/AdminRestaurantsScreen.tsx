import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi, AdminRestaurantItem, RestaurantFilter } from '../../api/admin';
import { ContentWidth, DetailPlaceholder, ListSkeleton, TabStrip, useIsWide } from '../../components/modules/admin/AdminKit';
import { AssignOwnerSheet } from '../../components/modules/admin/AssignOwnerSheet';
import { RestaurantDetailPanel, RestaurantStatusBadges } from '../../components/modules/admin/RestaurantDetailPanel';
import {
  AppImage,
  BottomSheet,
  Button,
  cn,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Input,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { DEFAULT_COORDS } from '../../constants/config';
import { useDebounce } from '../../hooks/useDebounce';
import { useNow } from '../../hooks/useNow';
import { palette } from '../../theme';
import { AdminTabParamList } from '../../types/navigation';

/** tone: số đếm tô cam/đỏ khi tab có việc cần xử lý. */
const TABS: { value: RestaurantFilter; label: string; tone?: 'warning' | 'danger' }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt', tone: 'warning' },
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'suspended', label: 'Tạm khoá', tone: 'danger' },
  { value: 'unassigned', label: 'Chưa có chủ', tone: 'warning' },
];

/** Đợi Modal trước đóng hẳn rồi mới mở Modal sau (iOS không mở được 2 Modal chồng nhau). */
const MODAL_SWAP_DELAY = 350;

const EMPTY_FORM = { name: '', address: '', phone: '', imageUrl: '', ownerName: '', ownerPhone: '', ownerEmail: '' };

type Moderation = { restaurant: Pick<AdminRestaurantItem, 'id' | 'name'>; mode: 'reject' | 'suspend' };

export const AdminRestaurantsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProp<AdminTabParamList, 'AdminRestaurantsTab'>>();
  const navigation = useNavigation<any>();
  const wide = useIsWide();
  const now = useNow();

  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 350);
  // Bộ lọc nằm trong tham số route để màn Tổng quan mở thẳng bộ lọc (VD: "quán chưa có chủ")
  const filter: RestaurantFilter = route.params?.filter ?? 'all';
  const setFilter = (f: RestaurantFilter) => navigation.setParams({ filter: f });
  const [refreshing, setRefreshing] = useState(false);

  const [assignFor, setAssignFor] = useState<AdminRestaurantItem | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [moderation, setModeration] = useState<Moderation | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const listQuery = useQuery({
    queryKey: ['admin', 'restaurants', filter, q],
    queryFn: () => adminApi.listRestaurants({ q: q || undefined, filter, limit: 100 }),
    placeholderData: (prev) => prev,
  });
  const restaurants = listQuery.data?.items ?? [];
  const counts = listQuery.data?.counts;
  const activeId = detailId ?? (wide ? (restaurants[0]?.id ?? null) : null);

  const onRefresh = async () => {
    setRefreshing(true);
    await listQuery.refetch();
    setRefreshing(false);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const errMsg = (fallback: string) => (err: any) => toast(err?.response?.data?.message || fallback, 'error');

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminApi.approveRestaurant(id),
    onSuccess: (res) => {
      invalidate();
      toast(`Đã duyệt quán ${res.name}`, 'success');
    },
    onError: errMsg('Không thể duyệt quán'),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateRestaurantStatus(id, 'ACTIVE'),
    onSuccess: (res) => {
      invalidate();
      toast(`Đã mở lại quán ${res.name}`, 'success');
    },
    onError: errMsg('Không thể mở lại quán'),
  });

  const moderationMutation = useMutation({
    mutationFn: ({ id, mode, reason }: { id: string; mode: 'reject' | 'suspend'; reason: string }) =>
      mode === 'reject' ? adminApi.rejectRestaurant(id, reason) : adminApi.updateRestaurantStatus(id, 'SUSPENDED', reason),
    onSuccess: (res, vars) => {
      invalidate();
      setModeration(null);
      setModerationReason('');
      toast(vars.mode === 'reject' ? `Đã từ chối quán ${res.name}` : `Đã tạm khoá quán ${res.name}`, 'success');
    },
    onError: errMsg('Không thể thực hiện thao tác'),
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
      invalidate();
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
    onError: errMsg('Không thể tạo quán'),
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

  /** Trên điện thoại: đóng bảng chi tiết rồi mới mở bảng tiếp theo. */
  const fromDetail = (open: () => void) => {
    if (wide) {
      open();
      return;
    }
    setDetailId(null);
    setTimeout(open, MODAL_SWAP_DELAY);
  };

  const openModeration = (r: Moderation['restaurant'], mode: Moderation['mode']) => {
    setModerationReason('');
    setModeration({ restaurant: r, mode });
  };

  const renderItem = ({ item }: { item: AdminRestaurantItem }) => {
    const selected = wide && item.id === activeId;
    return (
      // Không đặt accessibilityRole="button": thẻ có nút Duyệt/Từ chối bên trong, trên web Pressable vai trò button
      // thành thẻ <button>, lồng <button> trong <button> là HTML không hợp lệ (React báo lỗi).
      <Pressable
        accessibilityLabel={`${item.name}. Mở chi tiết quán`}
        onPress={() => setDetailId(item.id)}
        className={cn(
          'gap-3 rounded-2xl border-2 bg-surface p-3 shadow-card active:opacity-90',
          selected ? 'border-brand-500' : item.status === 'PENDING_APPROVAL' ? 'border-warning/50' : 'border-surface',
        )}
      >
        <View className="flex-row gap-3">
          <AppImage uri={item.imageUrl} className="h-16 w-16 rounded-xl" />
          <View className="flex-1 gap-1">
            <Text variant="body-lg" weight="semibold" numberOfLines={1}>
              {item.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon name="star" size="xs" tone="rating" />
              <Text variant="caption" weight="bold">
                {item.rating.toFixed(1)}
              </Text>
              <Text variant="caption" weight="regular" tone="muted">
                ({item.ratingCount ?? 0})
              </Text>
              <Icon name="person-circle-outline" size="xs" tone="muted" />
              <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
                {item.needsOwner ? 'Chưa có chủ' : item.owner.fullName}
              </Text>
            </View>
            <RestaurantStatusBadges r={item} now={now} />
          </View>
          <Icon name="chevron-forward" size="sm" tone="muted" />
        </View>

        {/* Chỉ quán chờ duyệt mới có nút ngay trên thẻ; thao tác khác nằm trong chi tiết */}
        {item.status === 'PENDING_APPROVAL' && (
          <View className="flex-row gap-2">
            <Button
              label="Duyệt"
              leftIcon="checkmark-circle-outline"
              size="sm"
              className="flex-1"
              loading={approveMutation.isPending && approveMutation.variables === item.id}
              onPress={() => approveMutation.mutate(item.id)}
            />
            <Button
              label="Từ chối"
              leftIcon="close-circle-outline"
              variant="outline"
              size="sm"
              className="flex-1"
              onPress={() => openModeration(item, 'reject')}
            />
          </View>
        )}
      </Pressable>
    );
  };

  const list =
    listQuery.isLoading && !listQuery.data ? (
      <View className="px-4 pt-1">
        <ListSkeleton rows={5} withImage />
      </View>
    ) : listQuery.isError && !listQuery.data ? (
      <ErrorState onRetry={() => listQuery.refetch()} />
    ) : (
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName={cn('gap-3 px-4 pt-1', TAB_BAR_CLEARANCE)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={filter === 'unassigned' ? 'Mọi quán đều đã có chủ' : filter === 'pending' ? 'Không có quán chờ duyệt' : 'Không tìm thấy quán'}
            description={filter === 'unassigned' || filter === 'pending' ? 'Không có việc cần xử lý.' : 'Thử từ khoá khác hoặc đổi tab.'}
          />
        }
      />
    );

  const detailActions = (id: string) => {
    const item = restaurants.find((r) => r.id === id);
    const brief = { id, name: item?.name ?? 'quán' };
    return {
      onAssignOwner: () => fromDetail(() => item && setAssignFor(item)),
      onApprove: () => approveMutation.mutate(id),
      onReject: () => fromDetail(() => openModeration(brief, 'reject')),
      onSuspend: () => fromDetail(() => openModeration(brief, 'suspend')),
      onResume: () => resumeMutation.mutate(id),
      approving: approveMutation.isPending && approveMutation.variables === id,
      resuming: resumeMutation.isPending && resumeMutation.variables === id,
    };
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        compact
        title="Quán ăn"
        subtitle={counts ? `${counts.all ?? 0} quán · ${counts.pending ?? 0} chờ duyệt` : undefined}
        trailing={<IconButton icon="add" variant="glass" accessibilityLabel="Thêm quán mới" onPress={() => setCreateOpen(true)} />}
      >
        <ContentWidth>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
            placeholder="Tìm quán theo tên..."
            className="h-search-lg rounded-full bg-surface px-4"
          />
        </ContentWidth>
      </TabHeader>

      <ContentWidth className="flex-1">
        <TabStrip
          items={TABS.map((t) => ({ key: t.value, label: t.label, count: counts?.[t.value], tone: t.tone }))}
          value={filter}
          onChange={(f) => {
            setFilter(f);
            setDetailId(null);
          }}
        />
        <View className="h-3" />

        {wide ? (
          <View className="flex-1 flex-row gap-4 pr-4">
            <View className="w-[44%]">{list}</View>
            <View className={cn('flex-1 pt-1', TAB_BAR_CLEARANCE)}>
              {activeId ? (
                <View className="flex-1 rounded-2xl bg-surface p-4 shadow-card">
                  <RestaurantDetailPanel key={activeId} restaurantId={activeId} {...detailActions(activeId)} />
                </View>
              ) : (
                <DetailPlaceholder icon="storefront-outline" text="Chọn một quán để xem chi tiết." />
              )}
            </View>
          </View>
        ) : (
          list
        )}
      </ContentWidth>

      {!wide && (
        <BottomSheet visible={!!detailId} onClose={() => setDetailId(null)} title="Chi tiết quán">
          {detailId ? <RestaurantDetailPanel key={detailId} restaurantId={detailId} {...detailActions(detailId)} /> : <View />}
        </BottomSheet>
      )}

      <AssignOwnerSheet key={assignFor?.id ?? 'none'} restaurant={assignFor} onClose={() => setAssignFor(null)} />

      <BottomSheet
        visible={!!moderation}
        onClose={() => !moderationMutation.isPending && setModeration(null)}
        title={moderation?.mode === 'reject' ? 'Từ chối duyệt quán' : 'Tạm khoá quán ăn'}
        footer={
          <View className="pb-2">
            <Button
              label={moderation?.mode === 'reject' ? 'Xác nhận từ chối' : 'Xác nhận tạm khoá'}
              variant="danger"
              size="lg"
              loading={moderationMutation.isPending}
              onPress={() => {
                if (!moderation) return;
                if (moderationReason.trim().length < 3) {
                  toast('Vui lòng nhập lý do (ít nhất 3 ký tự)', 'error');
                  return;
                }
                moderationMutation.mutate({
                  id: moderation.restaurant.id,
                  mode: moderation.mode,
                  reason: moderationReason.trim(),
                });
              }}
            />
          </View>
        }
      >
        <View className="gap-3 pb-4">
          <Text variant="body" tone="secondary">
            {moderation?.mode === 'reject'
              ? `Nhập lý do từ chối hồ sơ quán "${moderation?.restaurant.name}". Chủ quán sẽ nhận được thông báo.`
              : `Nhập lý do tạm khoá quán "${moderation?.restaurant.name}". Quán sẽ ngừng hiển thị với khách.`}
          </Text>
          <Input
            label="Lý do *"
            value={moderationReason}
            onChangeText={setModerationReason}
            placeholder="VD: Địa chỉ hoặc thông tin quán chưa hợp lệ"
            multiline
          />
        </View>
      </BottomSheet>

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
