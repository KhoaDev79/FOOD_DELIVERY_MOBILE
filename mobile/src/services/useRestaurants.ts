import { useQuery } from '@tanstack/react-query';
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
