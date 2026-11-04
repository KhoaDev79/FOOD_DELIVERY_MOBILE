import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restaurantsApi } from '../../api/restaurants';
import { ReviewCard } from '../../components/modules/review/ReviewCard';
import { EmptyState, ErrorState, FilterChip, Icon, Skeleton, Text, TopBar } from '../../components/ui';
import { palette } from '../../theme';
import { RootStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RestaurantReviews'>;
type Filter = 'all' | 'photos' | 1 | 2 | 3 | 4 | 5;

/**
 * Tất cả đánh giá của quán (giống ShopeeFood / GrabFood): điểm trung bình, biểu đồ số đánh giá theo sao,
 * lọc "Có ảnh" hoặc theo số sao, tải thêm khi cuộn.
 */
export const RestaurantReviewsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { restaurantId, restaurantName } = route.params;
  const [filter, setFilter] = useState<Filter>('all');

  const query = useInfiniteQuery({
    queryKey: ['restaurant-reviews', restaurantId, 'all-screen', filter],
    queryFn: ({ pageParam }) =>
      restaurantsApi.getPublicReviews(restaurantId, {
        page: pageParam,
        limit: 15,
        withPhotos: filter === 'photos' ? true : undefined,
        rating: typeof filter === 'number' ? filter : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });

  const first = query.data?.pages[0];
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const breakdown = first?.breakdown ?? [];
  const totalVisible = breakdown.reduce((s, b) => s + b.count, 0);

  const chips: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'photos', label: `Có ảnh${first?.photoCount ? ` (${first.photoCount})` : ''}` },
    ...[5, 4, 3, 2, 1].map((s) => ({
      value: s as Filter,
      label: `${s}★ (${breakdown.find((b) => b.star === s)?.count ?? 0})`,
    })),
  ];

  const header = (
    <View className="gap-4">
      {/* Tổng quan: điểm trung bình + biểu đồ theo sao */}
      {first ? (
        <View className="flex-row items-center gap-5 rounded-2xl bg-surface p-4 shadow-card">
          <View className="items-center">
            <Text variant="display" weight="bold">
              {first.rating ? first.rating.toFixed(1) : '–'}
            </Text>
            <View className="flex-row">
              {[1, 2, 3, 4, 5].map((i) => (
                <Icon key={i} name={i <= Math.round(first.rating) ? 'star' : 'star-outline'} size={14} tone="rating" />
              ))}
            </View>
            <Text variant="micro" weight="regular" tone="muted" className="mt-1">
              {first.ratingCount} đánh giá
            </Text>
          </View>
          <View className="flex-1 gap-1">
            {breakdown.map((b) => (
              <View key={b.star} className="flex-row items-center gap-2">
                <Text variant="micro" weight="semibold" className="w-6">
                  {b.star}★
                </Text>
                <View className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-subtle">
                  <View
                    className="h-full rounded-full bg-rating"
                    style={{ width: `${totalVisible ? Math.round((b.count / totalVisible) * 100) : 0}%` }}
                  />
                </View>
                <Text variant="micro" weight="regular" tone="muted" className="w-6 text-right">
                  {b.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Skeleton className="h-32 w-full rounded-2xl" />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-1">
        {chips.map((c) => (
          <FilterChip key={String(c.value)} label={c.label} selected={filter === c.value} onPress={() => setFilter(c.value)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas-subtle">
      <TopBar title={restaurantName ? `Đánh giá · ${restaurantName}` : 'Đánh giá'} onLeadingPress={() => navigation.goBack()} className="bg-canvas-subtle" />
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListHeaderComponent={header}
          contentContainerClassName="gap-3 p-4 pb-10"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={
            query.isFetchingNextPage || query.isLoading ? (
              <ActivityIndicator color={palette.brand['500']} className="py-4" />
            ) : undefined
          }
          ListEmptyComponent={
            query.isLoading ? undefined : (
              <EmptyState
                variant="card"
                icon={filter === 'photos' ? 'images-outline' : 'chatbubble-ellipses-outline'}
                title={filter === 'all' ? 'Quán chưa có đánh giá' : 'Không có đánh giá phù hợp'}
                description={filter === 'all' ? 'Hãy là người đầu tiên đánh giá sau khi nhận món.' : 'Thử chọn bộ lọc khác.'}
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
};
