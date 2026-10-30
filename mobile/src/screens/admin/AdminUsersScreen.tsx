import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { adminApi } from '../../api/admin';
import { DRIVER_STATUS_META, DriverVerifySheet } from '../../components/modules/admin/DriverVerifySheet';
import { RoleRequestsSheet } from '../../components/modules/admin/RoleRequestsSheet';
import { UserActivitySheet } from '../../components/modules/admin/UserActivitySheet';
import { ROLE_META, RoleBadge } from '../../components/modules/admin/adminShared';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  cn,
  ConfirmDialog,
  CountBadge,
  Divider,
  EmptyState,
  ErrorState,
  FilterChip,
  Icon,
  IconButton,
  Input,
  ListRow,
  LoadingSpinner,
  SearchBar,
  TAB_BAR_CLEARANCE,
  TabHeader,
  Text,
  useToast,
} from '../../components/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { palette } from '../../theme';
import { Role, User } from '../../types/api';
import { AdminTabParamList } from '../../types/navigation';
import { formatDate } from '../../utils/format';

const ROLE_FILTERS: { label: string; value?: Role }[] = [
  { label: 'Tất cả' },
  { label: 'Khách hàng', value: 'CUSTOMER' },
  { label: 'Chủ quán', value: 'RESTAURANT_OWNER' },
  { label: 'Tài xế', value: 'DRIVER' },
  { label: 'Quản trị viên', value: 'ADMIN' },
];

/** Vai trò admin được đổi trực tiếp (không cấp quyền Admin từ app). */
const ASSIGNABLE_ROLES: Role[] = ['CUSTOMER', 'RESTAURANT_OWNER', 'DRIVER'];

type SheetMode = 'actions' | 'role' | 'lock' | 'activity' | 'driver';

/** Đợi Modal trước đóng hẳn rồi mới mở Modal sau (iOS không mở được 2 Modal chồng nhau). */
const MODAL_SWAP_DELAY = 350;

