import { useQuery } from '@tanstack/react-query';
import { NearbyQueryParams, restaurantsApi } from '../api/restaurants';
import { queryKeys } from '../constants/queryKeys';

export function useNearbyRestaurants(params: NearbyQueryParams) {
  return useQuery({
    queryKey: queryKeys.restaurants.nearby(params as unknown as Record<string, unknown>),
    queryFn: () => restaurantsApi.getNearby(params),
    staleTime: 1000 * 60, // 1 phút
  });
}

export function useRestaurantDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.restaurants.detail(id),
    queryFn: () => restaurantsApi.getDetail(id),
    enabled: Boolean(id),
  });
}

