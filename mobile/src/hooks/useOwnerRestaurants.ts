import { useQuery } from '@tanstack/react-query';
import { restaurantsApi } from '../api/restaurants';
import { useOwnerRestaurantStore } from '../store/useOwnerRestaurantStore';

/**
 * Danh sách quán của chủ quán và quán đang chọn.
 * Tự tải lại mỗi phút và khi quay lại app, để trạng thái mở/đóng cửa không bị cũ.
 */
export function useOwnerRestaurants() {
  const query = useQuery({
    queryKey: ['owner', 'restaurants'],
    queryFn: () => restaurantsApi.getMine(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const getActiveRestaurant = useOwnerRestaurantStore((s) => s.getActiveRestaurant);
  return {
    restaurants: query.data,
    restaurant: getActiveRestaurant(query.data),
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
