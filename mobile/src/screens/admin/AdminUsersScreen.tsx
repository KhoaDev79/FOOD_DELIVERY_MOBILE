import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi } from '../../api/admin';
import {
  ContentWidth,
  DetailPlaceholder,
  ListSkeleton,
  RoleAvatar,
  TabStrip,
  useIsWide,
} from '../../components/modules/admin/AdminKit';
import { DRIVER_STATUS_META, DriverVerifySheet } from '../../components/modules/admin/DriverVerifySheet';
import { RoleRequestsSheet } from '../../components/modules/admin/RoleRequestsSheet';
import { UserActivitySheet } from '../../components/modules/admin/UserActivitySheet';
import { debtTone, UserAction, UserProfilePanel } from '../../components/modules/admin/UserProfilePanel';
import { ROLE_META, RoleBadge } from '../../components/modules/admin/adminShared';
import { NoticeCard } from '../../components/modules/partner/PartnerKit';
import {
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { Role, User } from '../../types/api';
import { AdminTabParamList } from '../../types/navigation';
import { formatVND } from '../../utils/format';

type UserTab = 'ALL' | Role | 'LOCKED';

const TABS: { key: UserTab; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'CUSTOMER', label: 'Khách' },
  { key: 'RESTAURANT_OWNER', label: 'Chủ quán' },
  { key: 'DRIVER', label: 'Tài xế' },
  { key: 'ADMIN', label: 'Admin' },
  { key: 'LOCKED', label: 'Đã khoá' },
];

/** Vai trò admin được đổi trực tiếp (không cấp quyền Admin từ app). */
const ASSIGNABLE_ROLES: Role[] = ['CUSTOMER', 'RESTAURANT_OWNER', 'DRIVER'];

type SheetMode = 'profile' | 'role' | 'lock' | 'activity' | 'driver';

/** Đợi Modal trước đóng hẳn rồi mới mở Modal sau (iOS không mở được 2 Modal chồng nhau). */
const MODAL_SWAP_DELAY = 350;

