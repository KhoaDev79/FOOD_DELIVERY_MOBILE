import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import {
  AppImage,
  BottomSheet,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  IconButton,
  Input,
  LoadingSpinner,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { palette } from '../../theme';
import { MenuItem } from '../../types/api';
import { formatVND } from '../../utils/format';
import { DISCOUNT_OPTIONS, discountPercent, discountPriceFor, effectiveBasePrice } from '../../utils/menuPricing';

const MIN_PRICE = 1000;
const MAX_PRICE = 10_000_000; // giới hạn của backend (CreateMenuItemDto)

type SheetMode = { kind: 'create' } | { kind: 'edit'; item: MenuItem } | null;

export const OwnerMenuScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const toast = useToast();

  // Bảng thêm/sửa món (gộp hai trạng thái hiển thị cũ thành một)
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState('');
  const [discount, setDiscount] = useState(0); // % giảm giá: 0, 5, 7, 10, 15, 20
  const [formError, setFormError] = useState<{ name?: string; price?: string; submit?: string }>({});

  // Bảng thêm nhóm
  const [catSheet, setCatSheet] = useState(false);
  const [catName, setCatName] = useState('');
  const [catError, setCatError] = useState<string | undefined>();

  // Xác nhận xoá món (ConfirmDialog chạy được cả trên web)
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Quán
  const { data: restaurants, isLoading: loadingRest } = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
  });
  const restaurant = restaurants?.[0];

  // 2. Thực đơn của quán (backend trả cả món đã tắt "còn món", chỉ bỏ món đã xoá)
  const {
    data: detail,
    isLoading: loadingDetail,
    refetch,
  } = useQuery({
    queryKey: ['owner', 'menu', restaurant?.id],
    queryFn: () => (restaurant ? restaurantsApi.getDetail(restaurant.id) : null),
    enabled: Boolean(restaurant?.id),
  });

  const closeSheet = () => {
    setSheet(null);
    setFormError({});
  };

  const createItemMutation = useMutation({
    mutationFn: (data: Parameters<typeof restaurantsApi.createMenuItem>[1]) =>
      restaurantsApi.createMenuItem(restaurant!.id, data),
    onSuccess: () => {
      refetch();
      closeSheet();
      toast('Đã thêm món mới vào thực đơn.', 'success');
    },
    onError: (err: any) => {
      setFormError({ submit: err.response?.data?.message || 'Không thể tạo món mới' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof restaurantsApi.updateMenuItem>[1] }) =>
      restaurantsApi.updateMenuItem(id, data),
    onSuccess: () => {
      refetch();
      closeSheet();
      toast('Đã lưu thay đổi của món.', 'success');
    },
    onError: (err: any) => {
      setFormError({ submit: err.response?.data?.message || 'Không thể cập nhật món ăn' });
    },
  });

  // Bật/tắt "còn món": đổi ngay trên màn hình, lỗi thì trả lại như cũ
  const toggleAvailableMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      restaurantsApi.updateMenuItem(id, { isAvailable }),
    onMutate: async ({ id, isAvailable }) => {
      const key = ['owner', 'menu', restaurant?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: typeof detail) => {
        if (!old) return old;
        const patch = (items?: MenuItem[]) => items?.map((m) => (m.id === id ? { ...m, isAvailable } : m));
        return {
          ...old,
          categories: old.categories?.map((c) => ({ ...c, menuItems: patch(c.menuItems) ?? [] })),
          uncategorizedItems: patch(old.uncategorizedItems),
        };
      });
      return { previous };
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['owner', 'menu', restaurant?.id], ctx.previous);
      toast(err.response?.data?.message || 'Không thể đổi trạng thái món', 'error');
    },
    onSettled: () => refetch(),
  });

  const archiveItemMutation = useMutation({
    mutationFn: (id: string) => restaurantsApi.archiveMenuItem(id),
    onSuccess: () => {
      refetch();
      closeSheet();
      toast('Đã xoá món khỏi thực đơn.', 'success');
    },
    onError: (err: any) => {
      toast(err.response?.data?.message || 'Không thể xoá món', 'error');
    },
    onSettled: () => setDeleting(null),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string }) => restaurantsApi.createCategory(restaurant!.id, data),
    onSuccess: () => {
      refetch();
      setCatSheet(false);
      setCatName('');
      toast('Đã tạo nhóm món mới.', 'success');
    },
    onError: (err: any) => {
      setCatError(err.response?.data?.message || 'Không thể tạo nhóm');
    },
  });

  const openCreate = () => {
    setName('');
    setPrice('');
    setDescription('');
    setSelectedCatId(undefined);
    setImageUrl('');
    setDiscount(0);
    setFormError({});
    setSheet({ kind: 'create' });
  };

  const openEdit = (item: MenuItem) => {
    setName(item.name);
    setPrice(String(item.price));
    setDescription(item.description || '');
    setSelectedCatId(item.categoryId || undefined);
    setImageUrl(item.imageUrl || '');
    // Mức giảm đang áp dụng; nếu không khớp mức nào (dữ liệu cũ) thì chọn mức gần nhất
    const current = discountPercent(item);
    setDiscount(DISCOUNT_OPTIONS.reduce((best, p) => (Math.abs(p - current) < Math.abs(best - current) ? p : best), 0));
    setFormError({});
    setSheet({ kind: 'edit', item });
  };

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError((e) => ({ ...e, submit: 'Vui lòng cấp quyền truy cập ảnh để chọn hình món ăn.' }));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUrl(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
      }
    } catch {
      setFormError((e) => ({ ...e, submit: 'Không thể chọn ảnh từ thiết bị' }));
    }
  };

  const handleSaveItem = () => {
    const errors: typeof formError = {};
    if (!name.trim()) errors.name = 'Vui lòng nhập tên món';
    const numPrice = parseInt(price.replace(/\D/g, ''), 10);
    if (!price.trim() || isNaN(numPrice)) errors.price = 'Vui lòng nhập giá bán';
    else if (numPrice < MIN_PRICE) errors.price = 'Giá tối thiểu là 1.000 ₫';
    else if (numPrice > MAX_PRICE) errors.price = 'Giá tối đa là 10.000.000 ₫';
    setFormError(errors);
    if (errors.name || errors.price) return;

    if (sheet?.kind === 'edit') {
      // Gửi chuỗi rỗng để xoá được mô tả/ảnh (undefined = giữ nguyên ở backend)
      updateItemMutation.mutate({
        id: sheet.item.id,
        data: {
          name: name.trim(),
          price: numPrice,
          description: description.trim(),
          categoryId: selectedCatId || undefined,
          imageUrl: imageUrl.trim(),
          discountPercent: discount,
        },
      });
    } else {
      createItemMutation.mutate({
        name: name.trim(),
        price: numPrice,
        description: description.trim() || undefined,
        categoryId: selectedCatId || undefined,
        imageUrl: imageUrl.trim() || undefined,
        discountPercent: discount,
      });
    }
  };

  const handleCreateCategory = () => {
    if (!catName.trim()) {
      setCatError('Vui lòng nhập tên nhóm');
      return;
    }
    setCatError(undefined);
    createCategoryMutation.mutate({ name: catName.trim() });
  };

  const stats = useMemo(() => {
    const all = [...(detail?.categories?.flatMap((c) => c.menuItems ?? []) ?? []), ...(detail?.uncategorizedItems ?? [])];
    const available = all.filter((m) => m.isAvailable).length;
    return { total: all.length, available, soldOut: all.length - available };
  }, [detail]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loadingRest || loadingDetail) {
    return <LoadingSpinner message="Đang tải thực đơn quán..." />;
  }

  if (!restaurant || !detail) {
    return (
      <View className="flex-1 bg-canvas-subtle">
        {isFocused && <StatusBar style="light" />}
        <TabHeader title="Thực đơn" />
        <EmptyState icon="storefront-outline" title="Chưa có dữ liệu nhà hàng" />
      </View>
    );
  }

  const isEdit = sheet?.kind === 'edit';
  const saving = createItemMutation.isPending || updateItemMutation.isPending;
  const sections = [
    ...(detail.categories ?? []).map((c) => ({ id: c.id, title: c.name, items: c.menuItems ?? [] })),
    ...(detail.uncategorizedItems?.length
      ? [{ id: 'none', title: 'Chưa phân nhóm', items: detail.uncategorizedItems }]
      : []),
  ];

  // Xác nhận xoá món: ConfirmDialog chạy được cả trên web (Alert.alert có nút thì không).
  const confirmDelete = (
    <ConfirmDialog
      visible={!!deleting}
      title="Xoá món này?"
      message={deleting ? `"${deleting.name}" sẽ bị xoá khỏi thực đơn. Đơn hàng cũ vẫn giữ thông tin món.` : ''}
      confirmLabel="Xoá món"
      destructive
      loading={archiveItemMutation.isPending}
      onCancel={() => !archiveItemMutation.isPending && setDeleting(null)}
      onConfirm={() => deleting && archiveItemMutation.mutate(deleting.id)}
    />
  );

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}

      <ScrollView
        contentContainerClassName={TAB_BAR_CLEARANCE}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
      >
        <TabHeader title="Thực đơn" subtitle={restaurant.name}>
          <View className="flex-row gap-2">
            <Stat label="Tổng món" value={stats.total} />
            <Stat label="Đang bán" value={stats.available} />
            <Stat label="Hết món" value={stats.soldOut} />
          </View>
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={openCreate}
              className="min-h-touch flex-[2] flex-row items-center justify-center gap-2 rounded-full bg-surface active:opacity-85"
            >
              <Icon name="add-circle" size="md" tone="brand" />
              <Text variant="body" weight="bold" tone="brand">
                Thêm món
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCatName('');
                setCatError(undefined);
                setCatSheet(true);
              }}
              className="min-h-touch flex-1 flex-row items-center justify-center gap-2 rounded-full border border-surface/40 active:opacity-80"
            >
              <Icon name="folder-open-outline" size="md" tone="inverse" />
              <Text variant="body" weight="semibold" tone="inverse">
                Thêm nhóm
              </Text>
            </Pressable>
          </View>
        </TabHeader>

        <View className="gap-6 px-4 pt-5">
          {sections.length === 0 || stats.total === 0 ? (
            <EmptyState
              variant="card"
              icon="restaurant-outline"
              title="Thực đơn đang trống"
              description="Thêm món đầu tiên để khách có thể đặt món của quán."
              actionLabel="Thêm món"
              onAction={openCreate}
            />
          ) : null}

          {sections.map((section) =>
            section.items.length === 0 && section.id !== 'none' ? (
              <View key={section.id} className="gap-2">
                <SectionTitle title={section.title} count={0} />
                <Text variant="caption" tone="muted" className="px-1">
                  Nhóm này chưa có món. Khi thêm món, chọn nhóm "{section.title}".
                </Text>
              </View>
            ) : (
              <View key={section.id} className="gap-2.5">
                <SectionTitle title={section.title} count={section.items.length} />
                {section.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    onDelete={() => setDeleting(item)}
                    onToggle={(val) => toggleAvailableMutation.mutate({ id: item.id, isAvailable: val })}
                  />
                ))}
              </View>
            ),
          )}
        </View>
      </ScrollView>

      {/* Bảng thêm / sửa món */}
      <BottomSheet
        visible={!!sheet}
        onClose={closeSheet}
        title={isEdit ? 'Sửa món ăn' : 'Thêm món mới'}
        footer={
          <View className="gap-2 pb-2">
            {!!formError.submit && (
              <Text variant="caption" tone="danger" className="text-center">
                {formError.submit}
              </Text>
            )}
            <View className="flex-row gap-2">
              {sheet?.kind === 'edit' && (
                <Button
                  label="Xoá món"
                  leftIcon="trash-outline"
                  variant="outline"
                  size="lg"
                  disabled={saving}
                  onPress={() => setDeleting(sheet.item)}
                  className="flex-1"
                />
              )}
              <Button
                label={isEdit ? 'Lưu thay đổi' : 'Thêm vào thực đơn'}
                variant="primary"
                size="lg"
                loading={saving}
                onPress={handleSaveItem}
                className="flex-[2]"
              />
            </View>
          </View>
        }
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-4">
          {/* Ảnh món */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={imageUrl ? 'Đổi ảnh món' : 'Chọn ảnh món'}
            onPress={handlePickImage}
            className="active:opacity-85"
          >
            <AppImage uri={imageUrl} className="h-40 w-full rounded-xl" fallbackIcon="image-outline">
              <View className="absolute bottom-2 right-2 flex-row items-center gap-1.5 rounded-full bg-scrim px-3 py-1.5">
                <Icon name="camera-outline" size="sm" tone="inverse" />
                <Text variant="caption" weight="semibold" tone="inverse">
                  {imageUrl ? 'Đổi ảnh' : 'Chọn ảnh từ máy'}
                </Text>
              </View>
            </AppImage>
          </Pressable>

          <Input
            label="Tên món *"
            placeholder="VD: Bún chả đặc biệt"
            value={name}
            onChangeText={setName}
            error={formError.name}
          />
          <Input
            label="Giá bán (₫) *"
            placeholder="VD: 55000"
            keyboardType="number-pad"
            value={price}
            onChangeText={(t) => setPrice(t.replace(/\D/g, ''))}
            error={formError.price}
            hint={price && !formError.price ? formatVND(parseInt(price, 10) || 0) : undefined}
          />
          <Input
            label="Mô tả"
            placeholder="VD: Thịt nướng than hoa, nước mắm chua ngọt"
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Input
            label="Hoặc dán đường dẫn ảnh"
            placeholder="https://..."
            autoCapitalize="none"
            value={imageUrl.startsWith('data:') ? '' : imageUrl}
            onChangeText={setImageUrl}
          />

          {/* Giảm giá */}
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Giảm giá
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DISCOUNT_OPTIONS.map((p) => {
                const selected = discount === p;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={p ? `Giảm ${p} phần trăm` : 'Không giảm giá'}
                    onPress={() => setDiscount(p)}
                    className={`min-h-touch min-w-[56px] items-center justify-center rounded-full border px-3 active:opacity-75 ${
                      selected ? (p ? 'border-accent-500 bg-accent-50' : 'border-brand-500 bg-brand-50') : 'border-line bg-surface'
                    }`}
                  >
                    <Text
                      variant="body"
                      weight={selected ? 'bold' : 'medium'}
                      tone={selected ? (p ? 'accent' : 'brand') : 'default'}
                    >
                      {p ? `${p}%` : 'Không giảm'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {(() => {
              const base = parseInt(price, 10);
              const sale = base ? discountPriceFor(base, discount) : null;
              if (!discount) return null;
              return (
                <View className="flex-row items-center gap-2 rounded-lg bg-accent-50 px-3 py-2">
                  <Icon name="pricetag-outline" size="sm" tone="accent" />
                  <Text variant="caption" className="flex-1">
                    {sale
                      ? `Khách trả ${formatVND(sale)} thay vì ${formatVND(base)} (bớt ${formatVND(base - sale)})`
                      : 'Nhập giá bán để xem giá sau giảm'}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Nhóm món */}
          <View className="gap-2">
            <Text variant="caption" tone="secondary">
              Nhóm món
            </Text>
            {(detail.categories?.length ?? 0) === 0 ? (
              <Text variant="caption" tone="muted">
                Chưa có nhóm nào. Dùng nút "Thêm nhóm" ở đầu trang để tạo.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {detail.categories?.map((cat) => {
                  const selected = selectedCatId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      // Khi sửa món, backend không cho bỏ nhóm (chỉ đổi sang nhóm khác)
                      onPress={() => setSelectedCatId(selected && !isEdit ? undefined : cat.id)}
                      className={`min-h-touch justify-center rounded-full border px-4 active:opacity-75 ${
                        selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'
                      }`}
                    >
                      <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'default'}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
        {!!sheet && confirmDelete}
      </BottomSheet>

      {/* Bảng thêm nhóm */}
      <BottomSheet
        visible={catSheet}
        onClose={() => setCatSheet(false)}
        title="Thêm nhóm món"
        footer={
          <View className="pb-2">
            <Button
              label="Tạo nhóm"
              variant="primary"
              size="lg"
              loading={createCategoryMutation.isPending}
              onPress={handleCreateCategory}
            />
          </View>
        }
      >
        <View className="pb-4">
          <Input
            label="Tên nhóm"
            placeholder="VD: Món chính, Đồ uống, Tráng miệng"
            value={catName}
            onChangeText={setCatName}
            error={catError}
            autoFocus
          />
        </View>
      </BottomSheet>

      {/* Khi bảng sửa món đang mở, hộp xác nhận nằm trong bảng (iOS không mở được Modal chồng ngoài Modal) */}
      {!sheet && confirmDelete}
    </View>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View className="flex-1 rounded-lg bg-surface/15 px-3 py-2.5">
    <Text variant="title" weight="bold" tone="inverse">
      {value}
    </Text>
    <Text variant="caption" tone="inverse" className="opacity-85">
      {label}
    </Text>
  </View>
);

const SectionTitle: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <View className="flex-row items-center gap-2 px-1">
    <Text variant="headline" accessibilityRole="header" className="flex-1" numberOfLines={1}>
      {title}
    </Text>
    <View className="rounded-full bg-surface px-2.5 py-0.5">
      <Text variant="caption" tone="secondary">
        {count} món
      </Text>
    </View>
  </View>
);

const MenuItemCard: React.FC<{
  item: MenuItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (value: boolean) => void;
}> = ({ item, onEdit, onDelete, onToggle }) => (
  <View className="flex-row items-center gap-3 rounded-xl bg-surface p-3 shadow-card">
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sửa món ${item.name}`}
      onPress={onEdit}
      className="flex-1 flex-row items-center gap-3 active:opacity-75"
    >
      <AppImage
        uri={item.imageUrl}
        className={`h-[72px] w-[72px] rounded-lg ${item.isAvailable ? '' : 'opacity-50'}`}
      />
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight="semibold" numberOfLines={2}>
          {item.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2">
          <Text variant="body" weight="bold" tone="brand">
            {formatVND(effectiveBasePrice(item))}
          </Text>
          {discountPercent(item) > 0 && (
            <>
              <Text variant="caption" tone="muted" className="line-through">
                {formatVND(item.price)}
              </Text>
              <View className="rounded-full bg-accent-500 px-1.5 py-0.5">
                <Text variant="micro" tone="inverse">
                  -{discountPercent(item)}%
                </Text>
              </View>
            </>
          )}
        </View>
        {item.isAvailable ? (
          !!item.description && (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {item.description}
            </Text>
          )
        ) : (
          <View className="self-start rounded-full bg-danger-soft px-2 py-0.5">
            <Text variant="micro" className="text-danger-strong">
              Tạm hết món
            </Text>
          </View>
        )}
      </View>
    </Pressable>

    <View className="items-center gap-1">
      <Switch
        accessibilityLabel={`${item.name}: ${item.isAvailable ? 'đang bán' : 'tạm hết'}`}
        value={item.isAvailable}
        onValueChange={onToggle}
        trackColor={{ false: palette.line.DEFAULT, true: palette.brand['500'] }}
        thumbColor={palette.surface}
      />
      <IconButton
        icon="trash-outline"
        variant="ghost"
        size="sm"
        tone="danger"
        accessibilityLabel={`Xoá món ${item.name}`}
        onPress={onDelete}
      />
    </View>
  </View>
);
