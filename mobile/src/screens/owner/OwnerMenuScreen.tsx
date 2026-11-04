import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { restaurantsApi } from '../../api/restaurants';
import {
  draftFromOptions,
  draftToInput,
  EMPTY_OPTIONS_DRAFT,
  MenuOptionsEditor,
  MoneyInput,
  optionsSummary,
  OptionsDraft,
  validateDraft,
} from '../../components/modules/owner/MenuOptionsEditor';
import { OwnerRestaurantSelector } from '../../components/modules/owner/OwnerRestaurantSelector';
import {
  AppImage,
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  Icon,
  Input,
  LoadingSpinner,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useOwnerRestaurants } from '../../hooks/useOwnerRestaurants';
import { palette } from '../../theme';
import { MenuItem } from '../../types/api';
import { formatVND } from '../../utils/format';
import { formatRestockTime, nextStockResetAt, StockStatus, stockStatusOf } from '../../utils/menuStock';
import { DISCOUNT_OPTIONS, discountPercent, discountPriceFor, effectiveBasePrice } from '../../utils/menuPricing';

const MIN_PRICE = 1000;
const MAX_PRICE = 10_000_000; // giới hạn của backend (CreateMenuItemDto)

type SheetMode = { kind: 'create' } | { kind: 'edit'; item: MenuItem } | null;

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export const OwnerMenuScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const toast = useToast();

  // Bảng thêm/sửa món
  const [sheet, setSheet] = useState<SheetMode>(null);
  // Món đang chọn kiểu "hết món" (bảng 2 lựa chọn: hết hôm nay / hết đến khi bật lại)
  const [stockItem, setStockItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(''); // chỉ chữ số
  const [description, setDescription] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageUrl, setShowImageUrl] = useState(false);
  const [discount, setDiscount] = useState(0); // % giảm giá: 0, 5, 7, 10, 15, 20
  const [available, setAvailable] = useState(true);
  const [isTimedDish, setIsTimedDish] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [optionsDraft, setOptionsDraft] = useState<OptionsDraft>(EMPTY_OPTIONS_DRAFT);
  const [formError, setFormError] = useState<{ name?: string; price?: string; submit?: string }>({});

  // Bảng thêm nhóm
  const [catSheet, setCatSheet] = useState(false);
  const [catName, setCatName] = useState('');
  const [catError, setCatError] = useState<string | undefined>();

  // Tìm kiếm & lọc theo nhóm
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');

  // Xác nhận xoá món (ConfirmDialog chạy được cả trên web)
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Quán
  const { restaurants, restaurant, isLoading: loadingRest } = useOwnerRestaurants();

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
      const msg = err.response?.data?.message;
      setFormError({ submit: (Array.isArray(msg) ? msg.join('\n') : msg) || 'Không thể tạo món mới' });
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
      const msg = err.response?.data?.message;
      setFormError({ submit: (Array.isArray(msg) ? msg.join('\n') : msg) || 'Không thể cập nhật món ăn' });
    },
  });

  // Đổi tình trạng món (còn / hết hôm nay / hết đến khi bật lại): đổi ngay trên màn hình, lỗi thì trả lại như cũ
  const stockMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StockStatus }) => restaurantsApi.setMenuItemStock(id, status),
    onMutate: async ({ id, status }) => {
      const isAvailable = status === 'AVAILABLE';
      const soldOutUntil = status === 'SOLD_OUT_TODAY' ? nextStockResetAt().toISOString() : null;
      const key = ['owner', 'menu', restaurant?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: typeof detail) => {
        if (!old) return old;
        const patch = (items?: MenuItem[]) =>
          items?.map((m) => (m.id === id ? { ...m, isAvailable, soldOutUntil } : m));
        return {
          ...old,
          categories: old.categories?.map((c) => ({ ...c, menuItems: patch(c.menuItems) ?? [] })),
          uncategorizedItems: patch(old.uncategorizedItems),
        };
      });
      return { previous };
    },
    onSuccess: (_data, { status }) => {
      toast(
        status === 'AVAILABLE'
          ? 'Đã mở bán lại món.'
          : status === 'SOLD_OUT_TODAY'
            ? `Đã báo hết hôm nay. Món tự mở bán lại ${formatRestockTime(nextStockResetAt())}.`
            : 'Đã báo hết món. Bấm "Hết món" để mở bán lại khi có hàng.',
        'success',
      );
    },
    onError: (err: any, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['owner', 'menu', restaurant?.id], ctx.previous);
      toast(err.response?.data?.message || 'Không thể đổi trạng thái món', 'error');
    },
    onSettled: () => refetch(),
  });

  const setStock = (id: string, status: StockStatus) => {
    setStockItem(null);
    stockMutation.mutate({ id, status });
  };

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
    setSelectedCatId(catFilter !== 'ALL' && catFilter !== 'none' ? catFilter : undefined);
    setImageUrl('');
    setShowImageUrl(false);
    setDiscount(0);
    setAvailable(true);
    setIsTimedDish(false);
    setAvailableFrom('');
    setAvailableTo('');
    setOptionsDraft(EMPTY_OPTIONS_DRAFT);
    setFormError({});
    setSheet({ kind: 'create' });
  };

  const openEdit = (item: MenuItem) => {
    setName(item.name);
    setPrice(String(item.price));
    setDescription(item.description || '');
    setSelectedCatId(item.categoryId || undefined);
    setImageUrl(item.imageUrl || '');
    setShowImageUrl(false);
    // Mức giảm đang áp dụng; nếu không khớp mức nào (dữ liệu cũ) thì chọn mức gần nhất
    const current = discountPercent(item);
    setDiscount(DISCOUNT_OPTIONS.reduce((best, p) => (Math.abs(p - current) < Math.abs(best - current) ? p : best), 0));
    setAvailable(item.isAvailable);
    const hasTime = Boolean(item.availableFrom && item.availableTo);
    setIsTimedDish(hasTime);
    setAvailableFrom(item.availableFrom || '');
    setAvailableTo(item.availableTo || '');
    setOptionsDraft(draftFromOptions(item.options));
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
    const numPrice = parseInt(price, 10);
    if (!price || isNaN(numPrice)) errors.price = 'Vui lòng nhập giá bán';
    else if (numPrice < MIN_PRICE) errors.price = 'Giá tối thiểu là 1.000 ₫';
    else if (numPrice > MAX_PRICE) errors.price = 'Giá tối đa là 10.000.000 ₫';
    const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (isTimedDish) {
      const from = availableFrom.trim();
      const to = availableTo.trim();
      if (!from || !to) {
        errors.submit = 'Vui lòng nhập đầy đủ giờ mở bán (bắt đầu và kết thúc)';
      } else if (!TIME_REGEX.test(from) || !TIME_REGEX.test(to)) {
        errors.submit = 'Khung giờ bán phải đúng định dạng HH:mm (VD: 06:00, 10:30)';
      }
    }
    const optionsError = validateDraft(optionsDraft);
    if (optionsError) errors.submit = optionsError;
    setFormError(errors);
    if (errors.name || errors.price || errors.submit) return;

    const options = draftToInput(optionsDraft);
    if (sheet?.kind === 'edit') {
      // Gửi chuỗi rỗng để xoá được mô tả/ảnh, null để xoá tuỳ chọn (undefined = giữ nguyên ở backend)
      updateItemMutation.mutate({
        id: sheet.item.id,
        data: {
          name: name.trim(),
          price: numPrice,
          description: description.trim(),
          categoryId: selectedCatId || undefined,
          imageUrl: imageUrl.trim(),
          discountPercent: discount,
          isAvailable: available,
          availableFrom: isTimedDish ? availableFrom.trim() : null,
          availableTo: isTimedDish ? availableTo.trim() : null,
          options,
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
        isAvailable: available,
        availableFrom: isTimedDish ? availableFrom.trim() : undefined,
        availableTo: isTimedDish ? availableTo.trim() : undefined,
        ...(options ? { options } : {}),
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

  const sections = useMemo(
    () => [
      ...(detail?.categories ?? []).map((c) => ({ id: c.id, title: c.name, items: c.menuItems ?? [] })),
      ...(detail?.uncategorizedItems?.length
        ? [{ id: 'none', title: 'Chưa phân nhóm', items: detail.uncategorizedItems }]
        : []),
    ],
    [detail],
  );

  const stats = useMemo(() => {
    const all = sections.flatMap((s) => s.items);
    const available = all.filter((m) => m.isAvailable).length;
    return { total: all.length, available, soldOut: all.length - available };
  }, [sections]);

  // Lọc theo nhóm đang chọn và từ khoá (không dấu)
  const visibleSections = useMemo(() => {
    const needle = normalize(search.trim());
    return sections
      .filter((s) => catFilter === 'ALL' || s.id === catFilter)
      .map((s) => ({
        ...s,
        items: needle ? s.items.filter((m) => normalize(m.name).includes(needle)) : s.items,
      }))
      .filter((s) => !needle || s.items.length > 0);
  }, [sections, catFilter, search]);

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
  const numPrice = parseInt(price, 10) || 0;
  const salePrice = numPrice ? discountPriceFor(numPrice, discount) : null;

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
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brand['500']}
            colors={[palette.brand['500']]}
          />
        }
      >
        <TabHeader
          title="Thực đơn"
          subtitle={<OwnerRestaurantSelector restaurants={restaurants} currentRestaurant={restaurant} />}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm món mới"
              onPress={openCreate}
              className="h-10 flex-row items-center gap-1.5 rounded-full bg-surface px-4 active:opacity-85"
            >
              <Icon name="add" size="md" tone="brand" />
              <Text variant="body" weight="bold" tone="brand">
                Thêm món
              </Text>
            </Pressable>
          }
        >
          {/* Số liệu nhanh dạng chip */}
          <View className="flex-row flex-wrap gap-2">
            <HeaderChip icon="restaurant" label={`${stats.total} món`} />
            <HeaderChip icon="checkmark-circle" label={`${stats.available} đang bán`} dot="bg-success" />
            {stats.soldOut > 0 && <HeaderChip icon="remove-circle" label={`${stats.soldOut} hết món`} dot="bg-warning" />}
          </View>
        </TabHeader>

        {/* Tìm kiếm + nhóm món (dính trên cùng khi cuộn) */}
        <View className="gap-2.5 bg-canvas-subtle pb-2 pt-3">
          <View className="px-4">
            <SearchBar
              value={search}
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              placeholder="Tìm món trong thực đơn"
              autoCorrect={false}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
            <CategoryChip label="Tất cả" count={stats.total} selected={catFilter === 'ALL'} onPress={() => setCatFilter('ALL')} />
            {sections.map((s) => (
              <CategoryChip
                key={s.id}
                label={s.title}
                count={s.items.length}
                selected={catFilter === s.id}
                onPress={() => setCatFilter(s.id)}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm nhóm món"
              onPress={() => {
                setCatName('');
                setCatError(undefined);
                setCatSheet(true);
              }}
              className="h-9 flex-row items-center gap-1 rounded-full border border-dashed border-brand-300 px-3 active:bg-brand-50"
            >
              <Icon name="add" size="sm" tone="brand" />
              <Text variant="caption" weight="semibold" tone="brand">
                Nhóm mới
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        <View className="gap-5 px-4 pt-2">
          {stats.total === 0 ? (
            <EmptyState
              variant="card"
              icon="restaurant-outline"
              title="Thực đơn đang trống"
              description="Thêm món đầu tiên để khách có thể đặt món của quán."
              actionLabel="Thêm món"
              onAction={openCreate}
            />
          ) : visibleSections.length === 0 ? (
            <EmptyState icon="search-outline" title="Không tìm thấy món" description="Thử từ khoá khác hoặc chọn nhóm khác." />
          ) : null}

          {visibleSections.map((section) => (
            <View key={section.id} className="gap-2.5">
              <View className="flex-row items-center gap-2 px-1">
                <Text variant="headline" weight="bold" accessibilityRole="header" className="flex-1" numberOfLines={1}>
                  {section.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {section.items.length} món
                </Text>
              </View>
              {section.items.length === 0 ? (
                <Text variant="caption" weight="regular" tone="muted" className="px-1">
                  Nhóm này chưa có món. Khi thêm món, chọn nhóm "{section.title}".
                </Text>
              ) : (
                section.items.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => openEdit(item)}
                    // Đang bán → hỏi kiểu hết món; đang hết → mở bán lại ngay
                    onStockPress={() => (item.isAvailable ? setStockItem(item) : setStock(item.id, 'AVAILABLE'))}
                  />
                ))
              )}
            </View>
          ))}
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
                  label="Xoá"
                  leftIcon="trash-outline"
                  variant="dangerSoft"
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-5 pb-4" showsVerticalScrollIndicator={false}>
          {/* Ảnh món */}
          <View className="gap-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={imageUrl ? 'Đổi ảnh món' : 'Chọn ảnh món'}
              onPress={handlePickImage}
              className="active:opacity-85"
            >
              <AppImage uri={imageUrl} className="h-44 w-full rounded-2xl" fallbackIcon="image-outline">
                <View className="absolute bottom-2.5 right-2.5 flex-row items-center gap-1.5 rounded-full bg-scrim px-3 py-1.5">
                  <Icon name="camera-outline" size="sm" tone="inverse" />
                  <Text variant="caption" weight="semibold" tone="inverse">
                    {imageUrl ? 'Đổi ảnh' : 'Chọn ảnh từ máy'}
                  </Text>
                </View>
              </AppImage>
            </Pressable>
            <View className="flex-row items-center justify-between px-1">
              <Text variant="micro" weight="regular" tone="muted">
                Ảnh ngang 4:3, rõ món, nền sạch giúp khách đặt nhiều hơn
              </Text>
              <Pressable hitSlop={8} onPress={() => setShowImageUrl((v) => !v)}>
                <Text variant="micro" weight="semibold" tone="brand">
                  {showImageUrl ? 'Ẩn link ảnh' : 'Dán link ảnh'}
                </Text>
              </Pressable>
            </View>
            {showImageUrl && (
              <Input
                placeholder="https://..."
                autoCapitalize="none"
                value={imageUrl.startsWith('data:') ? '' : imageUrl}
                onChangeText={setImageUrl}
              />
            )}
          </View>

          {/* Thông tin cơ bản */}
          <View className="gap-4">
            <Input label="Tên món *" placeholder="VD: Bún chả đặc biệt" value={name} onChangeText={setName} error={formError.name} />
            <View className="gap-1.5">
              <Text variant="caption" weight="medium" tone="secondary">
                Giá bán *
              </Text>
              <MoneyInput
                value={price}
                onChange={setPrice}
                placeholder="VD: 55.000"
                accessibilityLabel="Giá bán"
                error={!!formError.price}
                large
              />
              {!!formError.price && (
                <Text variant="caption" tone="danger">
                  {formError.price}
                </Text>
              )}
            </View>
            <Input
              label="Mô tả"
              placeholder="VD: Thịt nướng than hoa, nước mắm chua ngọt"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* Giảm giá */}
          <View className="gap-2">
            <Text variant="caption" weight="medium" tone="secondary">
              Giảm giá
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {DISCOUNT_OPTIONS.map((p) => {
                const selected = discount === p;
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={p ? `Giảm ${p} phần trăm` : 'Không giảm giá'}
                    onPress={() => setDiscount(p)}
                    className={cn(
                      'h-10 min-w-[60px] items-center justify-center rounded-full border px-3.5 active:opacity-75',
                      selected ? (p ? 'border-accent-500 bg-accent-50' : 'border-brand-500 bg-brand-50') : 'border-line bg-surface',
                    )}
                  >
                    <Text variant="body" weight={selected ? 'bold' : 'medium'} tone={selected ? (p ? 'accent' : 'brand') : 'default'}>
                      {p ? `-${p}%` : 'Không giảm'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!!discount && (
              <View className="flex-row items-center gap-2 rounded-xl bg-accent-50 px-3 py-2.5">
                <Icon name="pricetag-outline" size="sm" tone="accent" />
                <Text variant="caption" className="flex-1">
                  {salePrice ? (
                    <>
                      Khách trả{' '}
                      <Text variant="caption" weight="bold" tone="accent">
                        {formatVND(salePrice)}
                      </Text>{' '}
                      thay vì {formatVND(numPrice)}
                    </>
                  ) : (
                    'Nhập giá bán để xem giá sau giảm'
                  )}
                </Text>
              </View>
            )}
          </View>

          {/* Nhóm món */}
          <View className="gap-2">
            <Text variant="caption" weight="medium" tone="secondary">
              Nhóm món
            </Text>
            {(detail.categories?.length ?? 0) === 0 ? (
              <Text variant="caption" weight="regular" tone="muted">
                Chưa có nhóm nào. Dùng nút "Nhóm mới" trong thực đơn để tạo.
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
                      className={cn(
                        'h-10 justify-center rounded-full border px-4 active:opacity-75',
                        selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                      )}
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

          {/* Size / topping / mức */}
          <MenuOptionsEditor
            value={optionsDraft}
            onChange={setOptionsDraft}
            basePrice={salePrice ?? numPrice}
          />

          {/* Còn món */}
          <View className="flex-row items-center gap-3 rounded-2xl border border-line-subtle bg-surface p-3.5">
            <View className={cn('h-10 w-10 items-center justify-center rounded-full', available ? 'bg-success-soft' : 'bg-canvas-subtle')}>
              <Icon name={available ? 'checkmark-circle' : 'remove-circle'} size="md" tone={available ? 'success' : 'muted'} />
            </View>
            <View className="flex-1">
              <Text variant="body" weight="semibold">
                {available ? 'Đang bán' : 'Tạm hết món'}
              </Text>
              <Text variant="micro" weight="regular" tone="muted">
                {available ? 'Khách đặt được món này' : 'Món vẫn hiện nhưng khách không đặt được'}
              </Text>
            </View>
            <Switch
              accessibilityLabel={available ? 'Chuyển sang tạm hết món' : 'Mở bán lại món'}
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
              thumbColor={palette.surface}
            />
          </View>
          {/* Khung giờ mở bán (Mục 4.4) */}
          <View className="gap-2.5 rounded-2xl border border-line-subtle bg-surface p-3.5">
            <View className="flex-row items-center gap-3">
              <View className={cn('h-10 w-10 items-center justify-center rounded-full', isTimedDish ? 'bg-brand-50' : 'bg-canvas-subtle')}>
                <Icon name="time-outline" size="md" tone={isTimedDish ? 'brand' : 'muted'} />
              </View>
              <View className="flex-1">
                <Text variant="body" weight="semibold">
                  Khung giờ mở bán
                </Text>
                <Text variant="micro" weight="regular" tone="muted">
                  {isTimedDish ? 'Chỉ cho khách đặt trong khung giờ cài đặt' : 'Mở bán cả ngày trong giờ quán mở'}
                </Text>
              </View>
              <Switch
                accessibilityLabel={isTimedDish ? 'Tắt bán theo khung giờ' : 'Bật bán theo khung giờ'}
                value={isTimedDish}
                onValueChange={(val) => {
                  setIsTimedDish(val);
                  if (val && !availableFrom && !availableTo) {
                    setAvailableFrom('06:00');
                    setAvailableTo('10:30');
                  }
                }}
                trackColor={{ false: palette.line.DEFAULT, true: palette.brand['500'] }}
                thumbColor={palette.surface}
              />
            </View>

            {isTimedDish && (
              <View className="gap-3 border-t border-line-subtle pt-3">
                <View className="gap-1.5">
                  <Text variant="caption" weight="medium" tone="secondary">
                    Chọn nhanh khung giờ phổ biến
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[
                      { label: 'Sáng (06:00 – 10:30)', from: '06:00', to: '10:30' },
                      { label: 'Trưa (10:30 – 14:00)', from: '10:30', to: '14:00' },
                      { label: 'Tối (17:00 – 22:00)', from: '17:00', to: '22:00' },
                      { label: 'Đêm (22:00 – 02:00)', from: '22:00', to: '02:00' },
                    ].map((preset) => {
                      const active = availableFrom === preset.from && availableTo === preset.to;
                      return (
                        <Pressable
                          key={preset.label}
                          accessibilityRole="button"
                          onPress={() => {
                            setAvailableFrom(preset.from);
                            setAvailableTo(preset.to);
                          }}
                          className={cn(
                            'h-8 items-center justify-center rounded-full border px-3',
                            active ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                          )}
                        >
                          <Text variant="micro" weight={active ? 'bold' : 'medium'} tone={active ? 'brand' : 'default'}>
                            {preset.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Input
                      label="Bắt đầu từ (HH:mm)"
                      placeholder="06:00"
                      value={availableFrom}
                      onChangeText={setAvailableFrom}
                      maxLength={5}
                      autoCapitalize="none"
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Đến lúc (HH:mm)"
                      placeholder="10:30"
                      value={availableTo}
                      onChangeText={setAvailableTo}
                      maxLength={5}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
                <Text variant="micro" tone="muted">
                  * Ngoài khung giờ này, món sẽ hiện nhãn "Bán từ {availableFrom || '...'} " và khách không thể thêm vào giỏ.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        {!!sheet && confirmDelete}
      </BottomSheet>

      {/* Bảng chọn kiểu hết món (giống Grab Merchant / ShopeeFood Partner) */}
      <BottomSheet visible={!!stockItem} onClose={() => setStockItem(null)} title="Báo hết món">
        <View className="gap-3 pb-4">
          {!!stockItem && (
            <View className="flex-row items-center gap-3 rounded-2xl bg-canvas-subtle p-3">
              <AppImage uri={stockItem.imageUrl} className="h-12 w-12 rounded-xl" />
              <Text variant="body" weight="bold" numberOfLines={2} className="flex-1">
                {stockItem.name}
              </Text>
            </View>
          )}
          <StockOption
            icon="moon-outline"
            box="bg-accent-50"
            iconColor={palette.accent['600']}
            title="Hết hôm nay"
            subtitle={`Tự mở bán lại lúc ${formatRestockTime(nextStockResetAt())}. Không cần nhớ bật lại.`}
            recommended
            onPress={() => stockItem && setStock(stockItem.id, 'SOLD_OUT_TODAY')}
          />
          <StockOption
            icon="pause-circle-outline"
            box="bg-canvas-subtle"
            iconColor={palette.ink.secondary}
            title="Hết đến khi tôi bật lại"
            subtitle="Dùng khi hết nguyên liệu nhiều ngày hoặc tạm ngừng bán món."
            onPress={() => stockItem && setStock(stockItem.id, 'SOLD_OUT')}
          />
          <View className="flex-row items-start gap-2 px-1">
            <Icon name="flash-outline" size={14} tone="muted" />
            <Text variant="caption" weight="regular" tone="muted" className="flex-1">
              Khách đang xem quán hoặc có món này trong giỏ sẽ được báo ngay.
            </Text>
          </View>
        </View>
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

const HeaderChip: React.FC<{ icon: 'restaurant' | 'checkmark-circle' | 'remove-circle'; label: string; dot?: string }> = ({
  icon,
  label,
  dot,
}) => (
  <View className="flex-row items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5">
    {dot ? <View className={cn('h-2 w-2 rounded-full', dot)} /> : <Icon name={icon} size={14} tone="inverse" />}
    <Text variant="caption" weight="semibold" tone="inverse">
      {label}
    </Text>
  </View>
);

const CategoryChip: React.FC<{ label: string; count: number; selected: boolean; onPress: () => void }> = ({
  label,
  count,
  selected,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    className={cn(
      'h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 active:opacity-80',
      selected ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface',
    )}
  >
    <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'inverse' : 'default'} numberOfLines={1}>
      {label}
    </Text>
    <Text variant="micro" weight="semibold" tone={selected ? 'inverse' : 'muted'}>
      {count}
    </Text>
  </Pressable>
);

const MenuItemCard: React.FC<{
  item: MenuItem;
  onEdit: () => void;
  onStockPress: () => void;
}> = ({ item, onEdit, onStockPress }) => {
  const pct = discountPercent(item);
  const stock = stockStatusOf(item);
  const stockLabel = stock === 'AVAILABLE' ? 'Đang bán' : stock === 'SOLD_OUT_TODAY' ? 'Hết hôm nay' : 'Hết món';
  const summary = optionsSummary(item.options);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sửa món ${item.name}`}
      onPress={onEdit}
      className="flex-row gap-3 rounded-2xl bg-surface p-3 shadow-card active:opacity-90"
    >
      <View>
        <AppImage uri={item.imageUrl} className={cn('h-[84px] w-[84px] rounded-xl', item.isAvailable ? '' : 'opacity-40')} />
        {!item.isAvailable && (
          <View className="absolute bottom-1.5 left-1.5 right-1.5 items-center rounded-md bg-scrim py-0.5">
            <Text variant="micro" weight="bold" tone="inverse">
              {stockLabel}
            </Text>
          </View>
        )}
        {pct > 0 && item.isAvailable && (
          <View className="absolute left-1.5 top-1.5 rounded-md bg-accent-500 px-1.5 py-0.5">
            <Text variant="micro" weight="bold" tone="inverse">
              -{pct}%
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 justify-between gap-1.5">
        <View className="gap-0.5">
          <Text variant="body" weight="semibold" numberOfLines={2} tone={item.isAvailable ? 'default' : 'muted'}>
            {item.name}
          </Text>
          {!!summary && (
            <View className="flex-row items-center gap-1">
              <Icon name="options-outline" size={12} tone="muted" />
              <Text variant="micro" weight="medium" tone="muted" numberOfLines={1}>
                {summary}
              </Text>
            </View>
          )}
          {!!(item.availableFrom && item.availableTo) && (
            <View className="flex-row items-center gap-1">
              <Icon name="time-outline" size={12} tone="brand" />
              <Text variant="micro" weight="medium" tone="brand" numberOfLines={1}>
                Khung giờ: {item.availableFrom} – {item.availableTo}
              </Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row flex-wrap items-baseline gap-x-1.5">
            <Text variant="body-lg" weight="bold" tone={item.isAvailable ? 'brand' : 'muted'}>
              {formatVND(effectiveBasePrice(item))}
            </Text>
            {pct > 0 && (
              <Text variant="caption" tone="muted" className="line-through">
                {formatVND(item.price)}
              </Text>
            )}
          </View>
          {/* Công tắc còn/hết món có chữ rõ ràng */}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: item.isAvailable }}
            accessibilityLabel={`${item.name}: ${stockLabel.toLowerCase()}, ${item.isAvailable ? 'bấm để báo hết món' : 'bấm để mở bán lại'}`}
            hitSlop={6}
            onPress={onStockPress}
            className={cn(
              'h-8 flex-row items-center gap-1.5 rounded-full px-3',
              stock === 'AVAILABLE' ? 'bg-success-soft' : stock === 'SOLD_OUT_TODAY' ? 'bg-accent-50' : 'bg-canvas-subtle',
            )}
          >
            <View
              className={cn(
                'h-2 w-2 rounded-full',
                stock === 'AVAILABLE' ? 'bg-success' : stock === 'SOLD_OUT_TODAY' ? 'bg-accent-500' : 'bg-ink-muted',
              )}
            />
            <Text
              variant="caption"
              weight="bold"
              tone={stock === 'AVAILABLE' ? 'success' : stock === 'SOLD_OUT_TODAY' ? 'accent' : 'secondary'}
            >
              {stockLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
};

/** Một lựa chọn trong bảng "Báo hết món". */
const StockOption: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  box: string;
  iconColor: string;
  title: string;
  subtitle: string;
  recommended?: boolean;
  onPress: () => void;
}> = ({ icon, box, iconColor, title, subtitle, recommended, onPress }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    className={cn(
      'flex-row items-center gap-3 rounded-2xl border bg-surface p-3.5 active:bg-canvas-subtle',
      recommended ? 'border-accent-100' : 'border-line',
    )}
  >
    <View className={cn('h-11 w-11 items-center justify-center rounded-full', box)}>
      <Icon name={icon} size={20} color={iconColor} />
    </View>
    <View className="flex-1 gap-0.5">
      <View className="flex-row items-center gap-2">
        <Text variant="body" weight="bold">
          {title}
        </Text>
        {recommended && (
          <View className="rounded-full bg-accent-50 px-2 py-0.5">
            <Text variant="micro" weight="bold" tone="accent">
              Hay dùng
            </Text>
          </View>
        )}
      </View>
      <Text variant="caption" weight="regular" tone="secondary">
        {subtitle}
      </Text>
    </View>
    <Icon name="chevron-forward" size={16} tone="muted" />
  </Pressable>
);
