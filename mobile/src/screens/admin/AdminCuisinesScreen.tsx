import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminCuisine, adminContentApi, CuisineInput } from '../../api/adminContent';
import { ImagePickerBox, KeywordInput, MoveButtons } from '../../components/modules/admin/ContentKit';
import { NoticeCard } from '../../components/modules/partner/PartnerKit';
import {
  AppImage,
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingSpinner,
  Text,
  TopBar,
  useToast,
} from '../../components/ui';
import { queryKeys } from '../../constants/queryKeys';
import { useImageUpload } from '../../hooks/useImageUpload';
import { palette } from '../../theme';

interface Draft {
  id?: string;
  name: string;
  imageUrl: string;
  keywords: string[];
  isActive: boolean;
}

export const AdminCuisinesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { pickAndUpload, uploading } = useImageUpload('cuisines');

  const query = useQuery({ queryKey: ['admin', 'cuisines'], queryFn: adminContentApi.listCuisines });
  const cuisines = useMemo(() => query.data ?? [], [query.data]);
  const activeCount = cuisines.filter((c) => c.isActive).length;

  // Thay đổi xong: làm mới danh sách quản trị và danh mục trang chủ của khách
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'cuisines'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.cuisines });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id?: string; data: CuisineInput }) =>
      id ? adminContentApi.updateCuisine(id, data) : adminContentApi.createCuisine(data),
    onSuccess: (_d, vars) => {
      refreshAll();
      setDraft(null);
      toast(vars.id ? 'Đã lưu danh mục.' : 'Đã thêm danh mục mới.', 'success');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join('\n') : msg) || 'Không lưu được danh mục');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminContentApi.updateCuisine(id, { isActive }),
    onSuccess: refreshAll,
    onError: (err: any) => toast(err?.response?.data?.message || 'Không đổi được trạng thái', 'error'),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminContentApi.reorderCuisines(ids),
    onMutate: async (ids) => {
      queryClient.setQueryData<AdminCuisine[]>(['admin', 'cuisines'], (old) =>
        old ? ids.map((id) => old.find((c) => c.id === id)!).filter(Boolean) : old,
      );
    },
    onSettled: refreshAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminContentApi.deleteCuisine(id),
    onSuccess: () => {
      refreshAll();
      setDeleting(false);
      setDraft(null);
      toast('Đã xoá danh mục.', 'success');
    },
    onError: (err: any) => {
      setDeleting(false);
      toast(err?.response?.data?.message || 'Không xoá được danh mục', 'error');
    },
  });

  const move = (index: number, dir: -1 | 1) => {
    const ids = cuisines.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorderMutation.mutate(ids);
  };

  const openEdit = (c?: AdminCuisine) => {
    setError(null);
    setDraft(
      c
        ? { id: c.id, name: c.name, imageUrl: c.imageUrl, keywords: c.keywords ?? [], isActive: c.isActive }
        : { name: '', imageUrl: '', keywords: [], isActive: true },
    );
  };

  const save = () => {
    if (!draft) return;
    if (draft.name.trim().length < 2) return setError('Vui lòng nhập tên danh mục (tối thiểu 2 ký tự)');
    if (!draft.imageUrl) return setError('Vui lòng chọn ảnh danh mục');
    setError(null);
    saveMutation.mutate({
      id: draft.id,
      data: { name: draft.name.trim(), imageUrl: draft.imageUrl, keywords: draft.keywords, isActive: draft.isActive },
    });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <TopBar
          title="Danh mục ẩm thực"
          onLeadingPress={() => navigation.goBack()}
          trailing={<Button label="Thêm" leftIcon="add" size="sm" onPress={() => openEdit()} />}
        />
      </View>

      {query.isLoading ? (
        <LoadingSpinner message="Đang tải danh mục..." />
      ) : (
        <FlatList
          data={cuisines}
          keyExtractor={(c) => c.id}
          contentContainerClassName="gap-2.5 p-4 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                void query.refetch();
              }}
              colors={[palette.brand['500']]}
              tintColor={palette.brand['500']}
            />
          }
          ListHeaderComponent={
            <View className="mb-1 gap-3">
              <NoticeCard
                tone="brand"
                icon="information-circle"
                title={`${activeCount}/${cuisines.length} danh mục đang hiện ở trang chủ`}
                message="Khách bấm vào danh mục sẽ lọc các quán có tên, mô tả hoặc món khớp với từ khoá."
              />
              {/* Xem trước hàng danh mục như trên trang chủ */}
              {activeCount > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 rounded-2xl bg-surface p-3">
                  {cuisines
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <View key={c.id} className="w-16 items-center gap-1">
                        <AppImage uri={c.imageUrl} className="h-14 w-14 rounded-full" fallbackIcon="restaurant-outline" />
                        <Text variant="micro" weight="medium" numberOfLines={1} className="text-center">
                          {c.name}
                        </Text>
                      </View>
                    ))}
                </ScrollView>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="grid-outline"
              title="Chưa có danh mục"
              description="Thêm danh mục để khách lọc quán nhanh ở trang chủ."
              actionLabel="Thêm danh mục"
              onAction={() => openEdit()}
            />
          }
          renderItem={({ item: c, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sửa danh mục ${c.name}`}
              onPress={() => openEdit(c)}
              className="flex-row items-center gap-3 rounded-2xl bg-surface p-3 shadow-card active:opacity-95"
            >
              <AppImage
                uri={c.imageUrl}
                className={cn('h-14 w-14 rounded-2xl', c.isActive ? '' : 'opacity-40')}
                fallbackIcon="restaurant-outline"
              />
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight="bold" numberOfLines={1} tone={c.isActive ? 'default' : 'muted'}>
                  {c.name}
                </Text>
                <Text variant="micro" weight="regular" tone="muted" numberOfLines={1}>
                  {c.keywords?.length ? c.keywords.join(', ') : 'Chưa có từ khoá'}
                </Text>
                <View className="mt-1 flex-row items-center justify-between">
                  <MoveButtons
                    onUp={index > 0 ? () => move(index, -1) : undefined}
                    onDown={index < cuisines.length - 1 ? () => move(index, 1) : undefined}
                    disabled={reorderMutation.isPending}
                  />
                  <Switch
                    value={c.isActive}
                    onValueChange={(v) => toggleMutation.mutate({ id: c.id, isActive: v })}
                    trackColor={{ false: palette.line.DEFAULT, true: palette.success.DEFAULT }}
                    thumbColor={palette.surface}
                  />
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <BottomSheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Sửa danh mục' : 'Thêm danh mục'}
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
                label={draft?.id ? 'Lưu thay đổi' : 'Thêm danh mục'}
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
              ratio="square"
              uploading={uploading}
              hint="Ảnh vuông 1:1, món đặc trưng ở giữa"
              onPick={async () => {
                const url = await pickAndUpload();
                if (url) setDraft((d) => (d ? { ...d, imageUrl: url } : d));
              }}
            />
            <Input
              label="Tên danh mục *"
              placeholder="VD: Bún - Phở"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              maxLength={40}
            />
            <View className="gap-1.5">
              <Text variant="caption" weight="medium" tone="secondary">
                Từ khoá tìm quán
              </Text>
              <Text variant="micro" weight="regular" tone="muted">
                Quán có tên, mô tả hoặc món chứa các từ này sẽ hiện khi khách chọn danh mục. Bỏ trống sẽ dùng tên danh mục.
              </Text>
              <KeywordInput value={draft.keywords} onChange={(keywords) => setDraft({ ...draft, keywords })} />
            </View>
            <View className="flex-row items-center gap-3 rounded-2xl border border-line-subtle p-3">
              <View className="flex-1">
                <Text variant="body" weight="semibold">
                  Hiện ở trang chủ
                </Text>
                <Text variant="micro" weight="regular" tone="muted">
                  Tắt để ẩn tạm mà không cần xoá
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

        <ConfirmDialog
          visible={deleting}
          title="Xoá danh mục?"
          message="Danh mục sẽ bị xoá vĩnh viễn. Nếu chỉ muốn ẩn tạm, hãy tắt danh mục."
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
