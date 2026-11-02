import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminApi } from '../../api/admin';
import { AdminBanner, adminContentApi, BannerAction, BannerInput } from '../../api/adminContent';
import {
  BannerStatusChip,
  DateField,
  ImagePickerBox,
  MoveButtons,
  parseDisplayDate,
  toDisplayDate,
} from '../../components/modules/admin/ContentKit';
import { NoticeCard, SegmentedTabs } from '../../components/modules/partner/PartnerKit';
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
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useImageUpload } from '../../hooks/useImageUpload';
import { palette } from '../../theme';

const ACTION_LABEL: Record<BannerAction, string> = {
  NONE: 'Không',
  RESTAURANT: 'Mở quán',
  CUISINE: 'Danh mục',
  SEARCH: 'Tìm kiếm',
};

interface Draft {
  id?: string;
  title: string;
  imageUrl: string;
  actionType: BannerAction;
  actionValue: string;
  actionLabel: string; // tên quán đã chọn (chỉ để hiển thị)
  isActive: boolean;
  start: string;
  end: string;
}

const EMPTY: Draft = { title: '', imageUrl: '', actionType: 'NONE', actionValue: '', actionLabel: '', isActive: true, start: '', end: '' };

export const AdminBannersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restaurantQuery, setRestaurantQuery] = useState('');
  const { pickAndUpload, uploading } = useImageUpload('banners');

  const bannersQuery = useQuery({ queryKey: ['admin', 'banners'], queryFn: adminContentApi.listBanners });
  const cuisinesQuery = useQuery({ queryKey: ['admin', 'cuisines'], queryFn: adminContentApi.listCuisines });
  const restaurantsQuery = useQuery({
    queryKey: ['admin', 'restaurants', 'picker', restaurantQuery],
    queryFn: () => adminApi.listRestaurants({ limit: 20, q: restaurantQuery.trim() || undefined }),
    enabled: draft?.actionType === 'RESTAURANT',
  });

  const banners = useMemo(() => bannersQuery.data ?? [], [bannersQuery.data]);

  // Thay đổi xong: làm mới danh sách quản trị và banner trang chủ của khách
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'banners'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.banners });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: BannerInput }) =>
      id ? adminContentApi.updateBanner(id, data) : adminContentApi.createBanner(data),
    onSuccess: (_d, vars) => {
      refreshAll();
      setDraft(null);
      toast(vars.id ? 'Đã lưu banner.' : 'Đã thêm banner mới.', 'success');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join('\n') : msg) || 'Không lưu được banner');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminContentApi.updateBanner(id, { isActive }),
    onSuccess: refreshAll,
    onError: (err: any) => toast(err?.response?.data?.message || 'Không đổi được trạng thái', 'error'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminContentApi.reorderBanners(ids),
    onMutate: async (ids) => {
      // Đổi thứ tự ngay trên màn hình
      queryClient.setQueryData<AdminBanner[]>(['admin', 'banners'], (old) =>
        old ? ids.map((id) => old.find((b) => b.id === id)!).filter(Boolean) : old,
      );
    },
    onSettled: refreshAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminContentApi.deleteBanner(id),
    onSuccess: () => {
      refreshAll();
      setDeleting(false);
      setDraft(null);
      toast('Đã xoá banner.', 'success');
    },
    onError: (err: any) => {
      setDeleting(false);
      toast(err?.response?.data?.message || 'Không xoá được banner', 'error');
    },
  });

  const move = (index: number, dir: -1 | 1) => {
    const ids = banners.map((b) => b.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorderMutation.mutate(ids);
  };

  const openEdit = (b?: AdminBanner) => {
    setError(null);
    setRestaurantQuery('');
    setDraft(
      b
        ? {
            id: b.id,
            title: b.title,
            imageUrl: b.imageUrl,
            actionType: b.actionType,
            actionValue: b.actionValue ?? '',
            actionLabel: '',
            isActive: b.isActive,
            start: toDisplayDate(b.startAt),
            end: toDisplayDate(b.endAt),
          }
        : { ...EMPTY },
    );
  };

  const save = () => {
    if (!draft) return;
    if (draft.title.trim().length < 2) return setError('Vui lòng nhập tiêu đề (tối thiểu 2 ký tự)');
    if (!draft.imageUrl) return setError('Vui lòng chọn ảnh banner');
    if (draft.actionType !== 'NONE' && !draft.actionValue.trim()) {
      return setError(
        draft.actionType === 'RESTAURANT'
          ? 'Vui lòng chọn quán'
          : draft.actionType === 'CUISINE'
            ? 'Vui lòng chọn danh mục'
            : 'Vui lòng nhập từ khoá tìm kiếm',
      );
    }
    const startAt = parseDisplayDate(draft.start, false);
    const endAt = parseDisplayDate(draft.end, true);
    if (startAt === undefined || endAt === undefined) return setError('Ngày không đúng định dạng dd/mm/yyyy');
    setError(null);
    saveMutation.mutate({
      id: draft.id,
      data: {
        title: draft.title.trim(),
        imageUrl: draft.imageUrl,
        actionType: draft.actionType,
        actionValue: draft.actionType === 'NONE' ? null : draft.actionValue.trim(),
        isActive: draft.isActive,
        startAt,
        endAt,
      },
    });
  };

  const actionText = (b: AdminBanner) => {
    if (b.actionType === 'NONE' || !b.actionValue) return 'Chỉ hiển thị, không bấm được';
    if (b.actionType === 'CUISINE') {
      return `Mở danh mục: ${cuisinesQuery.data?.find((c) => c.code === b.actionValue)?.name ?? b.actionValue}`;
    }
    if (b.actionType === 'SEARCH') return `Tìm kiếm: "${b.actionValue}"`;
    return 'Mở một quán';
  };

  const scheduleText = (b: AdminBanner) =>
    !b.startAt && !b.endAt
      ? 'Không giới hạn thời gian'
      : `${b.startAt ? toDisplayDate(b.startAt) : '…'} → ${b.endAt ? toDisplayDate(b.endAt) : 'không giới hạn'}`;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar
          title="Banner trang chủ"
          onLeadingPress={() => navigation.goBack()}
          trailing={<Button label="Thêm" leftIcon="add" size="sm" onPress={() => openEdit()} />}
        />
      </View>

      {bannersQuery.isLoading ? (
        <LoadingSpinner message="Đang tải banner..." />
      ) : (
        <FlatList
          data={banners}
          keyExtractor={(b) => b.id}
          contentContainerClassName="gap-3 p-4 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={bannersQuery.isRefetching}
              onRefresh={() => {
                void bannersQuery.refetch();
              }}
              colors={[palette.brand['500']]}
              tintColor={palette.brand['500']}
            />
          }
          ListHeaderComponent={
            <NoticeCard
              tone="brand"
              icon="information-circle"
              title="Banner hiện ở đầu trang chủ theo thứ tự bên dưới"
              message="Chỉ banner đang bật và trong lịch chạy mới hiện với khách. Ảnh ngang 16:9, chữ to rõ."
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="images-outline"
              title="Chưa có banner"
              description="Thêm banner để quảng bá quán, danh mục hoặc chương trình khuyến mãi."
              actionLabel="Thêm banner"
              onAction={() => openEdit()}
            />
          }
          renderItem={({ item: b, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa banner ${b.title}`}
              onPress={() => openEdit(b)}
              className="overflow-hidden rounded-2xl bg-surface shadow-card active:opacity-95"
            >
              <View style={{ aspectRatio: 16 / 9 }} className={b.status === 'LIVE' ? '' : 'opacity-60'}>
                <AppImage uri={b.imageUrl} className="h-full w-full" fallbackIcon="image-outline" />
                <View className="absolute left-2.5 top-2.5 flex-row gap-1.5">
                  <View className="h-7 min-w-[28px] items-center justify-center rounded-full bg-scrim px-2">
                    <Text variant="micro" weight="bold" tone="inverse">
                      #{index + 1}
                    </Text>
                  </View>
                  <BannerStatusChip status={b.status} />
                </View>
              </View>
              <View className="gap-2 p-3.5">
                <Text variant="body" weight="bold" numberOfLines={2}>
                  {b.title}
                </Text>
                <View className="gap-0.5">
                  <Row icon="hand-left-outline" text={actionText(b)} />
                  <Row icon="calendar-outline" text={scheduleText(b)} />
                </View>
                <View className="flex-row items-center justify-between border-t border-line-subtle pt-2.5">
                  <MoveButtons
                    onUp={index > 0 ? () => move(index, -1) : undefined}
                    onDown={index < banners.length - 1 ? () => move(index, 1) : undefined}
                    disabled={reorderMutation.isPending}
                  />
                  <View className="flex-row items-center gap-2">
                    <Text variant="caption" weight="medium" tone="secondary">
                      {b.isActive ? 'Đang bật' : 'Đã tắt'}
                    </Text>
                    <Switch
                      value={b.isActive}
                      onValueChange={(v) => toggleMutation.mutate({ id: b.id, isActive: v })}
                      trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
                      thumbColor={palette.surface}
                    />
                  </View>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Bảng thêm / sửa banner */}
      <BottomSheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Sửa banner' : 'Thêm banner'}
        footer={
          <View className="gap-2 pb-2">
            {!!error && (
              <Text variant="caption" tone="danger" className="text-center">
                {error}
              </Text>
            )}
            <View className="flex-row gap-2">
              {draft?.id && (
                <Button
                  label="Xoá"
                  leftIcon="trash-outline"
                  variant="dangerSoft"
                  size="lg"
                  onPress={() => setDeleting(true)}
                  className="flex-1"
                />
              )}
              <Button
                label={draft?.id ? 'Lưu thay đổi' : 'Thêm banner'}
                size="lg"
                loading={saveMutation.isPending}
                disabled={uploading}
                onPress={save}
                className="flex-[2]"
              />
            </View>
          </View>
        }
      >
        {draft && (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 pb-4" showsVerticalScrollIndicator={false}>
            <ImagePickerBox
              uri={draft.imageUrl}
              ratio="wide"
              uploading={uploading}
              hint="Ảnh ngang 16:9, tối đa 5 MB. Ảnh được nén và lưu lên Cloudinary."
              onPick={async () => {
                const url = await pickAndUpload();
                if (url) setDraft((d) => (d ? { ...d, imageUrl: url } : d));
              }}
            />

            <Input
              label="Tiêu đề *"
              placeholder="VD: Miễn phí giao hàng cuối tuần"
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              maxLength={100}
            />

            {/* Bấm vào banner thì đi đâu */}
            <View className="gap-2">
              <Text variant="caption" weight="medium" tone="secondary">
                Khi khách bấm vào banner
              </Text>
              <SegmentedTabs
                value={draft.actionType}
                onChange={(actionType) => setDraft({ ...draft, actionType, actionValue: '', actionLabel: '' })}
                items={(Object.keys(ACTION_LABEL) as BannerAction[]).map((k) => ({ key: k, label: ACTION_LABEL[k] }))}
              />

              {draft.actionType === 'RESTAURANT' && (
                <View className="gap-2">
                  {!!draft.actionValue && (
                    <View className="flex-row items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5">
                      <Icon name="storefront" size="sm" tone="brand" />
                      <Text variant="body" weight="semibold" tone="brand" className="flex-1" numberOfLines={1}>
                        {draft.actionLabel || 'Quán đã chọn'}
                      </Text>
                    </View>
                  )}
                  <Input
                    leftIcon="search"
                    placeholder="Tìm quán theo tên"
                    value={restaurantQuery}
                    onChangeText={setRestaurantQuery}
                  />
                  <View className="gap-1.5">
                    {(restaurantsQuery.data?.items ?? []).slice(0, 6).map((r) => {
                      const selected = draft.actionValue === r.id;
                      return (
                        <Pressable
                          key={r.id}
                          onPress={() => setDraft({ ...draft, actionValue: r.id, actionLabel: r.name })}
                          className={cn(
                            'flex-row items-center gap-2.5 rounded-xl border p-2',
                            selected ? 'border-brand-500 bg-brand-50' : 'border-line-subtle bg-surface',
                          )}
                        >
                          <AppImage uri={r.imageUrl} className="h-9 w-9 rounded-lg" fallbackIcon="storefront-outline" />
                          <Text variant="body" weight={selected ? 'bold' : 'medium'} className="flex-1" numberOfLines={1}>
                            {r.name}
                          </Text>
                          {selected && <Icon name="checkmark-circle" size="md" tone="brand" />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {draft.actionType === 'CUISINE' && (
                <View className="flex-row flex-wrap gap-2">
                  {(cuisinesQuery.data ?? []).map((c) => {
                    const selected = draft.actionValue === c.code;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setDraft({ ...draft, actionValue: c.code })}
                        className={cn(
                          'h-9 justify-center rounded-full border px-3.5',
                          selected ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface',
                        )}
                      >
                        <Text variant="caption" weight={selected ? 'bold' : 'medium'} tone={selected ? 'brand' : 'default'}>
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {draft.actionType === 'SEARCH' && (
                <Input
                  leftIcon="search"
                  placeholder="Từ khoá, VD: trà sữa"
                  value={draft.actionValue}
                  onChangeText={(actionValue) => setDraft({ ...draft, actionValue })}
                  maxLength={60}
                />
              )}
            </View>

            {/* Lịch chạy */}
            <View className="gap-3 rounded-2xl border border-line-subtle p-3">
              <Text variant="body" weight="bold">
                Lịch chạy
              </Text>
              <DateField
                label="Bắt đầu"
                value={draft.start}
                onChange={(start) => setDraft({ ...draft, start })}
                presets={[
                  { label: 'Hôm nay', days: 0 },
                  { label: 'Ngày mai', days: 1 },
                  { label: 'Không giới hạn', days: null },
                ]}
              />
              <DateField
                label="Kết thúc"
                value={draft.end}
                onChange={(end) => setDraft({ ...draft, end })}
                presets={[
                  { label: '+7 ngày', days: 7 },
                  { label: '+30 ngày', days: 30 },
                  { label: 'Không giới hạn', days: null },
                ]}
              />
            </View>

            <View className="flex-row items-center gap-3 rounded-2xl border border-line-subtle p-3">
              <View className="flex-1">
                <Text variant="body" weight="semibold">
                  Bật banner
                </Text>
                <Text variant="micro" weight="regular" tone="muted">
                  Tắt để ẩn tạm thời mà không cần xoá
                </Text>
              </View>
              <Switch
                value={draft.isActive}
                onValueChange={(isActive) => setDraft({ ...draft, isActive })}
                trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
                thumbColor={palette.surface}
              />
            </View>
          </ScrollView>
        )}

        {/* Xác nhận xoá nằm trong bảng (iOS không mở được Modal chồng ngoài Modal) */}
        <ConfirmDialog
          visible={deleting}
          title="Xoá banner?"
          message="Banner sẽ bị xoá vĩnh viễn. Nếu chỉ muốn ẩn tạm, hãy tắt banner."
          confirmLabel="Xoá"
          destructive
          loading={deleteMutation.isPending}
          onCancel={() => setDeleting(false)}
          onConfirm={() => draft?.id && deleteMutation.mutate(draft.id)}
        />
      </BottomSheet>
    </SafeAreaView>
  );
};

const Row: React.FC<{ icon: 'hand-left-outline' | 'calendar-outline'; text: string }> = ({ icon, text }) => (
  <View className="flex-row items-center gap-1.5">
    <Icon name={icon} size={14} tone="muted" />
    <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1} className="flex-1">
      {text}
    </Text>
  </View>
);

