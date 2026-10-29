import { apiClient } from './client';
import { PaginatedResult, Role, User } from '../types/api';

export interface AdminStats {
  users: {
    total: number;
    roles: Record<string, number>;
  };
  restaurants: {
    total: number;
    open: number;
    closed: number;
  };
  orders: {
    total: number;
    statuses: Record<string, number>;
    totalRevenue: number;
  };
}

export interface AdminRestaurantItem {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  address: string;
  isOpen: boolean;
  rating: number;
  createdAt: string;
  owner: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  _count: {
    menuItems: number;
    orders: number;
  };
}

export const adminApi = {
  getStats: () => apiClient.get<any, AdminStats>('/admin/stats'),

  listUsers: (params?: { role?: Role; q?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<User>>('/admin/users', { params }),

  toggleUserActive: (id: string) =>
    apiClient.patch<any, User>(`/admin/users/${id}/toggle-active`),

  listRestaurants: (params?: { page?: number; limit?: number; q?: string }) =>
    apiClient.get<any, PaginatedResult<AdminRestaurantItem>>('/admin/restaurants', { params }),

  createRestaurant: (data: {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
  }) => apiClient.post<any, any>('/admin/restaurants', data),

  updateRestaurant: (id: string, data: Partial<AdminRestaurantItem>) =>
    apiClient.patch<any, any>(`/admin/restaurants/${id}`, data),

  deleteRestaurant: (id: string) =>
    apiClient.delete(`/admin/restaurants/${id}`),

  deleteMenuItem: (id: string) =>
    apiClient.delete(`/admin/menu-items/${id}`),

  toggleRestaurantOpen: (id: string) =>
    apiClient.patch<any, any>(`/admin/restaurants/${id}/toggle-open`),
};

