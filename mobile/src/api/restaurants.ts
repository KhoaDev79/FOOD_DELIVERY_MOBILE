import { apiClient } from './client';
import {
  Banner,
  CuisineCategory,
  ManageRestaurantReview,
  MenuItemOptionsInput,
  MenuSuggestion,
  NearbyDish,
  OrderDetail,
  OrderReview,
  PaginatedResult,
  PublicRestaurantReview,
  Restaurant,
  RestaurantDetail,
  RestaurantStats,
} from '../types/api';

export interface NearbyQueryParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  q?: string;
  openOnly?: boolean;
  page?: number;
  limit?: number;
}

export const restaurantsApi = {
  getNearby: (params: NearbyQueryParams) =>
    apiClient.get<any, PaginatedResult<Restaurant>>('/restaurants/nearby', { params }),

  getNearbyDishes: (params: Pick<NearbyQueryParams, 'lat' | 'lng' | 'radiusKm' | 'limit'>) =>
    apiClient.get<any, { items: NearbyDish[] }>('/restaurants/nearby/dishes', { params }),

  getBanners: () => apiClient.get<any, Banner[]>('/banners'),

  getCuisines: () => apiClient.get<any, CuisineCategory[]>('/cuisines'),

  getPopularSearches: () => apiClient.get<any, string[]>('/search/popular'),

  logSearch: (query: string) => apiClient.post<any, { success: boolean }>('/search/log', { query }),

  /** Gợi ý món thêm vào giỏ ("Thường được đặt cùng"). */
  getSuggestions: (restaurantId: string, itemIds: string[]) =>
    apiClient.get<any, { items: MenuSuggestion[] }>(`/restaurants/${restaurantId}/suggestions`, {
      params: { itemIds: itemIds.join(',') },
    }),

  getDetail: (id: string) =>
    apiClient.get<any, RestaurantDetail>(`/restaurants/${id}`),

  // ===================== OWNER & ADMIN ENDPOINTS =====================
  createRestaurant: (data: {
    name: string;
    description?: string;
    imageUrl?: string;
    address: string;
    latitude: number;
    longitude: number;
    deliveryRadiusKm?: number;
    ownerId?: string;
  }) => apiClient.post<any, Restaurant>('/restaurants', data),

  getMine: () =>
    apiClient.get<any, Restaurant[]>('/restaurants/mine'),

  updateRestaurant: (id: string, data: Partial<Restaurant>) =>
    apiClient.patch<any, Restaurant>(`/restaurants/${id}`, data),

  deleteRestaurant: (id: string) =>
    apiClient.delete(`/restaurants/${id}`),

  getRestaurantOrders: (restaurantId: string, params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<OrderDetail>>(`/orders/restaurant/${restaurantId}`, { params }),

  createCategory: (restaurantId: string, data: { name: string; sortOrder?: number }) =>
    apiClient.post<any, any>(`/restaurants/${restaurantId}/categories`, data),

  createMenuItem: (
    restaurantId: string,
    data: {
      name: string;
      price: number;
      description?: string;
      categoryId?: string;
      imageUrl?: string;
      /** 0, 5, 7, 10, 15, 20 – backend tự tính giá giảm */
      discountPercent?: number;
      isAvailable?: boolean;
      options?: MenuItemOptionsInput | null;
    },
  ) => apiClient.post<any, any>(`/restaurants/${restaurantId}/menu-items`, data),

  updateMenuItem: (
    id: string,
    data: {
      name?: string;
      price?: number;
      description?: string;
      isAvailable?: boolean;
      categoryId?: string;
      imageUrl?: string;
      discountPercent?: number;
      /** null = xoá hết tuỳ chọn; bỏ trống = giữ nguyên */
      options?: MenuItemOptionsInput | null;
    },
  ) => apiClient.patch<any, any>(`/menu-items/${id}`, data),

  archiveMenuItem: (id: string) =>
    apiClient.delete(`/menu-items/${id}`),

  /** Thống kê bán hàng của quán: days = 1 (hôm nay), 7 hoặc 30 ngày. */
  getStats: (restaurantId: string, days: 1 | 7 | 30) =>
    apiClient.get<any, RestaurantStats>(`/restaurants/${restaurantId}/stats`, { params: { days } }),

  /** E3: Danh sách đánh giá công khai của quán */
  getPublicReviews: (
    restaurantId: string,
    params?: { page?: number; limit?: number; rating?: number },
  ) =>
    apiClient.get<
      any,
      PaginatedResult<PublicRestaurantReview> & {
        rating: number;
        ratingCount: number;
        total: number;
      }
    >(`/restaurants/${restaurantId}/reviews`, { params }),

  /** E3: Danh sách đánh giá dành cho Chủ quán / Admin quản lý */
  getManageReviews: (
    restaurantId: string,
    params?: { page?: number; limit?: number; rating?: number; unrepliedOnly?: boolean },
  ) =>
    apiClient.get<
      any,
      PaginatedResult<ManageRestaurantReview> & {
        rating: number;
        ratingCount: number;
        total: number;
      }
    >(`/restaurants/${restaurantId}/reviews/manage`, { params }),

  /** E3: Chủ quán phản hồi đánh giá (chỉ 1 lần) */
  replyReview: (reviewId: string, reply: string) =>
    apiClient.post<any, OrderReview>(`/reviews/${reviewId}/reply`, { reply }),
};