export const AdminUsersScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AdminTabParamList, 'AdminUsersTab'>>();
  const me = useAuthStore((s) => s.user);

  const [role, setRole] = useState<Role | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<User | null>(null);
  const [mode, setMode] = useState<SheetMode | null>(null);
  const [newRole, setNewRole] = useState<Role | null>(null);
  const [lockReason, setLockReason] = useState('');

  // Bảng yêu cầu chờ duyệt mở theo tham số route để thẻ "chờ duyệt" ở Tổng quan mở thẳng được
  const requestsOpen = !!route.params?.openRequests;
  const setRequestsOpen = (open: boolean) => navigation.setParams({ openRequests: open || undefined });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', role, search.trim()],
    queryFn: () => adminApi.listUsers({ role, q: search.trim() || undefined, limit: 50 }),
  });
  const { data: stats } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.getStats() });
  const pendingRequests = stats?.roleRequests.pending ?? 0;
  const users = data?.items ?? [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })]);
    setRefreshing(false);
  };

  const close = () => setMode(null);
  /** Đóng bảng hành động rồi mở bảng/hộp thoại tiếp theo. */
  const switchTo = (next: SheetMode) => {
    setMode(null);
    setTimeout(() => setMode(next), MODAL_SWAP_DELAY);
  };

  const openActions = (u: User) => {
    setTarget(u);
    setNewRole(u.role);
    setLockReason('');
    setMode('actions');
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

  const isSelf = target?.id === me?.id;
  const isAdminTarget = target?.role === 'ADMIN';

  const renderItem = ({ item }: { item: User }) => {
    const profile = item.driverProfile;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.fullName}, ${ROLE_META[item.role].label}. Mở thao tác`}
        onPress={() => openActions(item)}
        className={cn('gap-3 rounded-2xl bg-surface p-4 shadow-card active:opacity-90', !item.isActive && 'opacity-70')}
      >
        <View className="flex-row items-start gap-3">
          <Avatar uri={item.avatarUrl} name={item.fullName} size="lg" />
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" weight="semibold" numberOfLines={1}>
              {item.fullName}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary" numberOfLines={1}>
              {item.email}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              {item.phone || 'Chưa có số điện thoại'}
            </Text>
          </View>
          <IconButton
            icon="ellipsis-horizontal"
            variant="subtle"
            size="sm"
            accessibilityLabel={`Thao tác với ${item.fullName}`}
            onPress={() => openActions(item)}
          />
        </View>
        <View className="flex-row flex-wrap items-center gap-1.5">
          <RoleBadge role={item.role} />
          {!item.isActive && <Badge label="Đã khoá" tone="danger" icon="lock-closed" />}
          {item.role === 'DRIVER' && (
            <Badge
              label={profile ? DRIVER_STATUS_META[profile.verificationStatus].label : 'Chưa có xe'}
              tone={profile ? DRIVER_STATUS_META[profile.verificationStatus].tone : 'neutral'}
            />
          )}
          {item.role === 'RESTAURANT_OWNER' && (
            <Badge label={`${item._count?.restaurants ?? 0} quán`} tone="neutral" icon="storefront-outline" />
          )}
          <Text variant="micro" weight="regular" tone="muted" className="ml-auto">
            Tham gia {formatDate(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-canvas-subtle">
      {isFocused && <StatusBar style="light" />}
      <TabHeader
        title="Quản lý Người dùng"
        subtitle={stats ? `${stats.users.total} tài khoản • ${stats.users.inactive} đang khoá` : undefined}
      >
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Tìm theo tên, email, số điện thoại..."
          className="h-search-lg rounded-full bg-surface px-4"
        />
      </TabHeader>

      {pendingRequests > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setRequestsOpen(true)}
          className="mx-4 mt-3 flex-row items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 active:opacity-85"
        >
          <Icon name="person-add" size="md" tone="accent" />
          <Text variant="body" weight="semibold" className="flex-1">
            Yêu cầu mở quán / làm tài xế
          </Text>
          <CountBadge count={pendingRequests} />
          <Icon name="chevron-forward" size="md" tone="muted" />
        </Pressable>
      )}

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-3">
          {ROLE_FILTERS.map((f) => {
            const n = f.value ? stats?.users.roles[f.value] : stats?.users.total;
            return (
              <FilterChip
                key={f.label}
                label={n !== undefined ? `${f.label} (${n})` : f.label}
                selected={role === f.value}
                onPress={() => setRole(f.value)}
              />
            );
          })}
        </ScrollView>
      </View>

      {isLoading && !refreshing ? (
        <LoadingSpinner message="Đang tải danh sách người dùng..." />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName={`gap-3 px-4 pt-1 ${TAB_BAR_CLEARANCE}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.brand['500']]} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Không tìm thấy người dùng"
              description="Thử từ khoá khác hoặc đổi bộ lọc vai trò."
            />
          }
        />
      )}

      {/* Bảng hành động của một người dùng */}
      <BottomSheet visible={mode === 'actions'} onClose={close} title={target?.fullName}>
        <View className="pb-3">
          <ListRow
            icon="swap-horizontal"
            iconTone="brand"
            title="Đổi vai trò"
            subtitle={
              isSelf || isAdminTarget
                ? 'Không áp dụng cho tài khoản quản trị viên'
                : `Hiện tại: ${target ? ROLE_META[target.role].label : ''}`
            }
            onPress={isSelf || isAdminTarget ? undefined : () => switchTo('role')}
          />
          {target?.role === 'DRIVER' && (
            <>
              <Divider inset />
              <ListRow
                icon="bicycle-outline"
                iconTone="brand"
                title="Duyệt hồ sơ xe & Công nợ COD"
                subtitle="Kiểm duyệt phương tiện, ghi nhận nộp tiền và điều chỉnh công nợ"
                onPress={() => switchTo('driver')}
              />
            </>
          )}
          <Divider inset />
          <ListRow icon="time-outline" iconTone="brand" title="Xem lịch sử hoạt động" onPress={() => switchTo('activity')} />
          <Divider inset />
          {target?.isActive ? (
            <ListRow
              icon="lock-closed-outline"
              title="Khoá tài khoản"
              subtitle={isSelf || isAdminTarget ? 'Không thể khoá tài khoản quản trị viên' : 'Đăng xuất và chặn đăng nhập'}
              destructive={!(isSelf || isAdminTarget)}
              showChevron={false}
              onPress={isSelf || isAdminTarget ? undefined : () => switchTo('lock')}
            />
          ) : (
            <ListRow
              icon="lock-open-outline"
              iconTone="success"
              title="Mở khoá tài khoản"
              showChevron={false}
              onPress={() => switchTo('lock')}
            />
          )}
        </View>
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
                  'flex-row items-center gap-3 rounded-xl border p-3 active:opacity-80',
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
          if (target.isActive && !lockReason.trim()) {
            toast('Vui lòng nhập lý do khoá', 'error');
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
      <DriverVerifySheet
        key={mode === 'driver' ? target?.id : 'none'}
        user={mode === 'driver' ? target : null}
        onClose={close}
      />
      <RoleRequestsSheet visible={requestsOpen} onClose={() => setRequestsOpen(false)} />
    </View>
  );
};
