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

export type StatsRange = 'today' | '7d' | '30d';

export interface KpiValue {
  value: number;
  previous: number;
  /** % thay đổi (hoặc điểm % với các chỉ số tỉ lệ); null = kỳ trước không có dữ liệu. */
  changePct: number | null;
}

export type KpiKey = 'gmv' | 'orders' | 'aov' | 'successRate' | 'cancelRate' | 'deliveryFee' | 'commission';

export interface AdminAttention {
  stalled: { count: number; oldestSince: string | null; oldestMinutes: number };
  roleRequests: number;
  restaurantsPending: number;
  restaurantsUnassigned: number;
  vehiclesPending: number;
  driversOverDebt: number;
  driversNearDebt: number;
  debtLimit: number;
}

export interface AdminOverview {
  range: StatsRange;
  generatedAt: string;
  period: { start: string; end: string; prevStart: string; prevEnd: string; bucket: 'hour' | 'day' };
  kpis: Record<KpiKey, KpiValue>;
  series: { at: string; label: string; gmv: number; orders: number }[];
  funnel: { statuses: Partial<Record<OrderStatus, number>>; stalled: number };
  topRestaurants: { id: string; name: string; imageUrl?: string | null; gmv: number; orders: number }[];
  cancelReasons: { kind: 'cancel' | 'failed'; reason: string; count: number }[];
  attention: AdminAttention;
}

export type AdminOrderGroup = 'active' | 'stalled' | 'done' | 'failed';

export type AdminOrderListItem = OrderDetail & {
  _count?: { contactAttempts: number };
  /** Thời điểm đơn bước vào trạng thái hiện tại. */
  statusSince?: string;
};

/** Chi tiết đơn cho admin: thêm ảnh/avatar và vị trí cuối của tài xế. */
export type AdminOrderDetail = Omit<OrderDetail, 'driver' | 'customer'> & {
  customer: OrderDetail['customer'] & { email?: string | null; avatarUrl?: string | null };
  driver?:
    | (Omit<NonNullable<OrderDetail['driver']>, 'driverProfile'> & {
        driverProfile?: {
          vehicleType?: 'MOTORBIKE' | 'ELECTRIC_MOTORBIKE' | 'BICYCLE' | null;
          licensePlate?: string | null;
          lastLatitude?: number | null;
          lastLongitude?: number | null;
          lastLocationAt?: string | null;
        } | null;
      })
    | null;
};

export interface AdminAuditLog extends AuditLogEntry {
  actor?: { id: string; fullName: string; role?: Role; avatarUrl?: string | null } | null;
}

export interface RestaurantLast7Days {
  gmv: number;
  orders: number;
  delivered: number;
  series: { at: string; label: string; gmv: number; orders: number }[];
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

export type RestaurantFilter = 'all' | 'open' | 'closed' | 'unassigned' | 'pending' | 'suspended' | 'active';

export interface AdminRoleRequest extends RoleUpgradeRequest {
  user: Pick<User, 'id' | 'fullName' | 'email' | 'phone' | 'role' | 'avatarUrl' | 'isActive'>;
  reviewedBy?: { id: string; fullName: string } | null;
}

export const adminApi = {
  getStats: () => apiClient.get<any, AdminStats>('/admin/stats'),

  getOverview: (range: StatsRange) =>
    apiClient.get<any, AdminOverview>('/admin/stats/overview', { params: { range } }),

  /** CSV toàn bộ đơn trong kỳ (from/to: YYYY-MM-DD giờ VN). Trả chuỗi CSV thô. */
  exportOrdersCsv: (from: string, to: string) =>
    apiClient.get<any, string>('/admin/export/orders', { params: { from, to }, responseType: 'text' }),

  getAttention: () => apiClient.get<any, AdminAttention>('/admin/stats/attention'),

  listAuditLogs: (params?: {
    actorId?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => apiClient.get<any, PaginatedResult<AdminAuditLog> & { total: number }>('/admin/audit-logs', { params }),

  getRestaurantLast7Days: (id: string) =>
    apiClient.get<any, RestaurantLast7Days>(`/admin/restaurants/${id}/last-7-days`),

  /* ------------------------------ Người dùng ------------------------------ */
  listUsers: (params?: { role?: Role; status?: 'active' | 'locked'; q?: string; page?: number; limit?: number }) =>
    apiClient.get<any, PaginatedResult<User> & { total: number }>('/admin/users', { params }),

  toggleUserActive: (id: string, reason?: string) =>
    apiClient.patch<any, User>(`/admin/users/${id}/toggle-active`, reason ? { reason } : {}),

  changeUserRole: (id: string, role: Role) => apiClient.patch<any, User>(`/admin/users/${id}/role`, { role }),

  getUserActivity: (id: string) => apiClient.get<any, AdminUserActivity>(`/admin/users/${id}/activity`),

  /* ------------------------------- Quán ăn ------------------------------- */
  listRestaurants: (params?: { page?: number; limit?: number; q?: string; filter?: RestaurantFilter }) =>
    apiClient.get<
      any,
      PaginatedResult<AdminRestaurantItem> & { total: number; counts?: Partial<Record<RestaurantFilter, number>> }
    >('/admin/restaurants', {
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
    group?: AdminOrderGroup;
    status?: OrderStatus;
    restaurantId?: string;
    stalled?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<
      any,
      PaginatedResult<AdminOrderListItem> & { total: number; counts?: Record<AdminOrderGroup, number> }
    >('/admin/orders', { params }),

  getOrderDetail: (orderId: string) =>
    apiClient.get<any, AdminOrderDetail>(`/admin/orders/${orderId}`),

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
