import { apiClient } from './client';
import {
  Banner,
  NearbyDish,
  OrderDetail,
  PaginatedResult,
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
    },
  ) => apiClient.patch<any, any>(`/menu-items/${id}`, data),

  archiveMenuItem: (id: string) =>
    apiClient.delete(`/menu-items/${id}`),

  /** Thống kê bán hàng của quán: days = 1 (hôm nay), 7 hoặc 30 ngày. */
  getStats: (restaurantId: string, days: 1 | 7 | 30) =>
    apiClient.get<any, RestaurantStats>(`/restaurants/${restaurantId}/stats`, { params: { days } }),
};
