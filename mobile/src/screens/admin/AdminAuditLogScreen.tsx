import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminApi, AdminAuditLog } from '../../api/admin';
import { ContentWidth, ListSkeleton } from '../../components/modules/admin/AdminKit';
import { describeAudit } from '../../components/modules/admin/adminShared';
import { dayLabel } from '../../components/modules/partner/PartnerKit';
import { relativeTime } from '../../utils/adminOrder';
import { cn, EmptyState, ErrorState, FilterChip, Icon, IconTone, LoadingSpinner, Text, TopBar } from '../../components/ui';
import { useNow } from '../../hooks/useNow';
import { palette } from '../../theme';

const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Mọi thao tác' },
  { key: 'USER_', label: 'Người dùng' },
  { key: 'ROLE_REQUEST_', label: 'Duyệt vai trò' },
  { key: 'RESTAURANT_', label: 'Quán ăn' },
  { key: 'ORDER_', label: 'Đơn hàng' },
  { key: 'DRIVER_', label: 'Tài xế & COD' },
  { key: 'REVIEW_', label: 'Đánh giá' },
  { key: 'BANNER_', label: 'Banner' },
  { key: 'CUISINE_', label: 'Danh mục' },
  { key: 'EXPORT_', label: 'Xuất dữ liệu' },
];

type DateRange = 'today' | '7d' | '30d' | 'all';
const DATE_FILTERS: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày' },
  { key: '30d', label: '30 ngày' },
  { key: 'all', label: 'Tất cả' },
];

const TONE_BOX: Partial<Record<IconTone, string>> = {
  brand: 'bg-brand-50',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
  accent: 'bg-accent-50',
  warning: 'bg-warning-soft',
};

/** Mốc bắt đầu của khoảng ngày theo giờ máy (00:00 hôm nay lùi n-1 ngày). */
function rangeStart(r: DateRange): string | undefined {
  if (r === 'all') return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const days = r === 'today' ? 1 : r === '7d' ? 7 : 30;
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

const PAGE = 30;

/** Nhật ký quản trị: lọc theo người làm / loại thao tác / ngày, mỗi dòng là câu tiếng Việt kèm thời gian tương đối. */
export const AdminAuditLogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  useNow(); // tự cập nhật "x phút trước" mỗi phút
  const [action, setAction] = useState('');
  const [range, setRange] = useState<DateRange>('7d');
  const [actorId, setActorId] = useState<string | undefined>(undefined);

  const admins = useQuery({
    queryKey: ['admin', 'users', 'ADMIN', 'audit-actors'],
    queryFn: () => adminApi.listUsers({ role: 'ADMIN', limit: 50 }),
  });

  const logs = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs', action, range, actorId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      adminApi.listAuditLogs({
        action: action || undefined,
        actorId,
        from: rangeStart(range),
        page: pageParam,
        limit: PAGE,
      }),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const items: AdminAuditLog[] = logs.data?.pages.flatMap((p) => p.items) ?? [];
  const total = logs.data?.pages[0]?.total;

  const renderItem = ({ item, index }: { item: AdminAuditLog; index: number }) => {
    const d = describeAudit(item);
    const day = dayLabel(item.createdAt);
    const showDay = index === 0 || dayLabel(items[index - 1].createdAt) !== day;
    return (
      <View>
        {showDay && (
          <Text variant="caption" weight="bold" tone="muted" className="mb-2 mt-3 px-1 uppercase">
            {day}
          </Text>
        )}
        <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-3 shadow-card">
          <View className={cn('h-9 w-9 items-center justify-center rounded-full', TONE_BOX[d.tone] ?? 'bg-canvas-subtle')}>
            <Icon name={d.icon} size="sm" tone={d.tone} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="body" weight="medium">
              {d.text}
            </Text>
            <Text variant="caption" weight="regular" tone="secondary">
              {item.actor?.fullName ?? 'Hệ thống'} · {relativeTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <View className="bg-canvas">
        <ContentWidth>
          <TopBar title="Nhật ký quản trị" onLeadingPress={() => navigation.goBack()} />
        </ContentWidth>
      </View>

      <ContentWidth className="flex-1">
        <View className="gap-1 border-b border-line-subtle bg-canvas pb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pt-1">
            {DATE_FILTERS.map((f) => (
              <FilterChip key={f.key} label={f.label} icon="calendar-outline" selected={range === f.key} onPress={() => setRange(f.key)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pt-1">
            {ACTION_FILTERS.map((f) => (
              <FilterChip key={f.key || 'all'} label={f.label} selected={action === f.key} onPress={() => setAction(f.key)} />
            ))}
          </ScrollView>
          {(admins.data?.items.length ?? 0) > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 pt-1">
              <FilterChip label="Mọi người" icon="people-outline" selected={!actorId} onPress={() => setActorId(undefined)} />
              {admins.data?.items.map((a) => (
                <FilterChip
                  key={a.id}
                  label={a.fullName}
                  icon="person-outline"
                  selected={actorId === a.id}
                  onPress={() => setActorId(a.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {logs.isLoading ? (
          <View className="px-4 pt-4">
            <ListSkeleton rows={6} />
          </View>
        ) : logs.isError ? (
          <ErrorState onRetry={() => void logs.refetch()} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerClassName="gap-2 px-4 pb-10 pt-1"
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (logs.hasNextPage && !logs.isFetchingNextPage) void logs.fetchNextPage();
            }}
            refreshControl={
              <RefreshControl refreshing={logs.isRefetching && !logs.isFetchingNextPage} onRefresh={() => void logs.refetch()} colors={[palette.brand['500']]} />
            }
            ListHeaderComponent={
              total !== undefined ? (
                <Text variant="caption" weight="regular" tone="muted" className="px-1 pt-2">
                  {total} thao tác
                </Text>
              ) : undefined
            }
            ListFooterComponent={logs.isFetchingNextPage ? <LoadingSpinner /> : undefined}
            ListEmptyComponent={
              <EmptyState icon="document-text-outline" title="Chưa có thao tác nào" description="Thử đổi khoảng ngày hoặc loại thao tác." />
            }
          />
        )}
      </ContentWidth>
    </SafeAreaView>
  );
};