export const AdminUsersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AdminTabParamList, 'AdminUsersTab'>>();
  const me = useAuthStore((s) => s.user);
  const wide = useIsWide();

  // Tab trong tham số route để Tổng quan mở thẳng "Tài xế" (vượt hạn mức công nợ, xe chờ duyệt)
  const tab: UserTab = route.params?.tab ?? 'ALL';
  const setTab = (t: UserTab) => navigation.setParams({ tab: t });

  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 350);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<User | null>(null);
  const [mode, setMode] = useState<SheetMode | null>(null);
  const [newRole, setNewRole] = useState<Role | null>(null);
  const [lockReason, setLockReason] = useState('');

  // Bảng yêu cầu chờ duyệt mở theo tham số route để thẻ "chờ duyệt" ở Tổng quan mở thẳng được
  const requestsOpen = !!route.params?.openRequests;
  const setRequestsOpen = (open: boolean) => navigation.setParams({ openRequests: open || undefined });

  const listQuery = useQuery({
    queryKey: ['admin', 'users', tab, q],
    queryFn: () =>
      adminApi.listUsers({
        role: tab !== 'ALL' && tab !== 'LOCKED' ? tab : undefined,
        status: tab === 'LOCKED' ? 'locked' : undefined,
        q: q || undefined,
        limit: 50,
      }),
    placeholderData: (prev) => prev,
  });
  const { data: stats } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.getStats() });
  const { data: attention } = useQuery({ queryKey: ['admin', 'attention'], queryFn: () => adminApi.getAttention() });
  const pendingRequests = stats?.roleRequests.pending ?? 0;
  const debtLimit = attention?.debtLimit ?? 0;
  const users = listQuery.data?.items ?? [];

  const countOf = (t: UserTab): number | undefined => {
    if (!stats) return undefined;
    if (t === 'ALL') return stats.users.total;
    if (t === 'LOCKED') return stats.users.inactive;
    return stats.users.roles[t];
  };

  // Màn rộng: hồ sơ hiện ở cột phải, mặc định người đầu danh sách
  const shown = wide ? (target && users.some((u) => u.id === target.id) ? target : users[0] ?? null) : target;
  const fresh = shown ? users.find((u) => u.id === shown.id) ?? shown : null;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([listQuery.refetch(), queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })]);
    setRefreshing(false);
  };

  const close = () => setMode(null);
  /** Đóng bảng hiện tại rồi mở bảng/hộp thoại tiếp theo (điện thoại); màn rộng mở thẳng. */
  const openAction = (next: UserAction) => {
    if (fresh) {
      setTarget(fresh);
      setNewRole(fresh.role);
      setLockReason('');
    }
    if (wide) {
      setMode(next);
      return;
    }
    setMode(null);
    setTimeout(() => setMode(next), MODAL_SWAP_DELAY);
  };

  const openProfile = (u: User) => {
    setTarget(u);
    if (!wide) setMode('profile');
  };

  const toggleActive = useMutation({
    mutationFn: (u: User) => adminApi.toggleUserActive(u.id, u.isActive ? lockReason.trim() : undefined),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(res.isActive ? `Đã mở khoá ${res.fullName}` : `Đã khoá ${res.fullName}`, 'success');
      close();
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể đổi trạng thái tài khoản', 'error'),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, r }: { id: string; r: Role }) => adminApi.changeUserRole(id, r),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast(`${res.fullName} giờ là ${ROLE_META[res.role].label}`, 'success');
      close();
    },
    onError: (err: any) => toast(err?.response?.data?.message || 'Không thể đổi vai trò', 'error'),
  });

  const renderItem = ({ item, index }: { item: User; index: number }) => {
    const profile = item.driverProfile;
    const debt = profile?.codBalance ?? 0;
    const dTone = debtTone(debt, debtLimit);
    const selected = wide && fresh?.id === item.id;
    const first = index === 0;
    const last = index === users.length - 1;
    const vehicle = profile ? DRIVER_STATUS_META[profile.verificationStatus] : null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.fullName}, ${ROLE_META[item.role].label}${item.isActive ? '' : ', đã khoá'}. Mở hồ sơ`}
        onPress={() => openProfile(item)}
        className={cn(
          'min-h-[72px] flex-row items-center gap-3 px-4 py-3',
          selected ? 'bg-brand-50' : 'bg-surface active:bg-canvas-subtle',
          first && 'rounded-t-2xl',
          last ? 'rounded-b-2xl' : 'border-b border-line-subtle',
        )}
      >
        <RoleAvatar name={item.fullName} role={item.role} uri={item.avatarUrl} locked={!item.isActive} />
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight="semibold" numberOfLines={1} tone={item.isActive ? 'default' : 'muted'}>
            {item.fullName}
          </Text>
          <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
            {item.email}
          </Text>
          {/* Thông tin phụ chỉ hiện khi có ý nghĩa: xe chưa duyệt, công nợ COD, số quán */}
          {item.role === 'DRIVER' && (
            <View className="flex-row items-center gap-2">
              {vehicle && profile?.verificationStatus !== 'APPROVED' && (
                <Text variant="micro" weight="bold" tone={vehicle.tone === 'warning' ? 'warning' : 'danger'}>
                  {vehicle.label}
                </Text>
              )}
              {!profile && (
                <Text variant="micro" weight="semibold" tone="muted">
                  Chưa khai báo xe
                </Text>
              )}
              {debt > 0 && (
                <Text
                  variant="micro"
                  weight="bold"
                  tone={dTone === 'danger' ? 'danger' : dTone === 'warning' ? 'warning' : 'secondary'}
                >
                  Nợ COD {formatVND(debt)}
                </Text>
              )}
            </View>
          )}
          {item.role === 'RESTAURANT_OWNER' && (
            <Text variant="micro" weight="semibold" tone="accent">
              {item._count?.restaurants ?? 0} quán
            </Text>
          )}
        </View>
        <View className="items-end gap-1">
          <RoleBadge role={item.role} />
          {!item.isActive && (
            <Text variant="micro" weight="bold" tone="danger">
              Đã khoá
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const list =
    listQuery.isLoading && !listQuery.data ? (
      <View className="px-4 pt-1">
        <ListSkeleton rows={6} />
      </View>
    ) : listQuery.isError && !listQuery.data ? (
      <ErrorState onRetry={() => listQuery.refetch()} />
    ) : (
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName={cn('px-4 pt-3', TAB_BAR_CLEARANCE)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
        ListHeaderComponent={
          pendingRequests > 0 ? (
            <NoticeCard
              tone="warning"
              icon="person-add"
              title={`${pendingRequests} yêu cầu mở quán / làm tài xế đang chờ duyệt`}
              actionLabel="Xem ngay"
              onPress={() => setRequestsOpen(true)}
              className="mb-3"
            />
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="Không tìm thấy người dùng" description="Thử từ khoá khác hoặc đổi tab." />
        }
      />
    );

  const isSelf = target?.id === me?.id;

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        compact
        title="Người dùng"
        subtitle={stats ? `${stats.users.total} tài khoản · ${stats.users.inactive} đang khoá` : undefined}
      >
        <ContentWidth>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="h-search-lg rounded-full bg-surface px-4"
          />
        </ContentWidth>
      </TabHeader>

      <ContentWidth className="flex-1">
        <TabStrip
          items={TABS.map((t) => ({ ...t, count: countOf(t.key) }))}
          value={tab}
          onChange={setTab}
        />

        {wide ? (
          <View className="flex-1 flex-row gap-4 pr-4">
            <View className="w-[46%]">{list}</View>
            <View className={cn('flex-1 pt-1', TAB_BAR_CLEARANCE)}>
              {fresh ? (
                <ScrollView className="flex-1 rounded-2xl bg-surface shadow-card" contentContainerClassName="p-4">
                  <UserProfilePanel
                    key={fresh.id}
                    user={fresh}
                    isSelf={fresh.id === me?.id}
                    debtLimit={debtLimit}
                    onAction={openAction}
                  />
                </ScrollView>
              ) : (
                <DetailPlaceholder icon="person-outline" text="Chọn một người dùng để xem hồ sơ." />
              )}
            </View>
          </View>
        ) : (
          list
        )}
      </ContentWidth>

      {/* Hồ sơ người dùng (điện thoại) */}
      <BottomSheet visible={mode === 'profile'} onClose={close} title="Hồ sơ người dùng">
        {target ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <UserProfilePanel
              user={users.find((u) => u.id === target.id) ?? target}
              isSelf={isSelf}
              debtLimit={debtLimit}
              onAction={openAction}
            />
          </ScrollView>
        ) : (
          <View />
        )}
      </BottomSheet>

      {/* Đổi vai trò */}
      <BottomSheet
        visible={mode === 'role'}
        onClose={close}
        title="Đổi vai trò"
        footer={
          <View className="pb-2">
            <Button
              label="Xác nhận đổi vai trò"
              size="lg"
              disabled={!target || !newRole || newRole === target.role}
              loading={changeRole.isPending}
              onPress={() => target && newRole && changeRole.mutate({ id: target.id, r: newRole })}
            />
          </View>
        }
      >
        <View className="gap-2 pb-3">
          <Text variant="caption" weight="regular" tone="secondary">
            {target?.fullName} sẽ cần đăng nhập lại để dùng quyền mới.
            {target?.role === 'RESTAURANT_OWNER' ? ' Chủ quán còn sở hữu quán phải bàn giao quán trước.' : ''}
          </Text>
          {ASSIGNABLE_ROLES.map((r) => {
            const selected = newRole === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setNewRole(r)}
                className={cn(
                  'min-h-touch flex-row items-center gap-3 rounded-xl border p-3 active:opacity-80',
                  selected ? 'border-brand-500 bg-brand-50' : 'border-line-subtle bg-surface',
                )}
              >
                <Icon name={ROLE_META[r].icon} size="md" tone={selected ? 'brand' : 'secondary'} />
                <Text variant="body" weight={selected ? 'semibold' : 'regular'} className="flex-1">
                  {ROLE_META[r].label}
                  {target?.role === r ? ' (hiện tại)' : ''}
                </Text>
                <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size="md" tone={selected ? 'brand' : 'muted'} />
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* Khoá / mở khoá kèm lý do */}
      <ConfirmDialog
        visible={mode === 'lock'}
        title={target?.isActive ? 'Khoá tài khoản?' : 'Mở khoá tài khoản?'}
        message={
          target?.isActive
            ? `${target?.fullName} sẽ bị đăng xuất và không thể đăng nhập cho đến khi được mở khoá.`
            : `${target?.fullName} sẽ đăng nhập và sử dụng ứng dụng trở lại.`
        }
        confirmLabel={target?.isActive ? 'Khoá' : 'Mở khoá'}
        destructive={target?.isActive}
        loading={toggleActive.isPending}
        onCancel={() => !toggleActive.isPending && close()}
        onConfirm={() => {
          if (!target) return;
          if (target.isActive && lockReason.trim().length < 3) {
            toast('Vui lòng nhập lý do khoá (ít nhất 3 ký tự)', 'error');
            return;
          }
          toggleActive.mutate(target);
        }}
      >
        {target?.isActive && (
          <Input
            label="Lý do khoá *"
            placeholder="VD: Vi phạm chính sách đặt hàng"
            value={lockReason}
            onChangeText={setLockReason}
            className="mt-2"
          />
        )}
      </ConfirmDialog>

      <UserActivitySheet user={mode === 'activity' ? target : null} onClose={close} />
      <DriverVerifySheet key={mode === 'driver' ? target?.id : 'none'} user={mode === 'driver' ? target : null} onClose={close} />
      <RoleRequestsSheet visible={requestsOpen} onClose={() => setRequestsOpen(false)} />
    </View>
  );
};
