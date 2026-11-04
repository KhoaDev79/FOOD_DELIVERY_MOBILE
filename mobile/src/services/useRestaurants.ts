import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NearbyQueryParams, restaurantsApi } from '../api/restaurants';
import { queryKeys } from '../constants/queryKeys';

export function useNearbyRestaurants(
  params: Omit<NearbyQueryParams, 'lat' | 'lng'> & { lat?: number | null; lng?: number | null },
) {
  const hasCoords = params.lat != null && params.lng != null;
  return useQuery({
    queryKey: queryKeys.restaurants.nearby(params as unknown as Record<string, unknown>),
    queryFn: () =>
      restaurantsApi.getNearby({
        ...params,
        lat: params.lat!,
        lng: params.lng!,
      }),
    enabled: hasCoords,
    staleTime: 1000 * 60, // 1 phút
  });
}

/** Kết quả tìm kiếm có lọc/sắp xếp, tải thêm theo trang khi cuộn tới cuối danh sách. */
export function useSearchRestaurants(
  params: Omit<NearbyQueryParams, 'lat' | 'lng' | 'page'> & { lat?: number | null; lng?: number | null },
  enabled = true,
) {
  const hasCoords = params.lat != null && params.lng != null;
  return useInfiniteQuery({
    queryKey: ['restaurants', 'search', params],
    queryFn: ({ pageParam }) =>
      restaurantsApi.getNearby({ ...params, lat: params.lat!, lng: params.lng!, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && hasCoords,
    staleTime: 60 * 1000,
  });
}

export function useRestaurantDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.restaurants.detail(id),
    queryFn: () => restaurantsApi.getDetail(id),
    enabled: Boolean(id),
  });
}

export function useNearbyDishes(params: {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  limit?: number;
}) {
  const hasCoords = params.lat != null && params.lng != null;
  return useQuery({
    queryKey: queryKeys.restaurants.nearbyDishes(params as unknown as Record<string, unknown>),
    queryFn: () =>
      restaurantsApi.getNearbyDishes({
        ...params,
        lat: params.lat!,
        lng: params.lng!,
      }),
    enabled: hasCoords,
    staleTime: 1000 * 60,
  });
}

export function useBanners() {
  return useQuery({
    queryKey: queryKeys.banners,
    queryFn: () => restaurantsApi.getBanners(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useCuisines() {
  return useQuery({
    queryKey: queryKeys.cuisines,
    queryFn: () => restaurantsApi.getCuisines(),
    staleTime: 1000 * 60 * 60 * 12, // 12 tiếng
  });
}

export function usePopularSearches() {
  return useQuery({
    queryKey: queryKeys.search.popular,
    queryFn: () => restaurantsApi.getPopularSearches(),
    staleTime: 1000 * 60 * 15, // 15 phút
  });
}

export function useRestaurantSchedule(restaurantId: string) {
  return useQuery({
    queryKey: queryKeys.restaurants.schedule(restaurantId),
    queryFn: () => restaurantsApi.getSchedule(restaurantId),
    enabled: Boolean(restaurantId),
  });
}

export function useUpdateWeeklySchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      data,
    }: {
      restaurantId: string;
      data: {
        schedule: { dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }[];
        applyToAllDays?: boolean;
      };
    }) => restaurantsApi.updateWeeklySchedule(restaurantId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.schedule(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.detail(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all });
    },
  });
}

export function useAddSpecialClosing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      data,
    }: {
      restaurantId: string;
      data: { date: string; reason?: string };
    }) => restaurantsApi.addSpecialClosing(restaurantId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.schedule(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.detail(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all });
    },
  });
}

export function useRemoveSpecialClosing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      restaurantId,
      closingId,
    }: {
      restaurantId: string;
      closingId: string;
    }) => restaurantsApi.removeSpecialClosing(restaurantId, closingId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.schedule(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.detail(vars.restaurantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all });
    },
  });
}
