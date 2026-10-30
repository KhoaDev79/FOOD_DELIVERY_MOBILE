import { apiClient } from './client';
import {
  OrderDetail,
  OrderStatus,
  PaginatedResult,
  RestaurantStatus,
  Role,
  RoleUpgradeRequest,
  User,
} from '../types/api';

export interface AdminStats {
  users: {
    /** = customersCount + ownersCount + driversCount + adminsCount */
    total: number;
    customersCount: number;
    ownersCount: number;
    driversCount: number;
    adminsCount: number;
    inactive: number;
    roles: Record<Role, number>;
  };
  restaurants: {
    total: number;
    open: number;
    closed: number;
    unassigned: number;
    pending?: number;
    pendingApproval?: number;
    suspended?: number;
  };
  orders: {
    total: number;
    stalled?: number;
    statuses: Partial<Record<OrderStatus, number>>;
    totalRevenue: number;
  };
  drivers?: {
    totalCodDebt: number;
  };
  roleRequests: { pending: number };
}

export interface AdminRestaurantOwner {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
  isActive: boolean;
}

export interface AdminRestaurantItem {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  address: string;
  phone?: string | null;
  status: RestaurantStatus;
  suspendReason?: string | null;
  isOpen: boolean;
  rating: number;
  ratingCount?: number;
  openTime: string;
  closeTime: string;
  createdAt: string;
  owner: AdminRestaurantOwner;
  /** Chủ hiện tại không phải tài khoản chủ quán đang hoạt động → cần gán chủ mới. */
  needsOwner: boolean;
  _count: {
    menuItems: number;
    orders: number;
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actor?: { id: string; fullName: string } | null;
}

export interface AdminRestaurantDetail extends AdminRestaurantItem {
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  priceRange: string;
  _count: { menuItems: number; orders: number; reviews: number; categories: number };
  stats: {
    revenue: number;
    deliveredOrders: number;
    statuses: Partial<Record<OrderStatus, number>>;
  };
  history: AuditLogEntry[];
}

export interface AdminUserActivity {
  user: Pick<User, 'id' | 'fullName' | 'email' | 'role' | 'createdAt'>;
  summary: { orderCount: number; deliveryCount: number; restaurantCount: number };
  restaurants: { id: string; name: string; isOpen: boolean }[];
  auditLogs: AuditLogEntry[];
  recentOrders: {
    id: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
    asCustomer: boolean;
    restaurant: { id: string; name: string };
  }[];
  roleRequests: RoleUpgradeRequest[];
}

export type RestaurantFilter = 'all' | 'open' | 'closed' | 'unassigned' | 'pending' | 'suspended';

export interface AdminRoleRequest extends RoleUpgradeRequest {
  user: Pick<User, 'id' | 'fullName' | 'email' | 'phone' | 'role' | 'avatarUrl' | 'isActive'>;
  reviewedBy?: { id: string; fullName: string } | null;
}

export const adminApi = {
  getStats: () => apiClient.get<any, AdminStats>('/admin/stats'),

  /* ------------------------------ Người dùng ------------------------------ */
  listUsers: (params?: { role?: Role; q?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<User> & { total: number }>('/admin/users', { params }),

  toggleUserActive: (id: string, reason?: string) =>
    apiClient.patch<any, User>(`/admin/users/${id}/toggle-active`, reason ? { reason } : {}),

  changeUserRole: (id: string, role: Role) => apiClient.patch<any, User>(`/admin/users/${id}/role`, { role }),

  getUserActivity: (id: string) => apiClient.get<any, AdminUserActivity>(`/admin/users/${id}/activity`),

  /* ------------------------------- Quán ăn ------------------------------- */
  listRestaurants: (params?: { page?: number; limit?: number; q?: string; filter?: RestaurantFilter }) =>
    apiClient.get<any, PaginatedResult<AdminRestaurantItem> & { total: number }>('/admin/restaurants', {
      params: params?.filter === 'all' ? { ...params, filter: undefined } : params,
    }),

  getRestaurant: (id: string) => apiClient.get<any, AdminRestaurantDetail>(`/admin/restaurants/${id}`),

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
  }) => apiClient.post<any, AdminRestaurantItem & { temporaryPassword?: string | null }>('/admin/restaurants', data),

  assignOwner: (restaurantId: string, ownerId: string) =>
    apiClient.patch<any, AdminRestaurantItem & { promoted: boolean }>(
      `/admin/restaurants/${restaurantId}/assign-owner`,
      { ownerId },
    ),

  toggleRestaurantOpen: (id: string) => apiClient.patch<any, AdminRestaurantItem>(`/admin/restaurants/${id}/toggle-open`),

  approveRestaurant: (id: string) =>
    apiClient.patch<any, AdminRestaurantItem>(`/admin/restaurants/${id}/approve`),

  rejectRestaurant: (id: string, reason: string) =>
    apiClient.patch<any, AdminRestaurantItem>(`/admin/restaurants/${id}/reject`, { reason }),

  updateRestaurantStatus: (id: string, status: RestaurantStatus, reason?: string) =>
    apiClient.patch<any, AdminRestaurantItem>(`/admin/restaurants/${id}/status`, {
      status,
      ...(reason ? { reason } : {}),
    }),

  /* -------------------------------- Đơn hàng -------------------------------- */
  listOrders: (params?: {
    status?: OrderStatus;
    stalled?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<any, PaginatedResult<OrderDetail & { _count?: { contactAttempts: number } }> & { total: number }>(
      '/admin/orders',
      { params },
    ),

  getOrderDetail: (orderId: string) =>
    apiClient.get<any, OrderDetail>(`/admin/orders/${orderId}`),

  unassignDriver: (orderId: string, reason?: string) =>
    apiClient.post<any, { id: string; status: OrderStatus }>(
      `/admin/orders/${orderId}/unassign-driver`,
      reason ? { reason } : {},
    ),

  updateReviewVisibility: (reviewId: string, isHidden: boolean, reason: string) =>
    apiClient.patch<any, { id: string; isHidden: boolean }>(`/admin/reviews/${reviewId}/visibility`, {
      isHidden,
      reason,
    }),

  /* ----------------------- Yêu cầu nâng cấp vai trò ----------------------- */
  listRoleRequests: (status?: RoleUpgradeRequest['status']) =>
    apiClient.get<any, AdminRoleRequest[]>('/admin/role-requests', { params: status ? { status } : undefined }),

  reviewRoleRequest: (id: string, status: 'APPROVED' | 'REJECTED', reviewNote?: string) =>
    apiClient.patch<any, AdminRoleRequest>(`/admin/role-requests/${id}/review`, {
      status,
      ...(reviewNote ? { reviewNote } : {}),
    }),
};
